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

type AttendanceHandler struct {
	attendanceSvc services.AttendanceService
}

func NewAttendanceHandler(attendanceSvc services.AttendanceService) *AttendanceHandler {
	return &AttendanceHandler{attendanceSvc: attendanceSvc}
}

// GET /api/v1/members/{id}/qr-code
// Generates (or regenerates) the QR token for a member.
func (h *AttendanceHandler) GenerateQRCode(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	facilityID := uint(0)
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		id, err := strconv.ParseUint(fid, 10, 64)
		if err != nil {
			response.Error(w, r, apperrors.ErrValidation("invalid facility_id"))
			return
		}
		facilityID = uint(id)
	}

	token, err := h.attendanceSvc.GenerateQRToken(memberID, facilityID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{
		"qr_token": token,
		"hint":     "encode this token as a QR code in the client",
	})
}

// POST /api/v1/attendance/check-in
func (h *AttendanceHandler) CheckIn(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CheckInRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	// Member role: can only check themselves in.
	if claims.Role == "member" {
		member, err := getMemberIDFromClaims(r, claims)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		req.MemberID = member
	}

	attendance, err := h.attendanceSvc.CheckIn(req, claims.UserID, r.RemoteAddr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, attendance)
}

// POST /api/v1/attendance/check-out
// Body: { "member_id": 1 } — checks out the open session for that member.
func (h *AttendanceHandler) CheckOutByMember(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())

	var body struct {
		MemberID uint   `json:"member_id"`
		Notes    string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	if claims.Role == "member" {
		member, err := getMemberIDFromClaims(r, claims)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		body.MemberID = member
	}

	if body.MemberID == 0 {
		response.Error(w, r, apperrors.ErrValidation("member_id is required"))
		return
	}

	attendance, err := h.attendanceSvc.CheckOutByMember(body.MemberID,
		services.CheckOutRequest{Notes: body.Notes}, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, attendance)
}

// PATCH /api/v1/attendance/{id}/check-out
// Checks out a specific attendance record by ID.
func (h *AttendanceHandler) CheckOut(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid attendance id"))
		return
	}

	claims := middleware.ClaimsFromContext(r.Context())

	var req services.CheckOutRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	attendance, err := h.attendanceSvc.CheckOut(id, req, claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, attendance)
}

// GET /api/v1/attendance/{id}
func (h *AttendanceHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid attendance id"))
		return
	}

	a, err := h.attendanceSvc.GetByID(id)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, a)
}

// GET /api/v1/attendance
// Query params: facility_id, member_id, method, from, to, page, per_page
func (h *AttendanceHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var facilityID *uint
	if fid := r.URL.Query().Get("facility_id"); fid != "" {
		id, err := strconv.ParseUint(fid, 10, 64)
		if err == nil {
			uid := uint(id)
			facilityID = &uid
		}
	}

	var memberID *uint
	if mid := r.URL.Query().Get("member_id"); mid != "" {
		id, err := strconv.ParseUint(mid, 10, 64)
		if err == nil {
			uid := uint(id)
			memberID = &uid
		}
	}

	records, total, err := h.attendanceSvc.List(req, facilityID, memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"attendance": records,
		"meta":       utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/members/{id}/attendance
func (h *AttendanceHandler) ListByMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	req := utils.ParsePageRequest(r)
	mid := memberID
	records, total, err := h.attendanceSvc.List(req, nil, &mid)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"attendance": records,
		"meta":       utils.BuildPageMeta(req, total),
	})
}

// GET /api/v1/members/{id}/attendance/stats
func (h *AttendanceHandler) Stats(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	stats, err := h.attendanceSvc.Stats(memberID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, stats)
}

// ─── helper ───────────────────────────────────────────────────────────────────

// getMemberIDFromClaims resolves a member_id for the authenticated member role user.
// In a full implementation this would be cached or use a separate claim field.
// For now we embed it as a zero value and rely on the service layer to re-look up by user_id.
// We return 0 here and the caller must handle the lookup via a different path.
func getMemberIDFromClaims(_ *http.Request, _ *services.Claims) (uint, error) {
	// The member_id is not in the JWT claims by default.
	// Return 0 to signal "let the service look it up by user_id".
	// The service's CheckIn accepts MemberID=0 for member role and
	// resolves via actorID (UserID from claims).
	return 0, nil
}
