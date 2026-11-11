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

type BillingHandler struct {
	billingSvc  services.BillingService
	subSvc      services.SubscriptionService
	memberSvc   services.MemberService
}

func NewBillingHandler(billingSvc services.BillingService, subSvc services.SubscriptionService, memberSvc services.MemberService) *BillingHandler {
	return &BillingHandler{billingSvc: billingSvc, subSvc: subSvc, memberSvc: memberSvc}
}

// ── Tax Profile ───────────────────────────────────────────────────────────────

// GET /api/v1/billing/tax-profile
func (h *BillingHandler) GetTaxProfile(w http.ResponseWriter, r *http.Request) {
	facilityID, err := queryUintOr(r, "facility_id", 1)
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid facility_id"))
		return
	}
	profile, err := h.billingSvc.GetTaxProfile(facilityID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, profile)
}

// PUT /api/v1/billing/tax-profile
func (h *BillingHandler) UpsertTaxProfile(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := queryUintOr(r, "facility_id", 1)
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid facility_id"))
		return
	}

	var req services.UpsertTaxProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	profile, err := h.billingSvc.UpsertTaxProfile(facilityID, req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, profile)
}

// ── Tax Rates ─────────────────────────────────────────────────────────────────

// GET /api/v1/billing/tax-rates
func (h *BillingHandler) ListTaxRates(w http.ResponseWriter, r *http.Request) {
	rates, err := h.billingSvc.ListTaxRates()
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{"tax_rates": rates})
}

// POST /api/v1/billing/tax-rates
func (h *BillingHandler) CreateTaxRate(w http.ResponseWriter, r *http.Request) {
	var req services.CreateTaxRateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	rate, err := h.billingSvc.CreateTaxRate(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, rate)
}

// PATCH /api/v1/billing/tax-rates/{id}
func (h *BillingHandler) UpdateTaxRate(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid tax rate id"))
		return
	}
	var req services.CreateTaxRateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	rate, err := h.billingSvc.UpdateTaxRate(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, rate)
}

// ── Invoices ──────────────────────────────────────────────────────────────────

// POST /api/v1/billing/invoices
func (h *BillingHandler) CreateInvoice(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateInvoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.FacilityID == 0 {
		req.FacilityID = 1
	}

	inv, err := h.billingSvc.CreateInvoice(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, inv)
}

// GET /api/v1/billing/invoices
func (h *BillingHandler) ListInvoices(w http.ResponseWriter, r *http.Request) {
	facilityID, _ := queryUintOr(r, "facility_id", 1)
	pr := utils.ParsePageRequest(r)

	invs, total, err := h.billingSvc.ListInvoices(facilityID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"invoices": invs,
		"meta":     utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/billing/invoices/{id}
func (h *BillingHandler) GetInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid invoice id"))
		return
	}
	inv, err := h.billingSvc.GetInvoice(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, inv)
}

// DELETE /api/v1/billing/invoices/{id}
func (h *BillingHandler) CancelInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid invoice id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())

	var body struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if err := h.billingSvc.CancelInvoice(id, body.Reason, claims.UserID); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "cancelled"})
}

// GET /api/v1/members/{id}/invoices
func (h *BillingHandler) ListInvoicesByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	if !requireMemberOwnership(w, r, claims, memberID, h.memberSvc) {
		return
	}
	pr := utils.ParsePageRequest(r)

	invs, total, err := h.billingSvc.ListInvoicesByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"invoices": invs,
		"meta":     utils.BuildPageMeta(pr, total),
	})
}

// ── Receipts ──────────────────────────────────────────────────────────────────

// POST /api/v1/billing/receipts
func (h *BillingHandler) CreateReceipt(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.FacilityID == 0 {
		req.FacilityID = 1
	}

	rec, err := h.billingSvc.CreateReceipt(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, rec)
}

