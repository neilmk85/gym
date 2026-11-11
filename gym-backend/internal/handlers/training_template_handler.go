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

type TrainingTemplateHandler struct {
	trainingTemplateSvc services.TrainingTemplateService
}

func NewTrainingTemplateHandler(trainingTemplateSvc services.TrainingTemplateService) *TrainingTemplateHandler {
	return &TrainingTemplateHandler{trainingTemplateSvc: trainingTemplateSvc}
}

// POST /api/v1/training-templates
func (h *TrainingTemplateHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateTrainingTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	t, err := h.trainingTemplateSvc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, t)
}

// GET /api/v1/training-templates/{id}
func (h *TrainingTemplateHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid training template id"))
		return
	}

	t, err := h.trainingTemplateSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, t)
}

// GET /api/v1/training-templates
// Query params: category, difficulty, active_only (default true)
func (h *TrainingTemplateHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	category := r.URL.Query().Get("category")
	difficulty := r.URL.Query().Get("difficulty")
	activeOnly := r.URL.Query().Get("active_only") != "false"

	templates, total, err := h.trainingTemplateSvc.List(req, category, difficulty, activeOnly)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"training_templates": templates,
		"meta":               utils.BuildPageMeta(req, total),
	})
}

// PATCH /api/v1/training-templates/{id}
func (h *TrainingTemplateHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid training template id"))
		return
	}

	var req services.UpdateTrainingTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	t, err := h.trainingTemplateSvc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, t)
}

// DELETE /api/v1/training-templates/{id}
func (h *TrainingTemplateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid training template id"))
		return
	}

	if err := h.trainingTemplateSvc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Training template deleted"})
}
