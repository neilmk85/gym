package services

import (
	"errors"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/config"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type CheckInRequest struct {
	MemberID   uint    `json:"member_id"`   // required for manual check-in by staff
	FacilityID uint    `json:"facility_id"` // required
	Method     string  `json:"method"`      // qr/manual/geofence/card
	QRToken    string  `json:"qr_token"`    // present when method=qr
	Latitude   float64 `json:"latitude"`    // present when method=geofence
	Longitude  float64 `json:"longitude"`   // present when method=geofence
	Notes      string  `json:"notes"`
}

type CheckOutRequest struct {
	Notes string `json:"notes"`
}

// QRClaims are embedded in QR code tokens.
type QRClaims struct {
	MemberID   uint `json:"member_id"`
	FacilityID uint `json:"facility_id"`
	jwt.RegisteredClaims
}

// ─── Service ─────────────────────────────────────────────────────────────────

type AttendanceService interface {
	// GenerateQRToken returns a short-lived signed token for a member's QR code.
	GenerateQRToken(memberID uint, facilityID uint) (string, error)
	// CheckIn records a new attendance entry.
	CheckIn(req CheckInRequest, actorID uint, ipAddress string) (*models.Attendance, error)
	// CheckOut completes an open check-in.
	CheckOut(attendanceID uint, req CheckOutRequest, actorID uint) (*models.Attendance, error)
	// CheckOutByMember finds the open check-in for a member and checks them out.
	CheckOutByMember(memberID uint, req CheckOutRequest, actorID uint) (*models.Attendance, error)
	// GetByID returns a single attendance record.
	GetByID(id uint) (*models.Attendance, error)
	// List returns paginated attendance records.
	List(req utils.PageRequest, facilityID *uint, memberID *uint) ([]*models.Attendance, int64, error)
	// Stats returns aggregated attendance statistics for a member.
	Stats(memberID uint) (*models.MemberAttendanceStats, error)
}

type attendanceService struct {
	attendanceRepo repositories.AttendanceRepository
	memberRepo     repositories.MemberRepository
	facilityRepo   repositories.FacilityRepository
	jwtCfg         config.JWTConfig
	logger         *slog.Logger
}

func NewAttendanceService(
	attendanceRepo repositories.AttendanceRepository,
	memberRepo repositories.MemberRepository,
	facilityRepo repositories.FacilityRepository,
	jwtCfg config.JWTConfig,
	logger *slog.Logger,
) AttendanceService {
	return &attendanceService{
		attendanceRepo: attendanceRepo,
		memberRepo:     memberRepo,
		facilityRepo:   facilityRepo,
		jwtCfg:         jwtCfg,
		logger:         logger,
	}
}

const qrTokenExpiry = 24 * time.Hour // QR codes renew daily

func (s *attendanceService) GenerateQRToken(memberID uint, facilityID uint) (string, error) {
	member, err := s.memberRepo.FindByID(memberID)
	if err != nil || member == nil {
		return "", apperrors.ErrMemberNotFound
	}
	if member.MembershipStatus != models.MemberStatusActive &&
		member.MembershipStatus != models.MemberStatusPaused {
		return "", apperrors.New(http.StatusConflict, "ATT_001", "Member is not active", "")
	}

	claims := QRClaims{
		MemberID:   memberID,
		FacilityID: facilityID,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "qr",
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(qrTokenExpiry)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.jwtCfg.Secret))
	if err != nil {
		return "", apperrors.ErrInternal
	}
	return signed, nil
}

