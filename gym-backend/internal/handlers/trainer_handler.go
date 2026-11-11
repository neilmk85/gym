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

type TrainerHandler struct {
	trainerSvc services.TrainerService
}

func NewTrainerHandler(trainerSvc services.TrainerService) *TrainerHandler {
	return &TrainerHandler{trainerSvc: trainerSvc}
}

// POST /api/v1/trainers
func (h *TrainerHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateTrainerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	trainer, err := h.trainerSvc.Create(req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, trainer)
}

// GET /api/v1/trainers
func (h *TrainerHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var facilityID *uint
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		id, err := strconv.ParseUint(fid, 10, 64)
		if err == nil {
			uid := uint(id)
			facilityID = &uid
		}
	}
	activeOnly := r.URL.Query().Get("active_only") != "false"

	trainers, total, err := h.trainerSvc.List(req, facilityID, activeOnly)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"trainers": trainers,
		"meta":     utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/trainers/{id}
func (h *TrainerHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}

	trainer, err := h.trainerSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, trainer)
}

// GET /api/v1/trainers/me  — trainer views their own profile
func (h *TrainerHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	trainer, err := h.trainerSvc.GetByUserID(claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, trainer)
}

// PATCH /api/v1/trainers/{id}
func (h *TrainerHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.UpdateTrainerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	trainer, err := h.trainerSvc.Update(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, trainer)
}

// DELETE /api/v1/trainers/{id}
func (h *TrainerHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.trainerSvc.Deactivate(id, claims.UserID, r.RemoteAddr); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Trainer deactivated"})
}

// GET /api/v1/trainers/{id}/schedule
func (h *TrainerHandler) GetSchedule(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}
	shifts, err := h.trainerSvc.GetSchedule(trainerID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{"shifts": shifts})
}

// POST /api/v1/trainers/{id}/schedule
func (h *TrainerHandler) CreateShift(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreateShiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	shift, err := h.trainerSvc.CreateShift(trainerID, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, shift)
}

// PATCH /api/v1/trainers/{id}/schedule/{shift_id}
func (h *TrainerHandler) UpdateShift(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}
	shiftID, err := pathUint(r, "shift_id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid shift id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.UpdateShiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	shift, err := h.trainerSvc.UpdateShift(trainerID, shiftID, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, shift)
}

// DELETE /api/v1/trainers/{id}/schedule/{shift_id}
func (h *TrainerHandler) DeleteShift(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}
	shiftID, err := pathUint(r, "shift_id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid shift id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.trainerSvc.DeleteShift(trainerID, shiftID, claims.UserID, r.RemoteAddr); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Shift deleted"})
}

// GET /api/v1/trainers/{id}/classes
func (h *TrainerHandler) ListClasses(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}

	req := utils.ParsePageRequest(r)
	status := r.URL.Query().Get("status")

	classes, total, err := h.trainerSvc.ListClasses(trainerID, req, status)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]any{
		"classes": classes,
		"meta":    utils.BuildPageMeta(req, total),
	})
}
