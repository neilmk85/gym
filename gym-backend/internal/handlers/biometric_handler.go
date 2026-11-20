package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/response"
)

type lastScanEntry struct {
	DeviceUserID string    `json:"device_user_id"`
	Name         string    `json:"name"`
	ScannedAt    time.Time `json:"scanned_at"`
}

var (
	lastScanMu  sync.RWMutex
	lastScanVal *lastScanEntry

	scanRequestedMu sync.Mutex
	scanRequested   bool
)

type BiometricHandler struct {
	memberRepo     repositories.MemberRepository
	attendanceRepo repositories.AttendanceRepository
	logger         *slog.Logger
}

func NewBiometricHandler(
	memberRepo repositories.MemberRepository,
	attendanceRepo repositories.AttendanceRepository,
	logger *slog.Logger,
) *BiometricHandler {
	return &BiometricHandler{
		memberRepo:     memberRepo,
		attendanceRepo: attendanceRepo,
		logger:         logger,
	}
}

// POST /api/v1/biometric/notify-scan  (no auth — internal ADMS call on same VPS)
// Receives a biometric scan event and persists it as an attendance check-in or check-out.
// Logic: if the member has an open check-in → check out; otherwise → check in.
func (h *BiometricHandler) NotifyScan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DeviceUserID string `json:"device_user_id"`
		Name         string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DeviceUserID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Update the in-memory last-scan for the live scan display.
	lastScanMu.Lock()
	lastScanVal = &lastScanEntry{
		DeviceUserID: req.DeviceUserID,
		Name:         req.Name,
		ScannedAt:    time.Now(),
	}
	lastScanMu.Unlock()

	// Persist the scan as an attendance record asynchronously so the ADMS
	// device gets an immediate response without waiting on DB writes.
	go h.persistScan(req.DeviceUserID)

	w.WriteHeader(http.StatusNoContent)
}

func (h *BiometricHandler) persistScan(deviceUserID string) {
	member, err := h.memberRepo.FindByDeviceUserID(deviceUserID)
	if err != nil || member == nil {
		h.logger.Warn("biometric scan: member not found", "device_user_id", deviceUserID)
		return
	}

	// Skip if membership is expired or cancelled.
	if member.MembershipStatus == models.MemberStatusExpired ||
		member.MembershipStatus == models.MemberStatusCancelled {
		h.logger.Info("biometric scan: member not active, skipping attendance", "member_id", member.ID)
		return
	}

	open, err := h.attendanceRepo.FindOpenCheckIn(member.ID)
	if err != nil {
		h.logger.Error("biometric scan: FindOpenCheckIn error", "member_id", member.ID, "err", err)
		return
	}

	now := time.Now()

	if open != nil {
		// Second scan on same day = check-out.
		open.CheckOutAt = &now
		durMins := int(now.Sub(open.CheckInAt).Minutes())
		open.DurationMins = &durMins
		if err := h.attendanceRepo.Update(open); err != nil {
			h.logger.Error("biometric scan: check-out failed", "attendance_id", open.ID, "err", err)
		} else {
			h.logger.Info("biometric scan: checked out", "member_id", member.ID, "duration_mins", durMins)
		}
		return
	}

	// No open check-in → create one.
	attendance := &models.Attendance{
		MemberID:   member.ID,
		FacilityID: member.FacilityID,
		CheckInAt:  now,
		Method:     models.CheckInMethodCard,
	}
	if err := h.attendanceRepo.Create(attendance); err != nil {
		h.logger.Error("biometric scan: check-in failed", "member_id", member.ID, "err", err)
	} else {
		h.logger.Info("biometric scan: checked in", "member_id", member.ID)
	}
}

// GET /api/v1/biometric/last-scan  (auth required)
func (h *BiometricHandler) GetLastScan(w http.ResponseWriter, r *http.Request) {
	lastScanMu.RLock()
	scan := lastScanVal
	lastScanMu.RUnlock()
	response.JSON(w, r, http.StatusOK, scan)
}

// POST /api/v1/biometric/request-scan  (auth required)
func (h *BiometricHandler) RequestScan(w http.ResponseWriter, r *http.Request) {
	scanRequestedMu.Lock()
	scanRequested = true
	scanRequestedMu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/biometric/scan-requested  (no auth — internal ADMS call)
func (h *BiometricHandler) ScanRequested(w http.ResponseWriter, r *http.Request) {
	scanRequestedMu.Lock()
	val := scanRequested
	scanRequested = false
	scanRequestedMu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	if val {
		w.Write([]byte(`{"requested":true}`))
	} else {
		w.Write([]byte(`{"requested":false}`))
	}
}
