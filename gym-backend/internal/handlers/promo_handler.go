package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/middleware"
	"gym-backend/internal/repositories"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type PromoHandler struct {
	promoSvc   services.PromoService
	notifSvc   services.NotificationService
	memberRepo repositories.MemberRepository
}

func NewPromoHandler(promoSvc services.PromoService, notifSvc services.NotificationService, memberRepo repositories.MemberRepository) *PromoHandler {
	return &PromoHandler{promoSvc: promoSvc, notifSvc: notifSvc, memberRepo: memberRepo}
}

// POST /api/v1/promo-codes
func (h *PromoHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreatePromoCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	pc, err := h.promoSvc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, pc)
}

// GET /api/v1/promo-codes
func (h *PromoHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var facilityID *uint
	if v := r.URL.Query().Get("facility_id"); v != "" {
		n, err := strconv.ParseUint(v, 10, 64)
		if err == nil && n > 0 {
			id := uint(n)
			facilityID = &id
		}
	}

	activeOnly := r.URL.Query().Get("active_only") != "false"

	codes, total, err := h.promoSvc.List(req, facilityID, activeOnly)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"promo_codes": codes,
		"meta":        utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/promo-codes/{id}
func (h *PromoHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid promo code id"))
		return
	}

	pc, err := h.promoSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, pc)
}

// PATCH /api/v1/promo-codes/{id}
func (h *PromoHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid promo code id"))
		return
	}

	var req services.UpdatePromoCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	pc, err := h.promoSvc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, pc)
}

// DELETE /api/v1/promo-codes/{id}
func (h *PromoHandler) Deactivate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid promo code id"))
		return
	}

	if err := h.promoSvc.Deactivate(id, claims.UserID); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Promo code deactivated"})
}

// GET /api/v1/promo-codes/validate?code=SAVE10&plan_id=1
func (h *PromoHandler) Validate(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	planIDStr := r.URL.Query().Get("plan_id")

	planID, err := strconv.ParseUint(planIDStr, 10, 64)
	if err != nil || planID == 0 {
		response.Error(w, r, apperrors.ErrValidation("valid plan_id is required"))
		return
	}

	result, err := h.promoSvc.ValidateForPlan(code, uint(planID))
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, result)
}

// POST /api/v1/promo-codes/{id}/broadcast
// Sends a promo announcement notification to all active members.
func (h *PromoHandler) Broadcast(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid promo code id"))
		return
	}

	pc, err := h.promoSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if !pc.IsActive {
		response.Error(w, r, apperrors.ErrValidation("cannot broadcast an inactive promo code"))
		return
	}

	// Build a human-readable description of the discount.
	var desc string
	switch pc.DiscountType {
	case "percentage":
		desc = fmt.Sprintf("%.0f%% off on your next membership plan", pc.DiscountValue)
	case "fixed_amount":
		desc = fmt.Sprintf("₹%.0f off on your next membership plan", pc.DiscountValue)
	case "free_month":
		desc = "one free month on your next membership plan"
	case "bogo":
		desc = "buy-one-get-one on your next membership plan"
	default:
		desc = "a special discount on your next membership plan"
	}

	// Load all active members in background and broadcast.
	go func() {
		members, err := h.memberRepo.FindAllActive()
		if err != nil {
			return
		}
		sent := 0
		for _, m := range members {
			ev := services.PromoAnnouncementEvent(m.UserID, pc.ID, pc.Code, desc)
			if dispatchErr := h.notifSvc.Dispatch(ev); dispatchErr == nil {
				sent++
			}
		}
	}()

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"message": "Broadcast initiated — notifications will be delivered to all active members",
		"code":    pc.Code,
	})
}