func (s *attendanceService) CheckIn(req CheckInRequest, actorID uint, ipAddress string) (*models.Attendance, error) {
	if req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("facility_id is required")
	}

	method := req.Method
	if method == "" {
		method = models.CheckInMethodManual
	}

	var memberID uint

	switch method {
	case models.CheckInMethodQR:
		// Decode and validate QR token.
		id, facID, err := s.validateQRToken(req.QRToken)
		if err != nil {
			return nil, err
		}
		if facID != 0 && facID != req.FacilityID {
			return nil, apperrors.New(http.StatusConflict, "ATT_002", "QR token is for a different facility", "")
		}
		memberID = id

	case models.CheckInMethodGeofence:
		// Validate geofence.
		if err := s.validateGeofence(req.FacilityID, req.Latitude, req.Longitude); err != nil {
			return nil, err
		}
		// Resolve member: explicit ID or self-lookup by actorID.
		id, err := s.resolveMemberID(req.MemberID, actorID)
		if err != nil {
			return nil, err
		}
		memberID = id

	case models.CheckInMethodManual, models.CheckInMethodCard:
		// Staff must supply member_id; member role resolves self.
		id, err := s.resolveMemberID(req.MemberID, actorID)
		if err != nil {
			return nil, err
		}
		memberID = id

	default:
		return nil, apperrors.ErrValidation("invalid method; accepted: qr, manual, geofence, card")
	}

	// Validate member and active membership.
	member, err := s.memberRepo.FindByID(memberID)
	if err != nil || member == nil {
		return nil, apperrors.ErrMemberNotFound
	}
	if member.MembershipStatus == models.MemberStatusExpired ||
		member.MembershipStatus == models.MemberStatusCancelled {
		return nil, apperrors.New(http.StatusConflict, "ATT_003", "Member does not have an active membership", "")
	}

	// Prevent duplicate open check-ins.
	open, err := s.attendanceRepo.FindOpenCheckIn(memberID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if open != nil {
		return nil, apperrors.New(http.StatusConflict, "ATT_004", "Member already has an open check-in", "close the previous session first")
	}

	now := time.Now()
	attendance := &models.Attendance{
		MemberID:      memberID,
		FacilityID:    req.FacilityID,
		CheckInAt:     now,
		Method:        method,
		Notes:         req.Notes,
		CheckedInByID: ptrUint(actorID),
		IPAddress:     ipAddress,
	}

	// Store location for geofence check-ins.
	if method == models.CheckInMethodGeofence && req.Latitude != 0 && req.Longitude != 0 {
		attendance.Latitude = &req.Latitude
		attendance.Longitude = &req.Longitude
	}

	if err := s.attendanceRepo.Create(attendance); err != nil {
		s.logger.Error("check-in failed", "member_id", memberID, "err", err)
		return nil, apperrors.ErrInternal
	}

	// Reload with associations.
	created, err := s.attendanceRepo.FindByID(attendance.ID)
	if err != nil || created == nil {
		return attendance, nil
	}
	return created, nil
}

func (s *attendanceService) CheckOut(attendanceID uint, req CheckOutRequest, actorID uint) (*models.Attendance, error) {
	attendance, err := s.attendanceRepo.FindByID(attendanceID)
	if err != nil || attendance == nil {
		return nil, apperrors.New(http.StatusNotFound, "ATT_005", "Attendance record not found", "")
	}
	if attendance.CheckOutAt != nil {
		return nil, apperrors.New(http.StatusConflict, "ATT_006", "Already checked out", "")
	}

	return s.doCheckOut(attendance, req.Notes)
}

