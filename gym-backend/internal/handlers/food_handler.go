package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

type FoodHandler struct {
	foodSvc services.FoodService
}

func NewFoodHandler(foodSvc services.FoodService) *FoodHandler {
	return &FoodHandler{foodSvc: foodSvc}
}

// POST /api/v1/foods
func (h *FoodHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req services.CreateFoodRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	f, err := h.foodSvc.Create(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, f)
}

// GET /api/v1/foods/{id}
func (h *FoodHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid food id"))
		return
	}

	f, err := h.foodSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, f)
}

// GET /api/v1/foods
// Query params: search, category, active_only (default true)
func (h *FoodHandler) List(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	category := r.URL.Query().Get("category")
	activeOnly := r.URL.Query().Get("active_only") != "false"

	foods, total, err := h.foodSvc.List(search, category, activeOnly)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"foods": foods,
		"total": total,
	})
}

// PATCH /api/v1/foods/{id}
func (h *FoodHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid food id"))
		return
	}

	var req services.UpdateFoodRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	f, err := h.foodSvc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, f)
}

// DELETE /api/v1/foods/{id}
func (h *FoodHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid food id"))
		return
	}

	if err := h.foodSvc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Food deleted"})
}

// POST /api/v1/foods/bulk
func (h *FoodHandler) BulkImport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Foods []services.CreateFoodRequest `json:"foods"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if len(req.Foods) == 0 {
		response.Error(w, r, apperrors.ErrValidation("foods array is empty"))
		return
	}
	if len(req.Foods) > 500 {
		response.Error(w, r, apperrors.ErrValidation("maximum 500 items per import"))
		return
	}

	result, err := h.foodSvc.BulkImport(req.Foods)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, result)
}
