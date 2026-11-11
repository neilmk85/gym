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

type DietTemplateHandler struct {
	dietTemplateSvc services.DietTemplateService
}

func NewDietTemplateHandler(dietTemplateSvc services.DietTemplateService) *DietTemplateHandler {
	return &DietTemplateHandler{dietTemplateSvc: dietTemplateSvc}
}

// POST /api/v1/diet-templates
func (h *DietTemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateDietTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	t, err := h.dietTemplateSvc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, t)
}

// GET /api/v1/diet-templates/{id}
func (h *DietTemplateHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid diet template id"))
		return
	}

	t, err := h.dietTemplateSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, t)
}

// GET /api/v1/diet-templates
// Query params: category, active_only (default true)
func (h *DietTemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	category := r.URL.Query().Get("category")
	activeOnly := r.URL.Query().Get("active_only") != "false"

	templates, total, err := h.dietTemplateSvc.List(req, category, activeOnly)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"diet_templates": templates,
		"meta":           utils.BuildPageMeta(req, total),
	})
}

// PATCH /api/v1/diet-templates/{id}
func (h *DietTemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid diet template id"))
		return
	}

	var req services.UpdateDietTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	t, err := h.dietTemplateSvc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, t)
}

// DELETE /api/v1/diet-templates/{id}
func (h *DietTemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid diet template id"))
		return
	}

	if err := h.dietTemplateSvc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Diet template deleted"})
}
