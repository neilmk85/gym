package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// parseDateOfBirth parses YYYY-MM-DD string into *time.Time.
func parseDateOfBirth(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

type CreateMemberRequest struct {
	// User fields
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Email       string `json:"email"`
	Phone       string `json:"phone"`
	Password    string `json:"password"`
	DateOfBirth string `json:"date_of_birth"` // YYYY-MM-DD
	Gender      string `json:"gender"`        // M, F, Other

	// Member fields
	FacilityID uint   `json:"facility_id"`
	Role       string `json:"role"`       // default: member
	BatchTime  string `json:"batch_time"` // "06:00".."21:00"
}

type UpdateMemberRequest struct {
	FirstName                    string         `json:"first_name"`
	LastName                     string         `json:"last_name"`
	Phone                        string         `json:"phone"`
	DateOfBirth                  string         `json:"date_of_birth"`
	Gender                       string         `json:"gender"`
	HeightCm                     *int           `json:"height_cm"`
	WeightKg                     *float64       `json:"weight_kg"`
	EmergencyContactName         string         `json:"emergency_contact_name"`
	EmergencyContactPhone        string         `json:"emergency_contact_phone"`
	EmergencyContactRelationship string         `json:"emergency_contact_relationship"`
	HealthDeclaration            models.JSONMap `json:"health_declaration"`
	MemberNotes                  string         `json:"member_notes"`
	MemberTags                   models.JSONMap `json:"member_tags"`
	BatchTime                    string         `json:"batch_time"` // "06:00".."21:00"
}

type MemberResponse struct {
	ID               uint      `json:"id"`
	MemberCode       string    `json:"member_code"`
	MembershipStatus string    `json:"membership_status"`
	JoinedDate       time.Time `json:"joined_date"`
	CurrentPlanID    *uint     `json:"current_plan_id,omitempty"`
	User             *UserInfo `json:"user"`
	FacilityID       uint      `json:"facility_id"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type MemberService interface {
	Create(req CreateMemberRequest, createdByUserID uint, ipAddress string) (*MemberResponse, error)
	GetByID(id uint, requesterID uint, requesterRole string) (*models.Member, error)
	GetByUserID(userID uint) (*models.Member, error)
	Update(memberID uint, req UpdateMemberRequest, updaterID uint, ipAddress string) (*models.Member, error)
	SoftDelete(memberID uint, reason string, deleterID uint, ipAddress string) error
	List(req utils.PageRequest, facilityID *uint) ([]*models.Member, int64, error)
	Freeze(memberID uint, months int, reason string, actorID uint) error
	Unfreeze(memberID uint, actorID uint) error
	AssignTrainer(memberID uint, trainerID *uint, trainerName string) error
}

type memberService struct {
	memberRepo   repositories.MemberRepository
	userRepo     repositories.UserRepository
	auditRepo    repositories.AuditLogRepository
	authSvc      AuthService
	notifSvc     NotificationService
	logger       *slog.Logger
}

func NewMemberService(
	memberRepo repositories.MemberRepository,
	userRepo repositories.UserRepository,
	auditRepo repositories.AuditLogRepository,
	authSvc AuthService,
	notifSvc NotificationService,
	logger *slog.Logger,
) MemberService {
	return &memberService{
		memberRepo: memberRepo,
		userRepo:   userRepo,
		auditRepo:  auditRepo,
		authSvc:    authSvc,
		notifSvc:   notifSvc,
		logger:     logger,
	}
}

func (s *memberService) Create(req CreateMemberRequest, createdByUserID uint, ipAddress string) (*MemberResponse, error) {
	if req.FirstName == "" || req.LastName == "" {
		return nil, apperrors.ErrValidation("first_name and last_name are required")
	}
	if req.Email == "" {
		return nil, apperrors.ErrValidation("email is required")
	}
	if req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("facility_id is required")
	}

	role := req.Role
	if role == "" {
		role = "member"
	}
	if req.Password == "" {
		req.Password = "TempPass@123" // temporary, member should reset
	}

	// Create user account.
	signupReq := SignupRequest{
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Phone:     req.Phone,
		Password:  req.Password,
		Role:      role,
	}
	userInfo, err := s.authSvc.Signup(signupReq)
	if err != nil {
		return nil, err
	}

	// If created by admin/manager, auto-verify the email.
	user, _ := s.userRepo.FindByEmail(req.Email)
	if user != nil {
		_ = s.userRepo.MarkEmailVerified(user.ID)
	}

	// Generate member code.
	code, err := s.memberRepo.NextMemberCode(req.FacilityID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}

	member := &models.Member{
		UserID:           userInfo.ID,
		FacilityID:       req.FacilityID,
		MemberCode:       code,
		MembershipStatus: models.MemberStatusActive,
		JoinedDate:       time.Now(),
		BatchTime:        req.BatchTime,
	}
	if err := s.memberRepo.Create(member); err != nil {
		s.logger.Error("create member failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	s.audit(createdByUserID, "member.create", "member", member.ID, nil, nil, ipAddress)

	// Send welcome notification.
	if user != nil {
		go s.notifSvc.Dispatch(WelcomeEvent(user.ID, req.FirstName))
	}

	return toMemberResponse(member, userInfo), nil
}

func (s *memberService) GetByID(id uint, requesterID uint, requesterRole string) (*models.Member, error) {
	m, err := s.memberRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if m == nil {
		return nil, apperrors.ErrMemberNotFound
	}
	// Members can only view their own profile.
	if requesterRole == "member" && m.UserID != requesterID {
		return nil, apperrors.ErrPermissionDenied
	}
	return m, nil
}

func (s *memberService) GetByUserID(userID uint) (*models.Member, error) {
	m, err := s.memberRepo.FindByUserID(userID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if m == nil {
		return nil, apperrors.ErrMemberNotFound
	}
	return m, nil
}

func (s *memberService) Update(memberID uint, req UpdateMemberRequest, updaterID uint, ipAddress string) (*models.Member, error) {
	m, err := s.memberRepo.FindByID(memberID)
	if err != nil || m == nil {
		return nil, apperrors.ErrMemberNotFound
	}

	// Capture old values for audit.
	oldValues := models.JSONMap{
		"first_name": m.User.FirstName,
		"last_name":  m.User.LastName,
		"phone":      m.User.Phone,
	}

	// Update user fields.
	user, err := s.userRepo.FindByID(m.UserID)
	if err != nil || user == nil {
		return nil, apperrors.ErrInternal
	}
	if req.FirstName != "" {
		user.FirstName = req.FirstName
	}
	if req.LastName != "" {
		user.LastName = req.LastName
	}
	if req.Phone != "" {
		user.Phone = req.Phone
	}
	if req.HeightCm != nil {
		user.HeightCm = req.HeightCm
	}
	if req.WeightKg != nil {
		user.WeightKg = req.WeightKg
	}
	if req.EmergencyContactName != "" {
		user.EmergencyContactName = req.EmergencyContactName
	}
	if req.EmergencyContactPhone != "" {
		user.EmergencyContactPhone = req.EmergencyContactPhone
	}
	if req.EmergencyContactRelationship != "" {
		user.EmergencyContactRelationship = req.EmergencyContactRelationship
	}
	if req.Gender != "" {
		user.Gender = &req.Gender
	}
	if dob := parseDateOfBirth(req.DateOfBirth); dob != nil {
		user.DateOfBirth = dob
	}
	if err := s.userRepo.Update(user); err != nil {
		return nil, apperrors.ErrInternal
	}

	// Update member fields.
	if req.HealthDeclaration != nil {
		m.HealthDeclaration = req.HealthDeclaration
	}
	if req.MemberNotes != "" {
		m.MemberNotes = req.MemberNotes
	}
	if req.MemberTags != nil {
		m.MemberTags = req.MemberTags
	}
	if req.BatchTime != "" {
		m.BatchTime = req.BatchTime
	}
	if err := s.memberRepo.Update(m); err != nil {
		return nil, apperrors.ErrInternal
	}

	s.audit(updaterID, "member.update", "member", memberID, oldValues, nil, ipAddress)

	// Reload with associations.
	return s.memberRepo.FindByID(memberID)
}

func (s *memberService) SoftDelete(memberID uint, reason string, deleterID uint, ipAddress string) error {
	m, err := s.memberRepo.FindByID(memberID)
	if err != nil || m == nil {
		return apperrors.ErrMemberNotFound
	}
	if err := s.userRepo.SoftDelete(m.UserID, reason); err != nil {
		return apperrors.ErrInternal
	}
	if err := s.memberRepo.UpdateStatus(memberID, models.MemberStatusCancelled); err != nil {
		return apperrors.ErrInternal
	}
	s.audit(deleterID, "member.delete", "member", memberID,
		models.JSONMap{"reason": reason}, nil, ipAddress)
	return nil
}

func (s *memberService) List(req utils.PageRequest, facilityID *uint) ([]*models.Member, int64, error) {
	return s.memberRepo.List(req, facilityID)
}

func (s *memberService) Freeze(memberID uint, months int, reason string, actorID uint) error {
	if months < 1 || months > 12 {
		return apperrors.ErrValidation("freeze duration must be between 1 and 12 months")
	}
	m, err := s.memberRepo.FindByID(memberID)
	if err != nil || m == nil {
		return apperrors.ErrMemberNotFound
	}
	if m.MembershipStatus != models.MemberStatusActive {
		return apperrors.New(http.StatusConflict, "MBR_010", "Cannot freeze", "Membership is not active")
	}
	if err := s.memberRepo.UpdateStatus(memberID, models.MemberStatusPaused); err != nil {
		return apperrors.ErrInternal
	}
	s.logger.Info("membership frozen", "member_id", memberID, "months", months, "reason", reason)
	go s.notifSvc.Dispatch(MemberFrozenEvent(m.User.ID, memberID, months))
	return nil
}

func (s *memberService) Unfreeze(memberID uint, actorID uint) error {
	m, err := s.memberRepo.FindByID(memberID)
	if err != nil || m == nil {
		return apperrors.ErrMemberNotFound
	}
	if m.MembershipStatus != models.MemberStatusPaused {
		return apperrors.New(http.StatusConflict, "MBR_011", "Cannot unfreeze", "Membership is not paused")
	}
	if err := s.memberRepo.UpdateStatus(memberID, models.MemberStatusActive); err != nil {
		return apperrors.ErrInternal
	}
	go s.notifSvc.Dispatch(MemberUnfrozenEvent(m.User.ID, memberID))
	return nil
}

func (s *memberService) AssignTrainer(memberID uint, trainerID *uint, trainerName string) error {
	m, err := s.memberRepo.FindByID(memberID)
	if err != nil || m == nil {
		return apperrors.ErrMemberNotFound
	}
	if err := s.memberRepo.AssignTrainer(memberID, trainerID); err != nil {
		s.logger.Error("assign trainer failed", "member_id", memberID, "err", err)
		return apperrors.ErrInternal
	}
	if trainerID != nil {
		go s.notifSvc.Dispatch(TrainerAssignedEvent(m.User.ID, memberID, trainerName))
	}
	return nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func toMemberResponse(m *models.Member, u *UserInfo) *MemberResponse {
	return &MemberResponse{
		ID:               m.ID,
		MemberCode:       m.MemberCode,
		MembershipStatus: m.MembershipStatus,
		JoinedDate:       m.JoinedDate,
		CurrentPlanID:    m.CurrentPlanID,
		User:             u,
		FacilityID:       m.FacilityID,
	}
}

func (s *memberService) audit(userID uint, action, resourceType string, resourceID uint, old, new models.JSONMap, ip string) {
	rid := resourceID
	_ = s.auditRepo.Create(&models.AuditLog{
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   &rid,
		OldValues:    old,
		NewValues:    new,
		IPAddress:    ip,
	})
}