func (s *attendanceService) CheckOutByMember(memberID uint, req CheckOutRequest, actorID uint) (*models.Attendance, error) {
	open, err := s.attendanceRepo.FindOpenCheckIn(memberID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if open == nil {
		return nil, apperrors.New(http.StatusNotFound, "ATT_007", "No open check-in found for this member", "")
	}
	return s.doCheckOut(open, req.Notes)
}

func (s *attendanceService) doCheckOut(a *models.Attendance, notes string) (*models.Attendance, error) {
	now := time.Now()
	a.CheckOutAt = &now

	// Compute duration in minutes.
	durMins := int(now.Sub(a.CheckInAt).Minutes())
	a.DurationMins = &durMins

	if notes != "" {
		a.Notes = notes
	}

	if err := s.attendanceRepo.Update(a); err != nil {
		return nil, apperrors.ErrInternal
	}

	updated, err := s.attendanceRepo.FindByID(a.ID)
	if err != nil || updated == nil {
		return a, nil
	}
	return updated, nil
}

func (s *attendanceService) GetByID(id uint) (*models.Attendance, error) {
	a, err := s.attendanceRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if a == nil {
		return nil, apperrors.New(http.StatusNotFound, "ATT_005", "Attendance record not found", "")
	}
	return a, nil
}

func (s *attendanceService) List(req utils.PageRequest, facilityID *uint, memberID *uint) ([]*models.Attendance, int64, error) {
	return s.attendanceRepo.List(req, facilityID, memberID)
}

func (s *attendanceService) Stats(memberID uint) (*models.MemberAttendanceStats, error) {
	member, err := s.memberRepo.FindByID(memberID)
	if err != nil || member == nil {
		return nil, apperrors.ErrMemberNotFound
	}
	return s.attendanceRepo.Stats(memberID)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

func (s *attendanceService) validateQRToken(tokenStr string) (memberID, facilityID uint, err error) {
	if tokenStr == "" {
		return 0, 0, apperrors.ErrValidation("qr_token is required for QR check-in")
	}

	claims := &QRClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, apperrors.ErrValidation("invalid token signing method")
		}
		return []byte(s.jwtCfg.Secret), nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return 0, 0, apperrors.New(http.StatusUnauthorized, "ATT_008", "QR code has expired", "generate a new one")
		}
		return 0, 0, apperrors.New(http.StatusUnauthorized, "ATT_009", "Invalid QR code", "")
	}
	if !token.Valid || claims.Subject != "qr" {
		return 0, 0, apperrors.New(http.StatusUnauthorized, "ATT_009", "Invalid QR code", "")
	}

	return claims.MemberID, claims.FacilityID, nil
}

func (s *attendanceService) validateGeofence(facilityID uint, lat, lon float64) error {
	if lat == 0 && lon == 0 {
		return apperrors.ErrValidation("latitude and longitude are required for geofence check-in")
	}

	facility, err := s.facilityRepo.FindByID(facilityID)
	if err != nil || facility == nil {
		return apperrors.New(http.StatusNotFound, "FAC_001", "Facility not found", "")
	}
	if facility.Latitude == 0 && facility.Longitude == 0 {
		// Facility has no coordinates configured — skip geofence.
		return nil
	}

	dist := haversineMeters(facility.Latitude, facility.Longitude, lat, lon)
	if dist > float64(facility.GeofenceRadiusMeters) {
		return apperrors.New(http.StatusConflict, "ATT_010",
			"You are outside the facility's geofence",
			fmt.Sprintf("You are %.0f m away; allowed radius is %d m", dist, facility.GeofenceRadiusMeters))
	}
	return nil
}

// haversineMeters returns the distance in meters between two lat/lon pairs.
func haversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000 // metres
	φ1 := lat1 * math.Pi / 180
	φ2 := lat2 * math.Pi / 180
	Δφ := (lat2 - lat1) * math.Pi / 180
	Δλ := (lon2 - lon1) * math.Pi / 180

	a := math.Sin(Δφ/2)*math.Sin(Δφ/2) +
		math.Cos(φ1)*math.Cos(φ2)*math.Sin(Δλ/2)*math.Sin(Δλ/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}

func ptrUint(v uint) *uint { return &v }

// resolveMemberID returns explicitID if non-zero, otherwise looks up the member
// whose user_id matches actorUserID (for member self-check-in).
func (s *attendanceService) resolveMemberID(explicitID, actorUserID uint) (uint, error) {
	if explicitID != 0 {
		return explicitID, nil
	}
	// Self-lookup: find the member record for the acting user.
	m, err := s.memberRepo.FindByUserID(actorUserID)
	if err != nil {
		return 0, apperrors.ErrInternal
	}
	if m == nil {
		return 0, apperrors.ErrValidation("member_id is required (or log in as a member account)")
	}
	return m.ID, nil
}
