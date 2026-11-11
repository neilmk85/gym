package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type FacilityHandler struct {
	facilitySvc services.FacilityService
}

func NewFacilityHandler(facilitySvc services.FacilityService) *FacilityHandler {
	return &FacilityHandler{facilitySvc: facilitySvc}
}

// POST /api/v1/facilities
func (h *FacilityHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req services.CreateFacilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	facility, err := h.facilitySvc.Create(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, facility)
}

// GET /api/v1/facilities
func (h *FacilityHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	facilities, total, err := h.facilitySvc.List(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"facilities": facilities,
		"meta":       utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/facilities/{id}
func (h *FacilityHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid facility id"))
		return
	}

	facility, err := h.facilitySvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, facility)
}

// PATCH /api/v1/facilities/{id}
func (h *FacilityHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid facility id"))
		return
	}

	var req services.UpdateFacilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	facility, err := h.facilitySvc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, facility)
}
