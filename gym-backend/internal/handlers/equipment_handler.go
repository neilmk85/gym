package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type EquipmentHandler struct {
	svc services.EquipmentService
}

func NewEquipmentHandler(svc services.EquipmentService) *EquipmentHandler {
	return &EquipmentHandler{svc: svc}
}

// POST /api/v1/equipment
func (h *EquipmentHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req services.CreateEquipmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	e, err := h.svc.Create(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, e)
}

// GET /api/v1/equipment
func (h *EquipmentHandler) List(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	condition := r.URL.Query().Get("condition")
	category := r.URL.Query().Get("category")
	search := r.URL.Query().Get("search")
	list, total, err := h.svc.List(condition, category, search, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/equipment/{id}
func (h *EquipmentHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid equipment id"))
		return
	}
	e, err := h.svc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, e)
}

// PATCH /api/v1/equipment/{id}
func (h *EquipmentHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid equipment id"))
		return
	}
	var req services.UpdateEquipmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	e, err := h.svc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, e)
}

// DELETE /api/v1/equipment/{id}
func (h *EquipmentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid equipment id"))
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}
