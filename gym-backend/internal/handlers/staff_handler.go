package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type StaffHandler struct {
	svc services.StaffService
}

func NewStaffHandler(svc services.StaffService) *StaffHandler {
	return &StaffHandler{svc: svc}
}

// POST /api/v1/staff
func (h *StaffHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req services.CreateStaffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	s, err := h.svc.Create(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, s)
}

// GET /api/v1/staff
func (h *StaffHandler) List(w http.ResponseWriter, r *http.Request) {
	pr := utils.ParsePageRequest(r)
	status := r.URL.Query().Get("status")
	department := r.URL.Query().Get("department")
	search := r.URL.Query().Get("search")
	list, total, err := h.svc.List(status, department, search, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"data": list,
		"meta": utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/staff/{id}
func (h *StaffHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	s, err := h.svc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, s)
}

// PATCH /api/v1/staff/{id}
func (h *StaffHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	var req services.UpdateStaffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	s, err := h.svc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, s)
}

// DELETE /api/v1/staff/{id}
func (h *StaffHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id64, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	if err := h.svc.Delete(uint(id64)); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}
