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

type LoyaltyHandler struct {
	svc services.LoyaltyService
}

func NewLoyaltyHandler(svc services.LoyaltyService) *LoyaltyHandler {
	return &LoyaltyHandler{svc: svc}
}

// GET /api/v1/members/{id}/referral-code
func (h *LoyaltyHandler) GetOrCreateReferralCode(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	rc, err := h.svc.GetOrCreateReferralCode(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, rc)
}

// POST /api/v1/referrals
func (h *LoyaltyHandler) RegisterReferral(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code         string `json:"code"`
		RefereeEmail string `json:"referee_email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	ref, err := h.svc.RegisterReferral(body.Code, body.RefereeEmail)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, ref)
}

// POST /api/v1/referrals/{id}/convert
func (h *LoyaltyHandler) ConvertReferral(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid referral id"))
		return
	}
	var body struct {
		MemberID uint `json:"member_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if err := h.svc.ConvertReferral(id, body.MemberID); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "converted"})
}

// GET /api/v1/members/{id}/referrals
func (h *LoyaltyHandler) ListReferrals(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	list, err := h.svc.ListReferralsByMember(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// GET /api/v1/members/{id}/loyalty
func (h *LoyaltyHandler) GetLoyaltyAccount(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	acc, err := h.svc.GetLoyaltyAccount(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, acc)
}

// POST /api/v1/members/{id}/loyalty/redeem
func (h *LoyaltyHandler) RedeemPoints(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	var body struct {
		Points      int    `json:"points"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if err := h.svc.RedeemPoints(memberID, body.Points, body.Description); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "redeemed"})
}

// GET /api/v1/loyalty/config
func (h *LoyaltyHandler) GetLoyaltyConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := h.svc.GetConfig(1)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, cfg)
}

// PUT /api/v1/loyalty/config
func (h *LoyaltyHandler) UpdateLoyaltyConfig(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PointsOnNewMembership int  `json:"points_on_new_membership"`
		PointsOnRenewal       int  `json:"points_on_renewal"`
		PointsOnReferral      int  `json:"points_on_referral"`
		PointsOnDayPass       int  `json:"points_on_day_pass"`
		PointsOnPTSession     int  `json:"points_on_pt_session"`
		PointsPerRupee        int  `json:"points_per_rupee"`
		MinRedeemPoints       int  `json:"min_redeem_points"`
		MaxRedeemPerTx        int  `json:"max_redeem_per_tx"`
		IsActive              bool `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	// Load existing to get the ID (upsert by facility_id)
	existing, err := h.svc.GetConfig(1)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	existing.PointsOnNewMembership = body.PointsOnNewMembership
	existing.PointsOnRenewal = body.PointsOnRenewal
	existing.PointsOnReferral = body.PointsOnReferral
	existing.PointsOnDayPass = body.PointsOnDayPass
	existing.PointsOnPTSession = body.PointsOnPTSession
	existing.PointsPerRupee = body.PointsPerRupee
	existing.MinRedeemPoints = body.MinRedeemPoints
	existing.MaxRedeemPerTx = body.MaxRedeemPerTx
	existing.IsActive = body.IsActive
	cfg, err := h.svc.UpdateConfig(existing)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, cfg)
}

// GET /api/v1/members/{id}/loyalty/transactions
func (h *LoyaltyHandler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	_ = middleware.ClaimsFromContext(r.Context())
	pr := utils.ParsePageRequest(r)
	list, total, err := h.svc.ListTransactions(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}
