package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/response"
)

type GymSettingsHandler struct {
	settingRepo    repositories.GymSettingRepository
	expiredScanRepo repositories.ExpiredScanRepository
	memberRepo     repositories.MemberRepository
	logger         *slog.Logger
}

func NewGymSettingsHandler(
	settingRepo repositories.GymSettingRepository,
	expiredScanRepo repositories.ExpiredScanRepository,
	memberRepo repositories.MemberRepository,
	logger *slog.Logger,
) *GymSettingsHandler {
	return &GymSettingsHandler{
		settingRepo:    settingRepo,
		expiredScanRepo: expiredScanRepo,
		memberRepo:     memberRepo,
		logger:         logger,
	}
}

// GET /api/v1/settings/biometric  (super admin only)
func (h *GymSettingsHandler) GetBiometricSettings(w http.ResponseWriter, r *http.Request) {
	autoUnlink, err := h.settingRepo.Get("auto_unlink_expired")
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"auto_unlink_expired": autoUnlink == "true",
	})
}

// PATCH /api/v1/settings/biometric  (super admin only)
func (h *GymSettingsHandler) UpdateBiometricSettings(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AutoUnlinkExpired *bool `json:"auto_unlink_expired"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if body.AutoUnlinkExpired != nil {
		val := "false"
		if *body.AutoUnlinkExpired {
			val = "true"
		}
		if err := h.settingRepo.Set("auto_unlink_expired", val); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/biometric/expired-scans  (super admin only)
// Returns stats on expired members who tried to scan.
func (h *GymSettingsHandler) GetExpiredScanStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.expiredScanRepo.Stats()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if stats == nil {
		stats = []*repositories.ExpiredScanStat{}
	}
	response.JSON(w, r, http.StatusOK, map[string]any{"data": stats})
}

// LogExpiredScan records a scan from an expired/cancelled member.
// Called from biometric_handler.go persistScan.
func (h *GymSettingsHandler) LogExpiredScan(member *models.Member) {
	id := uint(member.ID)
	facilityID := member.FacilityID
	name := member.User.FullName()
	attempt := &models.ExpiredScanAttempt{
		DeviceUserID: *member.DeviceUserID,
		MemberID:     &id,
		MemberName:   name,
		ScannedAt:    time.Now(),
		FacilityID:   &facilityID,
	}
	if err := h.expiredScanRepo.Log(attempt); err != nil {
		h.logger.Error("failed to log expired scan attempt", "member_id", member.ID, "err", err)
	}
}

// RunAutoUnlinkExpired is a background goroutine that runs hourly.
// When auto_unlink_expired is enabled, it finds all expired members
// who still have a device_user_id and queues their device deletion.
func (h *GymSettingsHandler) RunAutoUnlinkExpired(biometricH *BiometricHandler) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		h.autoUnlinkExpiredOnce(biometricH)
	}
}

func (h *GymSettingsHandler) autoUnlinkExpiredOnce(biometricH *BiometricHandler) {
	enabled, err := h.settingRepo.Get("auto_unlink_expired")
	if err != nil || enabled != "true" {
		return
	}

	members, err := h.memberRepo.FindAllWithDeviceUserID()
	if err != nil {
		h.logger.Error("auto-unlink: FindAllWithDeviceUserID failed", "err", err)
		return
	}

	for _, m := range members {
		if m.MembershipStatus != models.MemberStatusExpired &&
			m.MembershipStatus != models.MemberStatusCancelled {
			continue
		}
		if m.DeviceUserID == nil || *m.DeviceUserID == "" {
			continue
		}
		deviceID := *m.DeviceUserID
		h.logger.Info("auto-unlink: expired member", "member_id", m.ID, "device_user_id", deviceID)

		// Queue two-phase device delete.
		biometricH.queueDelete(deviceID)

		// Clear device_user_id in the system.
		empty := ""
		if err := h.memberRepo.UpdateDeviceUserID(m.ID, &empty); err != nil {
			h.logger.Error("auto-unlink: UpdateDeviceUserID failed", "member_id", m.ID, "err", err)
		}
	}
}
