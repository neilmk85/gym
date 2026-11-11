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

type ClassHandler struct {
	classSvc services.ClassService
}

func NewClassHandler(classSvc services.ClassService) *ClassHandler {
	return &ClassHandler{classSvc: classSvc}
}

// POST /api/v1/classes
func (h *ClassHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateClassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	class, err := h.classSvc.Create(req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, class)
}

// GET /api/v1/classes
func (h *ClassHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var facilityID *uint
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		id, err := strconv.ParseUint(fid, 10, 64)
		if err == nil {
			uid := uint(id)
			facilityID = &uid
		}
	}

	var trainerID *uint
	if tid := r.URL.Query().Get("trainer_id"); tid != "" {
		id, err := strconv.ParseUint(tid, 10, 64)
		if err == nil {
			uid := uint(id)
			trainerID = &uid
		}
	}

	status := r.URL.Query().Get("status")
	date := r.URL.Query().Get("date") // yyyy-MM-dd — filters classes whose start_time falls on that day

	classes, total, err := h.classSvc.List(req, facilityID, trainerID, status, date)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"classes": classes,
		"meta":    utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/classes/upcoming?facility_id=1&limit=10
func (h *ClassHandler) Upcoming(w http.ResponseWriter, r *http.Request) {
	facilityID := uint(0)
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		id, err := strconv.ParseUint(fid, 10, 64)
		if err == nil {
			facilityID = uint(id)
		}
	}
	if facilityID == 0 {
		response.Error(w, r, apperrors.ErrValidation("facility_id is required"))
		return
	}

	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}

	classes, err := h.classSvc.ListUpcoming(facilityID, limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{"classes": classes})
}

// GET /api/v1/classes/{id}
func (h *ClassHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid class id"))
		return
	}

	class, err := h.classSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, class)
}

// PATCH /api/v1/classes/{id}
func (h *ClassHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid class id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.UpdateClassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	class, err := h.classSvc.Update(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, class)
}

// DELETE /api/v1/classes/{id}
func (h *ClassHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid class id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.classSvc.Cancel(id, claims.UserID, r.RemoteAddr); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Class cancelled"})
}
