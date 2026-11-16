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

	scanRequestedMu sync.Mutex
	scanRequested   bool
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

// POST /api/v1/biometric/request-scan  (auth required)
// Frontend calls this when the link-device modal opens so the ADMS server
// knows to immediately command the device to push its latest scan.
func (h *BiometricHandler) RequestScan(w http.ResponseWriter, r *http.Request) {
	scanRequestedMu.Lock()
	scanRequested = true
	scanRequestedMu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/biometric/scan-requested  (no auth — internal ADMS call)
// Returns {"requested":true} and clears the flag so only one ATTLOG pull fires.
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
