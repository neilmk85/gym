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

type SubscriptionHandler struct {
	subSvc    services.SubscriptionService
	memberSvc services.MemberService
}

func NewSubscriptionHandler(subSvc services.SubscriptionService, memberSvc services.MemberService) *SubscriptionHandler {
	return &SubscriptionHandler{subSvc: subSvc, memberSvc: memberSvc}
}

// POST /api/v1/subscriptions
func (h *SubscriptionHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	sub, err := h.subSvc.Create(req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, sub)
}

// GET /api/v1/subscriptions
func (h *SubscriptionHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	subs, total, err := h.subSvc.List(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"subscriptions": subs,
		"meta":          utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/subscriptions/{id}
func (h *SubscriptionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}

	sub, err := h.subSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, sub)
}

// GET /api/v1/members/{id}/subscriptions
func (h *SubscriptionHandler) ListByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if !requireMemberOwnership(w, r, claims, memberID, h.memberSvc) {
		return
	}

	req := utils.ParsePageRequest(r)
	subs, total, err := h.subSvc.ListByMember(memberID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"subscriptions": subs,
		"meta":          utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/members/{id}/subscriptions/active
func (h *SubscriptionHandler) GetActivByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if !requireMemberOwnership(w, r, claims, memberID, h.memberSvc) {
		return
	}

	sub, err := h.subSvc.GetActiveByMember(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, sub)
}

// POST /api/v1/subscriptions/{id}/pause
func (h *SubscriptionHandler) Pause(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.PauseSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	sub, err := h.subSvc.Pause(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, sub)
}

// POST /api/v1/subscriptions/{id}/resume
func (h *SubscriptionHandler) Resume(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	sub, err := h.subSvc.Resume(id, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, sub)
}

// POST /api/v1/subscriptions/{id}/cancel
func (h *SubscriptionHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CancelSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	sub, err := h.subSvc.Cancel(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, sub)
}

// POST /api/v1/subscriptions/{id}/upgrade
func (h *SubscriptionHandler) Upgrade(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.UpgradeSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	sub, err := h.subSvc.Upgrade(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, sub)
}

// POST /api/v1/subscriptions/{id}/extend
func (h *SubscriptionHandler) Extend(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.ExtendSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	sub, err := h.subSvc.Extend(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, sub)
}

// PATCH /api/v1/subscriptions/{id}/auto-renew
func (h *SubscriptionHandler) SetAutoRenew(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	// IDOR guard: fetch the subscription first to check ownership.
	existing, err := h.subSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if !requireMemberOwnership(w, r, claims, existing.MemberID, h.memberSvc) {
		return
	}

	var body struct {
		AutoRenew bool `json:"auto_renew"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	sub, err := h.subSvc.SetAutoRenew(id, body.AutoRenew, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, sub)
}
