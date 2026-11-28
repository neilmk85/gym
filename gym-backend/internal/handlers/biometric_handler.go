package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
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

	// Enrollment state
	enrollIDCounter  uint32 = 50000
	enrollMu         sync.Mutex
	pendingEnrollVal *enrollReq
	lastEnrollResult *enrollRes

	// Delete state — queue a device_user_id for removal from the physical device
	deleteMu              sync.Mutex
	pendingDeleteDeviceID string

	// Sync state — queue a name update for a device_user_id
	syncMu          sync.Mutex
	pendingSyncVal  *syncReq
)

type syncReq struct {
	DeviceUserID string
	Name         string
}

type enrollReq struct {
	DeviceUserID    string
	SubjectName     string // first + last name, used for C:DATA UPD USERINFO
	SubjectType     string // "member" | "staff" | "trainer"
	SubjectID       uint
	RequestedAt     time.Time
	UserInfoSentAt  time.Time // when we sent C:DATA UPD USERINFO to create the slot
	EnrollSentAt    time.Time // when we sent C:ENROLL_FP
}

type enrollRes struct {
	DeviceUserID string
	Success      bool
	CompletedAt  time.Time
}

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

// POST /api/v1/biometric/enroll  (auth required)
// Frontend calls this when admin wants to enroll a new member/staff fingerprint.
// Returns the device_user_id that will be used for enrollment.
func (h *BiometricHandler) RequestEnroll(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SubjectType string `json:"subject_type"` // "member" | "staff" | "trainer"
		SubjectID   uint   `json:"subject_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SubjectID == 0 || req.SubjectType == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	// Look up the subject's name so ADMS can create the user slot on the device.
	subjectName := ""
	if req.SubjectType == "member" {
		if m, err := h.memberRepo.FindByID(req.SubjectID); err == nil && m != nil {
			subjectName = fmt.Sprintf("%s %s", m.User.FirstName, m.User.LastName)
		}
	}

	deviceUserID := fmt.Sprintf("%d", atomic.AddUint32(&enrollIDCounter, 1))

	enrollMu.Lock()
	pendingEnrollVal = &enrollReq{
		DeviceUserID: deviceUserID,
		SubjectName:  subjectName,
		SubjectType:  req.SubjectType,
		SubjectID:    req.SubjectID,
		RequestedAt:  time.Now(),
	}
	lastEnrollResult = nil
	enrollMu.Unlock()

	response.JSON(w, r, http.StatusOK, map[string]string{
		"device_user_id": deviceUserID,
		"status":         "pending",
	})
}

// GET /api/v1/biometric/enroll-requested  (no auth — ADMS internal)
// Two-phase: first returns a "create_user" command so the device has the user slot,
// then on next poll (after 5s) returns "enroll_fp" to start fingerprint capture.
func (h *BiometricHandler) EnrollRequested(w http.ResponseWriter, r *http.Request) {
	enrollMu.Lock()
	req := pendingEnrollVal
	var phase string
	if req != nil {
		if req.UserInfoSentAt.IsZero() {
			// Phase 1: create the user slot on the device.
			req.UserInfoSentAt = time.Now()
			phase = "create_user"
		} else if !req.EnrollSentAt.IsZero() && time.Since(req.EnrollSentAt) < 60*time.Second {
			// Enrollment command already sent recently — don't re-trigger.
			phase = ""
		} else if time.Since(req.UserInfoSentAt) >= 5*time.Second {
			// Phase 2: user slot created, now enroll the fingerprint.
			req.EnrollSentAt = time.Now()
			phase = "enroll_fp"
		}
	}
	var snap *enrollReq
	if req != nil {
		cp := *req
		snap = &cp
	}
	enrollMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	if snap == nil || phase == "" {
		w.Write([]byte(`{"requested":false}`))
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"requested":      true,
		"phase":          phase,
		"device_user_id": snap.DeviceUserID,
		"subject_name":   snap.SubjectName,
		"finger":         0,
	})
}

// POST /api/v1/biometric/enroll-complete  (no auth — ADMS internal)
// ADMS calls this when the device reports enrollment done or failed.
func (h *BiometricHandler) EnrollComplete(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DeviceUserID string `json:"device_user_id"`
		Success      bool   `json:"success"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	enrollMu.Lock()
	pending := pendingEnrollVal
	if pending != nil && pending.DeviceUserID == req.DeviceUserID {
		pendingEnrollVal = nil
	}
	lastEnrollResult = &enrollRes{
		DeviceUserID: req.DeviceUserID,
		Success:      req.Success,
		CompletedAt:  time.Now(),
	}
	enrollMu.Unlock()

	if req.Success && pending != nil && pending.DeviceUserID == req.DeviceUserID {
		go h.persistEnroll(pending.SubjectType, pending.SubjectID, req.DeviceUserID)
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/biometric/enroll-status  (auth required)
// Frontend polls this to know when enrollment is complete.
func (h *BiometricHandler) EnrollStatus(w http.ResponseWriter, r *http.Request) {
	enrollMu.Lock()
	pending := pendingEnrollVal
	result := lastEnrollResult
	enrollMu.Unlock()

	if result != nil && time.Since(result.CompletedAt) < 10*time.Minute {
		response.JSON(w, r, http.StatusOK, map[string]any{
			"status":         "done",
			"success":        result.Success,
			"device_user_id": result.DeviceUserID,
		})
		return
	}
	if pending != nil {
		response.JSON(w, r, http.StatusOK, map[string]any{
			"status":         "pending",
			"device_user_id": pending.DeviceUserID,
		})
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{"status": "none"})
}

// POST /api/v1/biometric/delete-device-user  (auth required)
// Frontend calls this when unlinking a member/staff/trainer so the ADMS
// server can send C:DATA DEL USERINFO to wipe the user slot from the device.
func (h *BiometricHandler) QueueDeleteDeviceUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DeviceUserID string `json:"device_user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DeviceUserID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	deleteMu.Lock()
	pendingDeleteDeviceID = req.DeviceUserID
	deleteMu.Unlock()
	h.logger.Info("device delete queued", "device_user_id", req.DeviceUserID)
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/biometric/delete-requested  (no auth — ADMS internal)
// ADMS polls this; if a delete is queued it returns the device_user_id once
// and clears the queue so the command is only sent once.
func (h *BiometricHandler) DeleteRequested(w http.ResponseWriter, r *http.Request) {
	deleteMu.Lock()
	id := pendingDeleteDeviceID
	pendingDeleteDeviceID = ""
	deleteMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	if id == "" {
		w.Write([]byte(`{"requested":false}`))
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"requested":      true,
		"device_user_id": id,
	})
}

// POST /api/v1/biometric/sync-device-user  (no auth — internal or admin)
// Queues a C:DATA UPD USERINFO command so the device shows the correct name.
func (h *BiometricHandler) QueueSyncDeviceUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DeviceUserID string `json:"device_user_id"`
		Name         string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DeviceUserID == "" || req.Name == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	syncMu.Lock()
	pendingSyncVal = &syncReq{DeviceUserID: req.DeviceUserID, Name: req.Name}
	syncMu.Unlock()
	h.logger.Info("device sync queued", "device_user_id", req.DeviceUserID, "name", req.Name)
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/biometric/sync-device-user-requested  (no auth — ADMS internal)
func (h *BiometricHandler) SyncDeviceUserRequested(w http.ResponseWriter, r *http.Request) {
	syncMu.Lock()
	val := pendingSyncVal
	pendingSyncVal = nil
	syncMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	if val == nil {
		w.Write([]byte(`{"requested":false}`))
		return
	}
	json.NewEncoder(w).Encode(map[string]any{
		"requested":      true,
		"device_user_id": val.DeviceUserID,
		"name":           val.Name,
	})
}

func (h *BiometricHandler) persistEnroll(subjectType string, subjectID uint, deviceUserID string) {
	switch subjectType {
	case "member":
		if err := h.memberRepo.UpdateDeviceUserID(subjectID, &deviceUserID); err != nil {
			h.logger.Error("enroll: link member failed", "member_id", subjectID, "err", err)
		} else {
			h.logger.Info("enroll: member linked", "member_id", subjectID, "device_user_id", deviceUserID)
		}
	default:
		h.logger.Warn("enroll: unhandled subject type", "type", subjectType, "id", subjectID)
	}
}
