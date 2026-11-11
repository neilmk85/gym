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

// ─── Exercise Handler ─────────────────────────────────────────────────────────

type ExerciseHandler struct {
	svc services.ExerciseService
}

func NewExerciseHandler(svc services.ExerciseService) *ExerciseHandler {
	return &ExerciseHandler{svc: svc}
}

// POST /api/v1/exercises
func (h *ExerciseHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreateExerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	e, err := h.svc.CreateExercise(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, e)
}

// GET /api/v1/exercises
func (h *ExerciseHandler) List(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	search := r.URL.Query().Get("search")
	list, total, err := h.svc.ListExercises(pr.Page, pr.PerPage, search)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"exercises": list,
		"meta":      utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/exercises/{id}
func (h *ExerciseHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid exercise id"))
		return
	}
	e, err := h.svc.GetExercise(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, e)
}

// PATCH /api/v1/exercises/{id}
func (h *ExerciseHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid exercise id"))
		return
	}
	var req services.UpdateExerciseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	e, err := h.svc.UpdateExercise(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, e)
}

// DELETE /api/v1/exercises/{id}
func (h *ExerciseHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid exercise id"))
		return
	}
	if err := h.svc.DeleteExercise(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "exercise deleted"})
}

// ─── Coaching Handler ─────────────────────────────────────────────────────────

type CoachingHandler struct {
	svc services.CoachingService
}

func NewCoachingHandler(svc services.CoachingService) *CoachingHandler {
	return &CoachingHandler{svc: svc}
}

// ── Workout Assignments ───────────────────────────────────────────────────────

// POST /api/v1/workout-assignments
func (h *CoachingHandler) CreateWorkoutAssignment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreateWorkoutAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	a, err := h.svc.CreateWorkoutAssignment(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, a)
}

// GET /api/v1/workout-assignments/{id}
func (h *CoachingHandler) GetWorkoutAssignment(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid assignment id"))
		return
	}
	a, err := h.svc.GetWorkoutAssignment(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, a)
}

// GET /api/v1/members/{id}/workout-assignments
func (h *CoachingHandler) ListWorkoutAssignmentsByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListWorkoutAssignmentsByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"workout_assignments": list,
		"meta":                utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/trainers/{id}/workout-assignments
func (h *CoachingHandler) ListWorkoutAssignmentsByTrainer(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListWorkoutAssignmentsByTrainer(trainerID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"workout_assignments": list,
		"meta":                utils.BuildPageMeta(pr, total),
	})
}

// DELETE /api/v1/workout-assignments/{id}
func (h *CoachingHandler) RevokeWorkoutAssignment(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid assignment id"))
		return
	}
	if err := h.svc.RevokeWorkoutAssignment(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "workout assignment revoked"})
}

// ── Diet Assignments ──────────────────────────────────────────────────────────

// POST /api/v1/diet-assignments
func (h *CoachingHandler) CreateDietAssignment(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreateDietAssignmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	a, err := h.svc.CreateDietAssignment(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, a)
}

// GET /api/v1/diet-assignments/{id}
func (h *CoachingHandler) GetDietAssignment(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid assignment id"))
		return
	}
	a, err := h.svc.GetDietAssignment(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, a)
}

// GET /api/v1/members/{id}/diet-assignments
func (h *CoachingHandler) ListDietAssignmentsByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListDietAssignmentsByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"diet_assignments": list,
		"meta":             utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/trainers/{id}/diet-assignments
func (h *CoachingHandler) ListDietAssignmentsByTrainer(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListDietAssignmentsByTrainer(trainerID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"diet_assignments": list,
		"meta":             utils.BuildPageMeta(pr, total),
	})
}

// DELETE /api/v1/diet-assignments/{id}
func (h *CoachingHandler) RevokeDietAssignment(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid assignment id"))
		return
	}
	if err := h.svc.RevokeDietAssignment(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "diet assignment revoked"})
}

// ── Workout Logs ──────────────────────────────────────────────────────────────

// POST /api/v1/workout-logs
func (h *CoachingHandler) CreateWorkoutLog(w http.ResponseWriter, r *http.Request) {
	var req services.CreateWorkoutLogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	l, err := h.svc.CreateWorkoutLog(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, l)
}

// GET /api/v1/workout-logs/{id}
func (h *CoachingHandler) GetWorkoutLog(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid log id"))
		return
	}
	l, err := h.svc.GetWorkoutLog(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, l)
}

// GET /api/v1/members/{id}/workout-logs
func (h *CoachingHandler) ListWorkoutLogsByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListWorkoutLogsByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"workout_logs": list,
		"meta":         utils.BuildPageMeta(pr, total),
	})
}

// ── Trainer Feedback ──────────────────────────────────────────────────────────

// POST /api/v1/trainer-feedback
func (h *CoachingHandler) CreateTrainerFeedback(w http.ResponseWriter, r *http.Request) {
	var req services.CreateTrainerFeedbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	f, err := h.svc.CreateTrainerFeedback(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, f)
}

// GET /api/v1/trainer-feedback/{id}
func (h *CoachingHandler) GetTrainerFeedback(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid feedback id"))
		return
	}
	f, err := h.svc.GetTrainerFeedback(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, f)
}

// GET /api/v1/members/{id}/trainer-feedback
func (h *CoachingHandler) ListFeedbackByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListFeedbackByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"trainer_feedback": list,
		"meta":             utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/trainers/{id}/trainer-feedback
func (h *CoachingHandler) ListFeedbackByTrainer(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListFeedbackByTrainer(trainerID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"trainer_feedback": list,
		"meta":             utils.BuildPageMeta(pr, total),
	})
}
