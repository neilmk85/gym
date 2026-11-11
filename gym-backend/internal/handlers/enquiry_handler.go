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

// ─── Enquiry Handler ──────────────────────────────────────────────────────────

type EnquiryHandler struct {
	svc services.EnquiryService
}

func NewEnquiryHandler(svc services.EnquiryService) *EnquiryHandler {
	return &EnquiryHandler{svc: svc}
}

// POST /api/v1/enquiries
func (h *EnquiryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreateEnquiryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	e, err := h.svc.Create(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, e)
}

// GET /api/v1/enquiries
func (h *EnquiryHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var facilityID *uint
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		if id, err := strconv.ParseUint(fid, 10, 64); err == nil {
			uid := uint(id)
			facilityID = &uid
		}
	}

	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")

	enquiries, total, err := h.svc.List(req, facilityID, status, search)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"enquiries": enquiries,
		"meta":      utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/enquiries/{id}
func (h *EnquiryHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	e, err := h.svc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, e)
}

// PATCH /api/v1/enquiries/{id}
func (h *EnquiryHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	var req services.UpdateEnquiryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	e, err := h.svc.Update(id, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, e)
}

// DELETE /api/v1/enquiries/{id}
func (h *EnquiryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid enquiry id"))
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Enquiry deleted"})
}
