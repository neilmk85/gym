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

type PTHandler struct {
	ptSvc     services.PTService
	memberSvc services.MemberService
}

func NewPTHandler(ptSvc services.PTService, memberSvc services.MemberService) *PTHandler {
	return &PTHandler{ptSvc: ptSvc, memberSvc: memberSvc}
}

// ── PT Package Catalog ────────────────────────────────────────────────────────

// POST /api/v1/pt-packages
func (h *PTHandler) CreatePackage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.CreatePTPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.FacilityID == 0 {
		req.FacilityID = 1
	}
	pkg, err := h.ptSvc.CreatePackage(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, pkg)
}

// GET /api/v1/pt-packages
func (h *PTHandler) ListPackages(w http.ResponseWriter, r *http.Request) {
	facilityID, _ := queryUintOr(r, "facility_id", 1)
	pkgs, err := h.ptSvc.ListPackages(facilityID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{"pt_packages": pkgs})
}

// GET /api/v1/pt-packages/{id}
func (h *PTHandler) GetPackage(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid pt package id"))
		return
	}
	pkg, err := h.ptSvc.GetPackage(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, pkg)
}

// DELETE /api/v1/pt-packages/{id}
func (h *PTHandler) DeactivatePackage(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid pt package id"))
		return
	}
	if err := h.ptSvc.DeactivatePackage(id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]string{"status": "deactivated"})
}

// ── Member PT Package Purchases ───────────────────────────────────────────────

// POST /api/v1/member-pt-packages
func (h *PTHandler) PurchasePackage(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.PurchasePTPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.FacilityID == 0 {
		req.FacilityID = 1
	}
	memPkg, err := h.ptSvc.PurchasePackage(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, memPkg)
}

// GET /api/v1/member-pt-packages
func (h *PTHandler) ListAllMemberPackages(w http.ResponseWriter, r *http.Request) {
	facilityID, _ := queryUintOr(r, "facility_id", 1)
	pr := utils.ParsePageRequest(r)
	list, total, err := h.ptSvc.ListAllMemberPackages(facilityID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"member_pt_packages": list,
		"meta": map[string]any{
			"total":    total,
			"page":     pr.Page,
			"per_page": pr.PerPage,
		},
	})
}

// GET /api/v1/member-pt-packages/{id}
func (h *PTHandler) GetMemberPackage(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member pt package id"))
		return
	}
	memPkg, err := h.ptSvc.GetMemberPackage(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, memPkg)
}

// GET /api/v1/members/{id}/pt-packages
func (h *PTHandler) ListMemberPackages(w http.ResponseWriter, r *http.Request) {
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
	pkgs, total, err := h.ptSvc.ListMemberPackages(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"pt_packages": pkgs,
		"meta":        utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/members/{id}/pt-packages/active
func (h *PTHandler) GetActivePackagesForMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	if !requireMemberOwnership(w, r, claims, memberID, h.memberSvc) {
		return
	}
	pkgs, err := h.ptSvc.GetActivePackagesForMember(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{"pt_packages": pkgs})
}

// ── PT Sessions ───────────────────────────────────────────────────────────────

// GET /api/v1/pt-sessions  (facility-wide admin view)
func (h *PTHandler) ListAllSessions(w http.ResponseWriter, r *http.Request) {
	facilityID, _ := queryUintOr(r, "facility_id", 1)
	trainerID, _  := queryUintOr(r, "trainer_id", 0)
	status        := r.URL.Query().Get("status")
	pr            := utils.ParsePageRequest(r)
	list, total, err := h.ptSvc.ListSessionsByFacility(facilityID, trainerID, status, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"pt_sessions": list,
		"meta":        map[string]any{"total": total, "page": pr.Page, "per_page": pr.PerPage},
	})
}

// POST /api/v1/pt-sessions
func (h *PTHandler) ScheduleSession(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	var req services.SchedulePTSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	session, err := h.ptSvc.ScheduleSession(req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, session)
}

// GET /api/v1/pt-sessions/{id}
func (h *PTHandler) GetSession(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid session id"))
		return
	}
	session, err := h.ptSvc.GetSession(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, session)
}

// POST /api/v1/pt-sessions/{id}/complete
func (h *PTHandler) CompleteSession(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid session id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	var body struct {
		TrainerNotes string `json:"trainer_notes"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	session, err := h.ptSvc.CompleteSession(id, body.TrainerNotes, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, session)
}

// POST /api/v1/pt-sessions/{id}/cancel
func (h *PTHandler) CancelSession(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid session id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	var body struct {
		Reason string `json:"reason"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	session, err := h.ptSvc.CancelSession(id, body.Reason, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, session)
}

// POST /api/v1/pt-sessions/{id}/no-show
func (h *PTHandler) MarkNoShow(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid session id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	session, err := h.ptSvc.MarkNoShow(id, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, session)
}

// GET /api/v1/members/{id}/pt-sessions
func (h *PTHandler) ListSessionsByMember(w http.ResponseWriter, r *http.Request) {
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
	sessions, total, err := h.ptSvc.ListSessionsByMember(memberID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"pt_sessions": sessions,
		"meta":        utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/trainers/{id}/pt-sessions
func (h *PTHandler) ListSessionsByTrainer(w http.ResponseWriter, r *http.Request) {
	trainerID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid trainer id"))
		return
	}
	pr := utils.ParsePageRequest(r)
	sessions, total, err := h.ptSvc.ListSessionsByTrainer(trainerID, pr.Page, pr.PerPage)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"pt_sessions": sessions,
		"meta":        utils.BuildPageMeta(pr, total),
	})
}

// GET /api/v1/members/{id}/session-credits
func (h *PTHandler) GetSessionCredits(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}
	claims := middleware.ClaimsFromContext(r.Context())
	if !requireMemberOwnership(w, r, claims, memberID, h.memberSvc) {
		return
	}
	credits, err := h.ptSvc.GetSessionCredits(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{"credits": credits})
}
