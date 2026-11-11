package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/middleware"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type POSHandler struct {
	svc services.POSService
}

func NewPOSHandler(svc services.POSService) *POSHandler {
	return &POSHandler{svc: svc}
}

// POST /api/v1/pos/products
func (h *POSHandler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var req services.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	p, err := h.svc.CreateProduct(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, p)
}

// GET /api/v1/pos/products
func (h *POSHandler) ListProducts(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	search := r.URL.Query().Get("search")
	category := r.URL.Query().Get("category")
	list, total, err := h.svc.ListProducts(pr.Page, pr.PerPage, search, category)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/pos/products/{id}
func (h *POSHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid product id"))
		return
	}
	p, err := h.svc.GetProduct(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, p)
}

// PATCH /api/v1/pos/products/{id}
func (h *POSHandler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid product id"))
		return
	}
	var req services.UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	p, err := h.svc.UpdateProduct(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, p)
}

// DELETE /api/v1/pos/products/{id}
func (h *POSHandler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid product id"))
		return
	}
	if err := h.svc.DeleteProduct(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}

// POST /api/v1/pos/products/{id}/stock
func (h *POSHandler) AdjustStock(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid product id"))
		return
	}
	var body struct {
		Delta int    `json:"delta"`
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if err := h.svc.AdjustStock(id, body.Delta, body.Notes, claims.UserID); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "adjusted"})
}

// GET /api/v1/pos/products/{id}/stock-movements
func (h *POSHandler) ListStockMovements(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid product id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListStockMovements(id, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// POST /api/v1/pos/orders
func (h *POSHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreatePOSOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	o, err := h.svc.CreateOrder(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, o)
}

// GET /api/v1/pos/orders
func (h *POSHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListOrders(pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/pos/orders/{id}
func (h *POSHandler) GetOrder(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid order id"))
		return
	}
	o, err := h.svc.GetOrder(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, o)
}

// POST /api/v1/pos/orders/{id}/void
func (h *POSHandler) VoidOrder(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid order id"))
		return
	}
	if err := h.svc.VoidOrder(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "voided"})
}
