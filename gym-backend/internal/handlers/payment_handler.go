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

type PaymentHandler struct {
	paymentSvc services.PaymentService
	memberSvc  services.MemberService
}

func NewPaymentHandler(paymentSvc services.PaymentService, memberSvc services.MemberService) *PaymentHandler {
	return &PaymentHandler{paymentSvc: paymentSvc, memberSvc: memberSvc}
}

// POST /api/v1/payments
func (h *PaymentHandler) Record(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.RecordPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	payment, err := h.paymentSvc.Record(req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, payment)
}

// GET /api/v1/payments
func (h *PaymentHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	payments, total, err := h.paymentSvc.List(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"payments": payments,
		"meta":     utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/payments/{id}
func (h *PaymentHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid payment id"))
		return
	}

	payment, err := h.paymentSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, payment)
}

// GET /api/v1/members/{id}/payments
func (h *PaymentHandler) ListByMember(w http.ResponseWriter, r *http.Request) {
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
	payments, total, err := h.paymentSvc.ListByMember(memberID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"payments": payments,
		"meta":     utils.BuildPageMeta(req, total),
	})
}

// POST /api/v1/payments/{id}/refund
func (h *PaymentHandler) Refund(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid payment id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.RefundPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	payment, err := h.paymentSvc.Refund(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, payment)
}
