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

type NotificationHandler struct {
	notifSvc services.NotificationService
}

func NewNotificationHandler(notifSvc services.NotificationService) *NotificationHandler {
	return &NotificationHandler{notifSvc: notifSvc}
}

// GET /api/v1/notifications
// Returns the authenticated user's notification feed.
func (h *NotificationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	req := utils.ParsePageRequest(r)

	notifications, total, err := h.notifSvc.List(claims.UserID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	unread, _ := h.notifSvc.UnreadCount(claims.UserID)

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"notifications": notifications,
		"unread_count":  unread,
		"meta":          utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/notifications/unread-count
func (h *NotificationHandler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	count, err := h.notifSvc.UnreadCount(claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{"unread_count": count})
}

// PATCH /api/v1/notifications/{id}/read
func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid notification id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.notifSvc.MarkRead(id, claims.UserID); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Marked as read"})
}

// POST /api/v1/notifications/read-all
func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.notifSvc.MarkAllRead(claims.UserID); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "All notifications marked as read"})
}

// GET /api/v1/notifications/preferences
func (h *NotificationHandler) GetPreferences(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	pref, err := h.notifSvc.GetPreferences(claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, pref)
}

// PATCH /api/v1/notifications/preferences
func (h *NotificationHandler) UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.UpdatePreferenceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	pref, err := h.notifSvc.UpdatePreferences(claims.UserID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, pref)
}
