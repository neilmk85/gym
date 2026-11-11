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

// ─── Category Handler ─────────────────────────────────────────────────────────

type ExpenseCategoryHandler struct {
	svc services.ExpenseCategoryService
}

func NewExpenseCategoryHandler(svc services.ExpenseCategoryService) *ExpenseCategoryHandler {
	return &ExpenseCategoryHandler{svc: svc}
}

// POST /api/v1/expense-categories
func (h *ExpenseCategoryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreateExpenseCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	c, err := h.svc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, c)
}

// GET /api/v1/expense-categories
func (h *ExpenseCategoryHandler) List(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active_only") != "false"
	cats, err := h.svc.List(activeOnly)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{"categories": cats})
}

// GET /api/v1/expense-categories/{id}
func (h *ExpenseCategoryHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid category id"))
		return
	}
	c, err := h.svc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, c)
}

// PATCH /api/v1/expense-categories/{id}
func (h *ExpenseCategoryHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid category id"))
		return
	}
	var req services.UpdateExpenseCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	c, err := h.svc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, c)
}

// DELETE /api/v1/expense-categories/{id}
func (h *ExpenseCategoryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid category id"))
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Category deleted"})
}

// ─── Expense Handler ──────────────────────────────────────────────────────────

type ExpenseHandler struct {
	svc services.ExpenseService
}

func NewExpenseHandler(svc services.ExpenseService) *ExpenseHandler {
	return &ExpenseHandler{svc: svc}
}

// POST /api/v1/expenses
func (h *ExpenseHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	e, err := h.svc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, e)
}

// GET /api/v1/expenses
func (h *ExpenseHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var facilityID *uint
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		if id, err := strconv.ParseUint(fid, 10, 64); err == nil {
			uid := uint(id)
			facilityID = &uid
		}
	}

	var categoryID *uint
	if cid := r.URL.Query().Get("category_id"); cid != "" {
		if id, err := strconv.ParseUint(cid, 10, 64); err == nil {
			uid := uint(id)
			categoryID = &uid
		}
	}

	status   := r.URL.Query().Get("status")
	dateFrom := r.URL.Query().Get("date_from")
	dateTo   := r.URL.Query().Get("date_to")

	expenses, total, err := h.svc.List(req, facilityID, categoryID, status, dateFrom, dateTo)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"expenses": expenses,
		"meta":     utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/expenses/{id}
func (h *ExpenseHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid expense id"))
		return
	}
	e, err := h.svc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, e)
}

// PATCH /api/v1/expenses/{id}
func (h *ExpenseHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid expense id"))
		return
	}
	var req services.UpdateExpenseRequest
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

// DELETE /api/v1/expenses/{id}
func (h *ExpenseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid expense id"))
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Expense deleted"})
}