// GET /api/v1/billing/receipts
func (h *BillingHandler) ListReceipts(w http.ResponseWriter, r *http.Request) {
	facilityID, _ := queryUintOr(r, "facility_id", 1)
	pr := utils.ParsePageRequest(r)

	recs, total, err := h.billingSvc.ListReceipts(facilityID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"receipts": recs,
		"meta":     utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/billing/receipts/{id}
func (h *BillingHandler) GetReceipt(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid receipt id"))
		return
	}
	rec, err := h.billingSvc.GetReceipt(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, rec)
}

// GET /api/v1/members/{id}/receipts
func (h *BillingHandler) ListReceiptsByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	if !requireMemberOwnership(w, r, claims, memberID, h.memberSvc) {
		return
	}
	pr := utils.ParsePageRequest(r)

	recs, total, err := h.billingSvc.ListReceiptsByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"receipts": recs,
		"meta":     utils.BuildPageMeta(pr, total),
	})
}

// ── Credit Notes ──────────────────────────────────────────────────────────────

// POST /api/v1/billing/credit-notes
func (h *BillingHandler) CreateCreditNote(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateCreditNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.FacilityID == 0 {
		req.FacilityID = 1
	}

	cn, err := h.billingSvc.CreateCreditNote(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, cn)
}

// GET /api/v1/billing/credit-notes/{id}
func (h *BillingHandler) GetCreditNote(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid credit note id"))
		return
	}
	cn, err := h.billingSvc.GetCreditNote(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, cn)
}

// GET /api/v1/members/{id}/credit-notes
func (h *BillingHandler) ListCreditNotesByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	if !requireMemberOwnership(w, r, claims, memberID, h.memberSvc) {
		return
	}
	pr := utils.ParsePageRequest(r)

	cns, total, err := h.billingSvc.ListCreditNotesByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"credit_notes": cns,
		"meta":         utils.BuildPageMeta(pr, total),
	})
}

// ── Freeze endpoints ──────────────────────────────────────────────────────────

// POST /api/v1/subscriptions/{id}/freeze
func (h *BillingHandler) FreezeSubscription(w http.ResponseWriter, r *http.Request) {
	subID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.FreezeSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	freeze, err := h.subSvc.FreezeSubscription(subID, req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, freeze)
}

// POST /api/v1/subscription-freezes/{id}/unfreeze
func (h *BillingHandler) UnfreezeSubscription(w http.ResponseWriter, r *http.Request) {
	freezeID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid freeze id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())

	freeze, err := h.subSvc.UnfreezeSubscription(freezeID, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, freeze)
}

// GET /api/v1/subscriptions/{id}/freezes
func (h *BillingHandler) ListFreezesForSubscription(w http.ResponseWriter, r *http.Request) {
	subID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}
	freezes, err := h.subSvc.ListFreezesBySubscription(subID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{"freezes": freezes})
}

// GET /api/v1/subscriptions/{id}/upgrade-quote?new_plan_id=X
func (h *BillingHandler) GetUpgradeQuote(w http.ResponseWriter, r *http.Request) {
	subID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}
	newPlanID, err := queryUintOr(r, "new_plan_id", 0)
	if err != nil || newPlanID == 0 {
		response.Error(w, r, apperrors.ErrValidation("new_plan_id query parameter is required"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())

	quote, err := h.subSvc.GetUpgradeQuote(subID, newPlanID, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, quote)
}

// GET /api/v1/subscriptions/{id}/entitlement-ledger
func (h *BillingHandler) GetEntitlementLedger(w http.ResponseWriter, r *http.Request) {
	subID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid subscription id"))
		return
	}
	entries, err := h.subSvc.GetEntitlementLedger(subID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{"ledger": entries})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func queryUintOr(r *http.Request, key string, defaultVal uint) (uint, error) {
	raw := r.URL.Query().Get(key)
	if raw == "" {
		return defaultVal, nil
	}
	var n uint64
	for _, c := range raw {
		if c < '0' || c > '9' {
			return 0, apperrors.ErrValidation("invalid numeric parameter")
		}
		n = n*10 + uint64(c-'0')
	}
	return uint(n), nil
}
