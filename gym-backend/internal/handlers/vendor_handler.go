package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type VendorHandler struct {
	svc services.VendorService
}

func NewVendorHandler(svc services.VendorService) *VendorHandler {
	return &VendorHandler{svc: svc}
}

// POST /api/v1/vendors
func (h *VendorHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req services.CreateVendorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	v, err := h.svc.Create(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, v)
}

// GET /api/v1/vendors
func (h *VendorHandler) List(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	status := r.URL.Query().Get("status")
	category := r.URL.Query().Get("category")
	search := r.URL.Query().Get("search")
	list, total, err := h.svc.List(status, category, search, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/vendors/{id}
func (h *VendorHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid vendor id"))
		return
	}
	v, err := h.svc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, v)
}

// PATCH /api/v1/vendors/{id}
func (h *VendorHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid vendor id"))
		return
	}
	var req services.UpdateVendorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	v, err := h.svc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, v)
}

// DELETE /api/v1/vendors/{id}
func (h *VendorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid vendor id"))
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}
