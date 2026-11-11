package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/middleware"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

func facilityIDFromContext(r *http.Request) uint {
	_ = middleware.ClaimsFromContext(r.Context()) // ensure import used
	return 1 // single-facility app
}

func actorIDFromContext(r *http.Request) uint {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims != nil {
		return claims.UserID
	}
	return 0
}

type StaffAttendanceHandler struct {
	svc services.StaffAttendanceService
}

func NewStaffAttendanceHandler(svc services.StaffAttendanceService) *StaffAttendanceHandler {
	return &StaffAttendanceHandler{svc: svc}
}

// POST /api/v1/staff/{id}/attendance
func (h *StaffAttendanceHandler) MarkAttendance(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}

	facilityID := facilityIDFromContext(r)
	actorID := actorIDFromContext(r)

	var req services.MarkAttendanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	a, err := h.svc.MarkAttendance(facilityID, staffID, actorID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, a)
}

// GET /api/v1/staff/{id}/attendance?month=11&year=2026
func (h *StaffAttendanceHandler) ListByStaff(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))

	list, err := h.svc.ListByStaff(staffID, month, year)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// GET /api/v1/staff/attendance?date=2026-11-12
func (h *StaffAttendanceHandler) ListByDate(w http.ResponseWriter, r *http.Request) {
	facilityID := facilityIDFromContext(r)
	date := r.URL.Query().Get("date")
	list, err := h.svc.ListByDate(facilityID, date)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// GET /api/v1/staff/attendance/monthly?month=11&year=2026
func (h *StaffAttendanceHandler) ListByMonth(w http.ResponseWriter, r *http.Request) {
	facilityID := facilityIDFromContext(r)
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))

	list, err := h.svc.ListByMonth(facilityID, month, year)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// POST /api/v1/staff/{id}/salary-slip?month=11&year=2026
func (h *StaffAttendanceHandler) GenerateSalarySlip(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	facilityID := facilityIDFromContext(r)
	actorID := actorIDFromContext(r)

	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}

	var req services.GenerateSlipRequest
	if r.ContentLength > 0 {
		json.NewDecoder(r.Body).Decode(&req)
	}

	slip, err := h.svc.GenerateSalarySlip(facilityID, staffID, actorID, month, year, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, slip)
}

// GET /api/v1/staff/{id}/salary-slip?month=11&year=2026
func (h *StaffAttendanceHandler) GetSalarySlip(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}

	slip, err := h.svc.GetSalarySlipByStaff(staffID, month, year)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if slip == nil {
		response.JSON(w, r, http.StatusOK, nil)
		return
	}
	response.JSON(w, r, http.StatusOK, slip)
}

// GET /api/v1/staff/salary-slips?month=11&year=2026
func (h *StaffAttendanceHandler) ListSalarySlips(w http.ResponseWriter, r *http.Request) {
	facilityID := facilityIDFromContext(r)
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))

	list, err := h.svc.ListSalarySlips(facilityID, month, year)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// PATCH /api/v1/staff/salary-slips/{id}/status
func (h *StaffAttendanceHandler) UpdateSlipStatus(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id64, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid slip id"))
		return
	}

	var body struct {
		Status string     `json:"status"`
		PaidAt *time.Time `json:"paid_at,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if body.Status == "" {
		response.Error(w, r, apperrors.ErrValidation("status is required"))
		return
	}

	slip, err := h.svc.UpdateSlipStatus(uint(id64), body.Status, body.PaidAt)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, slip)
}

// GET /api/v1/staff/{id}/salary-slips/history
func (h *StaffAttendanceHandler) ListSlipsByStaff(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	facilityID := facilityIDFromContext(r)

	list, err := h.svc.ListSlipsByStaff(facilityID, staffID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}
