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

// ─── CRM Handler (lead activities, follow-ups, trial visits) ─────────────────

type CRMHandler struct {
	svc services.CRMService
}

func NewCRMHandler(svc services.CRMService) *CRMHandler {
	return &CRMHandler{svc: svc}
}

// POST /api/v1/enquiries/{id}/activities
func (h *CRMHandler) LogActivity(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	enquiryID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	var req services.LogLeadActivityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	req.EnquiryID = enquiryID
	a, err := h.svc.LogActivity(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, a)
}

// GET /api/v1/enquiries/{id}/activities
func (h *CRMHandler) ListActivities(w http.ResponseWriter, r *http.Request) {
	enquiryID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	list, err := h.svc.ListActivitiesByEnquiry(enquiryID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// POST /api/v1/enquiries/{id}/follow-ups
func (h *CRMHandler) CreateFollowUp(w http.ResponseWriter, r *http.Request) {
	enquiryID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	var req services.CreateFollowUpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	req.EnquiryID = enquiryID
	f, err := h.svc.CreateFollowUp(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, f)
}

// GET /api/v1/enquiries/{id}/follow-ups
func (h *CRMHandler) ListFollowUps(w http.ResponseWriter, r *http.Request) {
	enquiryID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	list, err := h.svc.ListFollowUpsByEnquiry(enquiryID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// POST /api/v1/follow-ups/{id}/complete
func (h *CRMHandler) CompleteFollowUp(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid follow-up id"))
		return
	}
	if err := h.svc.CompleteFollowUp(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "completed"})
}

// POST /api/v1/enquiries/{id}/trials
func (h *CRMHandler) ScheduleTrial(w http.ResponseWriter, r *http.Request) {
	enquiryID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	var req services.ScheduleTrialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	req.EnquiryID = enquiryID
	t, err := h.svc.ScheduleTrial(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, t)
}

// GET /api/v1/enquiries/{id}/trials
func (h *CRMHandler) ListTrials(w http.ResponseWriter, r *http.Request) {
	enquiryID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	list, err := h.svc.ListTrialsByEnquiry(enquiryID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// GET /api/v1/trials/upcoming
func (h *CRMHandler) ListUpcomingTrials(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListUpcomingTrials(pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// PATCH /api/v1/trials/{id}
func (h *CRMHandler) UpdateTrial(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trial id"))
		return
	}
	var req services.UpdateTrialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	t, err := h.svc.UpdateTrial(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, t)
}

// PATCH /api/v1/trials/{id}/status
func (h *CRMHandler) UpdateTrialStatus(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trial id"))
		return
	}
	var body struct {
		Status   string `json:"status"`
		Feedback string `json:"feedback"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if err := h.svc.UpdateTrialStatus(id, body.Status, body.Feedback); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": body.Status})
}

// ─── Waiver Handler ───────────────────────────────────────────────────────────

type WaiverHandler struct {
	svc services.WaiverService
}

func NewWaiverHandler(svc services.WaiverService) *WaiverHandler {
	return &WaiverHandler{svc: svc}
}

// POST /api/v1/waivers
func (h *WaiverHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req services.CreateWaiverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	waiver, err := h.svc.CreateWaiver(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, waiver)
}

// GET /api/v1/waivers/{id}
func (h *WaiverHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid waiver id"))
		return
	}
	waiver, err := h.svc.GetWaiver(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, waiver)
}

// GET /api/v1/members/{id}/waivers
func (h *WaiverHandler) ListByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	list, err := h.svc.ListWaiversByMember(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// POST /api/v1/waivers/{id}/sign
func (h *WaiverHandler) Sign(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid waiver id"))
		return
	}
	ip := r.RemoteAddr
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		ip = fwd
	}
	if err := h.svc.SignWaiver(id, ip); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "signed"})
}

