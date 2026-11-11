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

type PurchaseHandler struct {
	svc services.PurchaseService
}

func NewPurchaseHandler(svc services.PurchaseService) *PurchaseHandler {
	return &PurchaseHandler{svc: svc}
}

// POST /api/v1/purchases
func (h *PurchaseHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreatePurchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	p, err := h.svc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, p)
}

// GET /api/v1/purchases
func (h *PurchaseHandler) List(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	status := r.URL.Query().Get("status")
	paymentStatus := r.URL.Query().Get("payment_status")
	var vendorID *uint
	if vid := r.URL.Query().Get("vendor_id"); vid != "" {
		if n, err := strconv.ParseUint(vid, 10, 64); err == nil {
			v := uint(n)
			vendorID = &v
		}
	}
	list, total, err := h.svc.List(status, paymentStatus, vendorID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/purchases/{id}
func (h *PurchaseHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid purchase id"))
		return
	}
	p, err := h.svc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, p)
}

// PATCH /api/v1/purchases/{id}
func (h *PurchaseHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid purchase id"))
		return
	}
	var req services.UpdatePurchaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	p, err := h.svc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, p)
}

// DELETE /api/v1/purchases/{id}
func (h *PurchaseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid purchase id"))
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}
