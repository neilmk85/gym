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

// ─── Body Measurement Handler ─────────────────────────────────────────────────

type BodyMeasurementHandler struct {
	svc services.BodyMeasurementService
}

func NewBodyMeasurementHandler(svc services.BodyMeasurementService) *BodyMeasurementHandler {
	return &BodyMeasurementHandler{svc: svc}
}

// POST /api/v1/body-measurements
func (h *BodyMeasurementHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.RecordMeasurementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	m, err := h.svc.RecordMeasurement(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, m)
}

// GET /api/v1/body-measurements/{id}
func (h *BodyMeasurementHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid measurement id"))
		return
	}
	m, err := h.svc.GetMeasurement(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, m)
}

// GET /api/v1/members/{id}/body-measurements
func (h *BodyMeasurementHandler) ListByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListMeasurementsByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"body_measurements": list,
		"meta":              utils.BuildPageMeta(pr, total),
	})
}

// DELETE /api/v1/body-measurements/{id}
func (h *BodyMeasurementHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid measurement id"))
		return
	}
	if err := h.svc.DeleteMeasurement(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "measurement deleted"})
}

// ─── Progress Photo Handler ───────────────────────────────────────────────────

type ProgressPhotoHandler struct {
	svc services.ProgressPhotoService
}

func NewProgressPhotoHandler(svc services.ProgressPhotoService) *ProgressPhotoHandler {
	return &ProgressPhotoHandler{svc: svc}
}

// POST /api/v1/progress-photos
func (h *ProgressPhotoHandler) Add(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.AddProgressPhotoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	p, err := h.svc.AddPhoto(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, p)
}

// GET /api/v1/progress-photos/{id}
func (h *ProgressPhotoHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid photo id"))
		return
	}
	p, err := h.svc.GetPhoto(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, p)
}

// GET /api/v1/members/{id}/progress-photos
func (h *ProgressPhotoHandler) ListByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListPhotosByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"progress_photos": list,
		"meta":            utils.BuildPageMeta(pr, total),
	})
}

// DELETE /api/v1/progress-photos/{id}
func (h *ProgressPhotoHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid photo id"))
		return
	}
	if err := h.svc.DeletePhoto(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "photo deleted"})
}

// ─── Retention Handler ────────────────────────────────────────────────────────

type RetentionHandler struct {
	svc services.RetentionService
}

func NewRetentionHandler(svc services.RetentionService) *RetentionHandler {
	return &RetentionHandler{svc: svc}
}

// POST /api/v1/retention/risks
func (h *RetentionHandler) RaiseRisk(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.RaiseRetentionRiskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	risk, err := h.svc.RaiseRisk(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, risk)
}

// GET /api/v1/retention/risks
func (h *RetentionHandler) ListOpenRisks(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListOpenRisks(pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"retention_risks": list,
		"meta":            utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/retention/risks/{id}
func (h *RetentionHandler) GetRisk(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid risk id"))
		return
	}
	risk, err := h.svc.GetRisk(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, risk)
}

// POST /api/v1/retention/risks/{id}/resolve
func (h *RetentionHandler) ResolveRisk(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid risk id"))
		return
	}
	var body struct {
		Notes string `json:"notes"`
	}
	json.NewDecoder(r.Body).Decode(&body) //nolint
	if err := h.svc.ResolveRisk(id, body.Notes); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "risk resolved"})
}

// GET /api/v1/members/{id}/retention-risks
func (h *RetentionHandler) ListRisksByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListRisksByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"retention_risks": list,
		"meta":            utils.BuildPageMeta(pr, total),
	})
}

// POST /api/v1/retention/actions
func (h *RetentionHandler) CreateAction(w http.ResponseWriter, r *http.Request) {
	var req services.CreateRetentionActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	a, err := h.svc.CreateAction(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, a)
}

// GET /api/v1/retention/risks/{id}/actions
func (h *RetentionHandler) ListActionsByRisk(w http.ResponseWriter, r *http.Request) {
	riskID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid risk id"))
		return
	}
	list, err := h.svc.ListActionsByRisk(riskID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{"retention_actions": list})
}

// POST /api/v1/retention/actions/{id}/complete
func (h *RetentionHandler) CompleteAction(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid action id"))
		return
	}
	var body struct {
		Outcome string `json:"outcome"`
	}
	json.NewDecoder(r.Body).Decode(&body) //nolint
	if err := h.svc.CompleteAction(id, body.Outcome); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "action completed"})
}
