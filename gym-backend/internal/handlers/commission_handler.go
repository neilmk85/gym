package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type CommissionHandler struct {
	svc services.CommissionService
}

func NewCommissionHandler(svc services.CommissionService) *CommissionHandler {
	return &CommissionHandler{svc: svc}
}

// POST /api/v1/commission-rules
func (h *CommissionHandler) CreateRule(w http.ResponseWriter, r *http.Request) {
	var req services.CreateCommissionRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	rule, err := h.svc.CreateRule(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, rule)
}

// GET /api/v1/staff/{id}/commission-rules
func (h *CommissionHandler) ListRules(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	list, err := h.svc.ListRulesByStaff(staffID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// PATCH /api/v1/commission-rules/{id}
func (h *CommissionHandler) UpdateRule(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid rule id"))
		return
	}
	var req services.UpdateCommissionRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	rule, err := h.svc.UpdateRule(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, rule)
}

// DELETE /api/v1/commission-rules/{id}
func (h *CommissionHandler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid rule id"))
		return
	}
	if err := h.svc.DeleteRule(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}

// GET /api/v1/staff/{id}/commissions
func (h *CommissionHandler) ListEntries(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListEntriesByStaff(staffID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// POST /api/v1/commissions/{id}/approve
func (h *CommissionHandler) ApproveEntry(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid commission id"))
		return
	}
	if err := h.svc.ApproveEntry(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "approved"})
}

// POST /api/v1/commissions/{id}/cancel
func (h *CommissionHandler) CancelEntry(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid commission id"))
		return
	}
	if err := h.svc.CancelEntry(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "cancelled"})
}

// POST /api/v1/commission-payouts
func (h *CommissionHandler) CreatePayout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		StaffID     uint   `json:"staff_id"`
		PeriodStart string `json:"period_start"`
		PeriodEnd   string `json:"period_end"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	p, err := h.svc.CreatePayout(body.StaffID, body.PeriodStart, body.PeriodEnd)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, p)
}

// POST /api/v1/commission-payouts/{id}/mark-paid
func (h *CommissionHandler) MarkPayoutPaid(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid payout id"))
		return
	}
	if err := h.svc.MarkPayoutPaid(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "paid"})
}

// GET /api/v1/staff/{id}/commission-payouts
func (h *CommissionHandler) ListPayouts(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListPayoutsByStaff(staffID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}
