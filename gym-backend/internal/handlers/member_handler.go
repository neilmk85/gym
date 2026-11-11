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

type MemberHandler struct {
	memberSvc services.MemberService
}

func NewMemberHandler(memberSvc services.MemberService) *MemberHandler {
	return &MemberHandler{memberSvc: memberSvc}
}

// POST /api/v1/members
func (h *MemberHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CreateMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	member, err := h.memberSvc.Create(req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, member)
}

// GET /api/v1/members
func (h *MemberHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var facilityID *uint
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		id, err := strconv.ParseUint(fid, 10, 64)
		if err == nil {
			uid := uint(id)
			facilityID = &uid
		}
	}

	members, total, err := h.memberSvc.List(req, facilityID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"members": members,
		"meta":    utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/members/{id}
func (h *MemberHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	member, err := h.memberSvc.GetByID(id, claims.UserID, claims.Role)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, member)
}

// GET /api/v1/members/me
func (h *MemberHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	member, err := h.memberSvc.GetByUserID(claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, member)
}

// PATCH /api/v1/members/{id}
func (h *MemberHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.UpdateMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	member, err := h.memberSvc.Update(id, req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, member)
}

// DELETE /api/v1/members/{id}
func (h *MemberHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var body struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	if err := h.memberSvc.SoftDelete(id, body.Reason, claims.UserID, r.RemoteAddr); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Member deleted"})
}

// POST /api/v1/members/{id}/freeze
func (h *MemberHandler) Freeze(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	var body struct {
		Months int    `json:"months"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.memberSvc.Freeze(id, body.Months, body.Reason, claims.UserID); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Membership frozen"})
}

// POST /api/v1/members/{id}/unfreeze
func (h *MemberHandler) Unfreeze(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())
	if err := h.memberSvc.Unfreeze(id, claims.UserID); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Membership unfrozen"})
}

// PATCH /api/v1/members/{id}/assign-trainer
// Body: { "trainer_id": 5, "trainer_name": "John Smith" } or { "trainer_id": null } to unassign
func (h *MemberHandler) AssignTrainer(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	var body struct {
		TrainerID   *uint  `json:"trainer_id"`
		TrainerName string `json:"trainer_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	if err := h.memberSvc.AssignTrainer(memberID, body.TrainerID, body.TrainerName); err != nil {
		response.Error(w, r, err)
		return
	}

	msg := "Trainer assigned successfully"
	if body.TrainerID == nil {
		msg = "Trainer unassigned"
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"message": msg})
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func pathUint(r *http.Request, key string) (uint, error) {
	val := r.PathValue(key)
	id, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}
