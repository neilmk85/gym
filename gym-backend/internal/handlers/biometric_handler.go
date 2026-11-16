package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

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
)

type BiometricHandler struct{}

func NewBiometricHandler() *BiometricHandler { return &BiometricHandler{} }

// POST /api/v1/biometric/notify-scan  (no auth — internal ADMS call on same VPS)
func (h *BiometricHandler) NotifyScan(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DeviceUserID string `json:"device_user_id"`
		Name         string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.DeviceUserID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	lastScanMu.Lock()
	lastScanVal = &lastScanEntry{
		DeviceUserID: req.DeviceUserID,
		Name:         req.Name,
		ScannedAt:    time.Now(),
	}
	lastScanMu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/biometric/last-scan  (auth required)
func (h *BiometricHandler) GetLastScan(w http.ResponseWriter, r *http.Request) {
	lastScanMu.RLock()
	scan := lastScanVal
	lastScanMu.RUnlock()
	response.JSON(w, r, http.StatusOK, scan)
}
