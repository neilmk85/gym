package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/middleware"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type DayPassHandler struct {
	dayPassSvc services.DayPassService
}

func NewDayPassHandler(dayPassSvc services.DayPassService) *DayPassHandler {
	return &DayPassHandler{dayPassSvc: dayPassSvc}
}

// POST /api/v1/day-passes
func (h *DayPassHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateDayPassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	p, err := h.dayPassSvc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, p)
}

// GET /api/v1/day-passes/{id}
func (h *DayPassHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid day pass id"))
		return
	}

	p, err := h.dayPassSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, p)
}

// GET /api/v1/day-passes
// Query params: facility_id, status, date_from, date_to
func (h *DayPassHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var facilityID *uint
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		id, err := strconv.ParseUint(fid, 10, 64)
		if err == nil {
			uid := uint(id)
			facilityID = &uid
		}
	}

	status := r.URL.Query().Get("status")
	dateFrom := r.URL.Query().Get("date_from")
	dateTo := r.URL.Query().Get("date_to")

	passes, total, err := h.dayPassSvc.List(req, facilityID, status, dateFrom, dateTo)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"day_passes": passes,
		"meta":       utils.BuildPageMeta(req, total),
	})
}

// PATCH /api/v1/day-passes/{id}
func (h *DayPassHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid day pass id"))
		return
	}

	var req services.UpdateDayPassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	p, err := h.dayPassSvc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, p)
}

// DELETE /api/v1/day-passes/{id}
func (h *DayPassHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid day pass id"))
		return
	}

	if err := h.dayPassSvc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Day pass deleted"})
}

// POST /api/v1/day-passes/{id}/check-in
func (h *DayPassHandler) CheckIn(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid day pass id"))
		return
	}

	p, err := h.dayPassSvc.CheckIn(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, p)
}
