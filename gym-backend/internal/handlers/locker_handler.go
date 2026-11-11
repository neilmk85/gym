package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

type LockerHandler struct {
	svc services.LockerService
}

func NewLockerHandler(svc services.LockerService) *LockerHandler {
	return &LockerHandler{svc: svc}
}

// POST /api/v1/lockers
func (h *LockerHandler) CreateLocker(w http.ResponseWriter, r *http.Request) {
	var req services.CreateLockerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	l, err := h.svc.CreateLocker(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, l)
}

// GET /api/v1/lockers
func (h *LockerHandler) ListLockers(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	list, err := h.svc.ListLockers(status)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{"lockers": list})
}

// GET /api/v1/lockers/{id}
func (h *LockerHandler) GetLocker(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid locker id"))
		return
	}
	l, err := h.svc.GetLocker(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, l)
}

// PATCH /api/v1/lockers/{id}
func (h *LockerHandler) UpdateLocker(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid locker id"))
		return
	}
	var req services.UpdateLockerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	l, err := h.svc.UpdateLocker(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, l)
}

// DELETE /api/v1/lockers/{id}
func (h *LockerHandler) DeleteLocker(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid locker id"))
		return
	}
	if err := h.svc.DeleteLocker(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "locker deleted"})
}

// POST /api/v1/locker-allotments
func (h *LockerHandler) AllocateLocker(w http.ResponseWriter, r *http.Request) {
	var req services.AllocateLockerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	a, err := h.svc.AllocateLocker(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, a)
}

// GET /api/v1/locker-allotments
func (h *LockerHandler) ListActiveAllotments(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.ListActiveAllotments()
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{"allotments": list})
}

// GET /api/v1/members/{id}/locker-allotments
func (h *LockerHandler) ListAllotmentsByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	list, err := h.svc.ListAllotmentsByMember(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{"allotments": list})
}

// POST /api/v1/locker-allotments/{id}/mark-paid
func (h *LockerHandler) MarkFeePaid(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid allotment id"))
		return
	}
	a, err := h.svc.MarkFeePaid(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, a)
}

// POST /api/v1/locker-allotments/{id}/release
func (h *LockerHandler) ReleaseLocker(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid allotment id"))
		return
	}
	a, err := h.svc.ReleaseLocker(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, a)
}
