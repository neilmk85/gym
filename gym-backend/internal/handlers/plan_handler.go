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

type PlanHandler struct {
	planSvc services.PlanService
}

func NewPlanHandler(planSvc services.PlanService) *PlanHandler {
	return &PlanHandler{planSvc: planSvc}
}

// POST /api/v1/plans
func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	plan, err := h.planSvc.Create(req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, plan)
}

// GET /api/v1/plans
func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
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

	plans, total, err := h.planSvc.List(req, facilityID, activeOnly)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"plans": plans,
		"meta":  utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/plans/{id}
func (h *PlanHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid plan id"))
		return
	}

	plan, err := h.planSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, plan)
}

// PATCH /api/v1/plans/{id}
func (h *PlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid plan id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.UpdatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	plan, err := h.planSvc.Update(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, plan)
}

// DELETE /api/v1/plans/{id}
func (h *PlanHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid plan id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.planSvc.Deactivate(id, claims.UserID, r.RemoteAddr); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Plan deactivated"})
}

// POST /api/v1/plans/{id}/activate
func (h *PlanHandler) Activate(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid plan id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.planSvc.Activate(id, claims.UserID, r.RemoteAddr); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Plan activated"})
}
