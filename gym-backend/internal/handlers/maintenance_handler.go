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

type MaintenanceHandler struct {
	svc services.MaintenanceService
}

func NewMaintenanceHandler(svc services.MaintenanceService) *MaintenanceHandler {
	return &MaintenanceHandler{svc: svc}
}

// POST /api/v1/maintenance
func (h *MaintenanceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreateMaintenanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	t, err := h.svc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, t)
}

// GET /api/v1/maintenance
func (h *MaintenanceHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)
	q := r.URL.Query()

	var facilityID uint
	if v := q.Get("facility_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil {
			facilityID = uint(id)
		}
	}
	status := q.Get("status")
	category := q.Get("category")
	priority := q.Get("priority")

	tasks, total, err := h.svc.List(req, facilityID, status, category, priority)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	meta := utils.BuildPageMeta(req, total)
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"tasks": tasks,
		"meta":  meta,
	})
}

// GET /api/v1/maintenance/{id}
func (h *MaintenanceHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid id"))
		return
	}
	t, err := h.svc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, t)
}

// PATCH /api/v1/maintenance/{id}
func (h *MaintenanceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid id"))
		return
	}
	var req services.UpdateMaintenanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	t, err := h.svc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, t)
}

// DELETE /api/v1/maintenance/{id}
func (h *MaintenanceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid id"))
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "deleted"})
}

