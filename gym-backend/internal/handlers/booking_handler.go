package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/middleware"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type BookingHandler struct {
	bookingSvc services.BookingService
	memberSvc  services.MemberService
}

func NewBookingHandler(bookingSvc services.BookingService, memberSvc services.MemberService) *BookingHandler {
	return &BookingHandler{bookingSvc: bookingSvc, memberSvc: memberSvc}
}

// POST /api/v1/bookings
func (h *BookingHandler) Book(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.BookClassRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	booking, err := h.bookingSvc.Book(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, booking)
}

// GET /api/v1/bookings/{id}
func (h *BookingHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid booking id"))
		return
	}

	booking, err := h.bookingSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, booking)
}

// DELETE /api/v1/bookings/{id}
func (h *BookingHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid booking id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	// IDOR guard: fetch the booking and verify ownership for member bookings.
	existing, err := h.bookingSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	// Day pass bookings have no member — staff can cancel freely.
	if existing.MemberID != nil {
		if !requireMemberOwnership(w, r, claims, *existing.MemberID, h.memberSvc) {
			return
		}
	}

	var req services.CancelBookingRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	booking, err := h.bookingSvc.CancelBooking(id, req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, booking)
}

// POST /api/v1/bookings/{id}/attend
func (h *BookingHandler) MarkAttended(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid booking id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	booking, err := h.bookingSvc.MarkAttended(id, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, booking)
}

// POST /api/v1/bookings/{id}/no-show
func (h *BookingHandler) MarkNoShow(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid booking id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	booking, err := h.bookingSvc.MarkNoShow(id, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, booking)
}

// GET /api/v1/members/{id}/bookings
func (h *BookingHandler) ListByMember(w http.ResponseWriter, r *http.Request) {
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
	bookings, total, err := h.bookingSvc.ListByMember(memberID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"bookings": bookings,
		"meta":     utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/classes/{id}/bookings
func (h *BookingHandler) ListByClass(w http.ResponseWriter, r *http.Request) {
	classID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid class id"))
		return
	}

	req := utils.ParsePageRequest(r)
	bookings, total, err := h.bookingSvc.ListByClass(classID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"bookings": bookings,
		"meta":     utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/bookings
func (h *BookingHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var classID *uint
	if v := r.URL.Query().Get("class_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil && id > 0 {
			uid := uint(id)
			classID = &uid
		}
	}
	var memberID *uint
	if v := r.URL.Query().Get("member_id"); v != "" {
		if id, err := strconv.ParseUint(v, 10, 64); err == nil && id > 0 {
			uid := uint(id)
			memberID = &uid
		}
	}
	status := r.URL.Query().Get("status")

	bookings, total, err := h.bookingSvc.List(req, classID, memberID, status)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"bookings": bookings,
		"meta":     utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/members/{id}/bookings/upcoming
func (h *BookingHandler) ListUpcomingByMember(w http.ResponseWriter, r *http.Request) {
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
	bookings, total, err := h.bookingSvc.ListUpcomingByMember(memberID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"bookings": bookings,
		"meta":     utils.BuildPageMeta(req, total),
	})
}
