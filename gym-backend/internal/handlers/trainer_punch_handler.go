package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/response"
	"gorm.io/gorm"
)

type TrainerPunchHandler struct{ db *gorm.DB }

func NewTrainerPunchHandler(db *gorm.DB) *TrainerPunchHandler { return &TrainerPunchHandler{db: db} }

// POST /api/v1/trainer-punches  (no-auth — called by ADMS on same VPS)
func (h *TrainerPunchHandler) RecordPunch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		TrainerID        uint   `json:"trainer_id"`
		FacilityID       uint   `json:"facility_id"`
		PunchedAt        string `json:"punched_at"`         // device clock, RFC3339
		ServerReceivedAt string `json:"server_received_at"` // ADMS server clock, RFC3339
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.TrainerID == 0 {
		response.Error(w, r, apperrors.ErrValidation("invalid body"))
		return
	}

	ts, err := time.Parse(time.RFC3339, body.PunchedAt)
	if err != nil {
		ts, err = time.ParseInLocation("2006-01-02 15:04:05", body.PunchedAt, time.Local)
		if err != nil {
			response.Error(w, r, apperrors.ErrValidation("invalid punched_at"))
			return
		}
	}

	serverTs, err := time.Parse(time.RFC3339, body.ServerReceivedAt)
	if err != nil {
		serverTs = time.Now().UTC()
	}

	facilityID := body.FacilityID
	if facilityID == 0 {
		facilityID = 1
	}

	punch := models.TrainerPunch{
		TrainerID:        body.TrainerID,
		FacilityID:       facilityID,
		PunchedAt:        ts,
		ServerReceivedAt: serverTs,
	}
	if err := h.db.Create(&punch).Error; err != nil {
		response.Error(w, r, apperrors.ErrInternal)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GET /api/v1/trainers/device-mappings  (no-auth — called by ADMS)
// Returns { "10025": 1, "10026": 2, ... }  device_user_id → trainer_id
func (h *TrainerPunchHandler) DeviceMappings(w http.ResponseWriter, r *http.Request) {
	var trainers []models.TrainerProfile
	if err := h.db.Where("device_user_id IS NOT NULL").Find(&trainers).Error; err != nil {
		response.Error(w, r, apperrors.ErrInternal)
		return
	}
	m := make(map[string]uint, len(trainers))
	for _, t := range trainers {
		if t.DeviceUserID != nil && *t.DeviceUserID != "" {
			m[*t.DeviceUserID] = t.ID
		}
	}
	response.JSON(w, r, http.StatusOK, m)
}

// GET /api/v1/trainers/{id}/punches?month=2026-11  (auth required)
// Returns punches grouped by date.
func (h *TrainerPunchHandler) GetPunches(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	trainerID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || trainerID == 0 {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}

	monthStr := r.URL.Query().Get("month") // "2026-11"
	if monthStr == "" {
		monthStr = time.Now().Format("2006-01")
	}
	month, err := time.Parse("2006-01", monthStr)
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("month must be YYYY-MM"))
		return
	}
	ist, _ := time.LoadLocation("Asia/Kolkata")
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, ist)
	end := start.AddDate(0, 1, 0)

	var punches []models.TrainerPunch
	if err := h.db.
		Where("trainer_id = ? AND punched_at >= ? AND punched_at < ?", trainerID, start, end).
		Order("punched_at ASC").
		Find(&punches).Error; err != nil {
		response.Error(w, r, apperrors.ErrInternal)
		return
	}

	type PunchEntry struct {
		PunchedAt        string `json:"punched_at"`         // device clock, RFC3339
		ServerReceivedAt string `json:"server_received_at"` // server clock, RFC3339
	}
	type DayEntry struct {
		Date      string       `json:"date"`
		Punches   []PunchEntry `json:"punches"`
		DutyHours float64      `json:"duty_hours"`
	}
	dayMap := make(map[string]*DayEntry)
	for _, p := range punches {
		d := p.PunchedAt.In(ist).Format("2006-01-02")
		if _, ok := dayMap[d]; !ok {
			dayMap[d] = &DayEntry{Date: d}
		}
		dayMap[d].Punches = append(dayMap[d].Punches, PunchEntry{
			PunchedAt:        p.PunchedAt.UTC().Format(time.RFC3339),
			ServerReceivedAt: p.ServerReceivedAt.UTC().Format(time.RFC3339),
		})
	}
	// Compute duty hours
	for _, entry := range dayMap {
		if len(entry.Punches) >= 2 {
			var first, last time.Time
			for _, p := range punches {
				d := p.PunchedAt.In(ist).Format("2006-01-02")
				if d != entry.Date {
					continue
				}
				if first.IsZero() || p.PunchedAt.Before(first) {
					first = p.PunchedAt
				}
				if last.IsZero() || p.PunchedAt.After(last) {
					last = p.PunchedAt
				}
			}
			if !first.IsZero() && !last.IsZero() && last.After(first) {
				hours := last.Sub(first).Hours()
				entry.DutyHours = float64(int(hours*100+0.5)) / 100
			}
		}
	}

	// Sort by date
	days := make([]*DayEntry, 0, len(dayMap))
	for _, d := range dayMap {
		days = append(days, d)
	}
	for i := 1; i < len(days); i++ {
		for j := i; j > 0 && days[j].Date < days[j-1].Date; j-- {
			days[j], days[j-1] = days[j-1], days[j]
		}
	}

	response.JSON(w, r, http.StatusOK, days)
}
