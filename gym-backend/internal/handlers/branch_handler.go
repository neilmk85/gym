package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

type BranchHandler struct {
	svc services.BranchService
}

func NewBranchHandler(svc services.BranchService) *BranchHandler {
	return &BranchHandler{svc: svc}
}

// POST /api/v1/branches
func (h *BranchHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req services.CreateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	b, err := h.svc.CreateBranch(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, b)
}

// GET /api/v1/branches
func (h *BranchHandler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.ListBranches()
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// GET /api/v1/branches/{id}
func (h *BranchHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid branch id"))
		return
	}
	b, err := h.svc.GetBranch(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, b)
}

// PATCH /api/v1/branches/{id}
func (h *BranchHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid branch id"))
		return
	}
	var req services.UpdateBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	b, err := h.svc.UpdateBranch(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, b)
}

// DELETE /api/v1/branches/{id}
func (h *BranchHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid branch id"))
		return
	}
	if err := h.svc.DeleteBranch(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "deleted"})
}
