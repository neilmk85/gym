package handlers

import (
	"net/http"
	"strconv"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/middleware"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

type ReportHandler struct {
	reportSvc services.ReportService
}

func NewReportHandler(reportSvc services.ReportService) *ReportHandler {
	return &ReportHandler{reportSvc: reportSvc}
}

// parseFacilityID reads ?facility_id= or falls back to the claims' facility if
// the caller is an admin/manager.  Returns 0 when no facility can be determined
// (caller should return a validation error).
func parseFacilityID(r *http.Request, claims *services.Claims) (uint, error) {
	q := r.URL.Query().Get("facility_id")
	if q != "" {
		v, err := strconv.ParseUint(q, 10, 64)
		if err != nil || v == 0 {
			return 0, apperrors.ErrValidation("invalid facility_id")
		}
		return uint(v), nil
	}
	// TODO: when multi-facility support lands, look up the user's facility_id.
	// For now default to facility 1 when not supplied.
	_ = claims
	return 1, nil
}

// GET /api/v1/reports/dashboard
func (h *ReportHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	stats, err := h.reportSvc.Dashboard(facilityID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, stats)
}

// GET /api/v1/reports/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD&facility_id=
func (h *ReportHandler) Revenue(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	dr, err := services.ParseDateRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		response.Error(w, r, err)
		return
	}

	rep, err := h.reportSvc.Revenue(facilityID, dr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	if r.URL.Query().Get("format") == "csv" {
		revenueCSV(w, rep)
		return
	}
	response.JSON(w, r, http.StatusOK, rep)
}

// GET /api/v1/reports/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD&facility_id=
func (h *ReportHandler) Attendance(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	dr, err := services.ParseDateRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		response.Error(w, r, err)
		return
	}

	rep, err := h.reportSvc.Attendance(facilityID, dr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	if r.URL.Query().Get("format") == "csv" {
		attendanceCSV(w, rep)
		return
	}
	response.JSON(w, r, http.StatusOK, rep)
}

// GET /api/v1/reports/members?facility_id=
func (h *ReportHandler) Members(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	rep, err := h.reportSvc.Members(facilityID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	if r.URL.Query().Get("format") == "csv" {
		membersCSV(w, rep)
		return
	}
	response.JSON(w, r, http.StatusOK, rep)
}

// GET /api/v1/reports/subscriptions?facility_id=
func (h *ReportHandler) Subscriptions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	rep, err := h.reportSvc.Subscriptions(facilityID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, rep)
}

// GET /api/v1/members/{id}/timeline?limit=30
func (h *ReportHandler) MemberTimeline(w http.ResponseWriter, r *http.Request) {
	memberID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid member id"))
		return
	}

	limit := 30
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}

	events, err := h.reportSvc.MemberTimeline(memberID, limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"member_id": memberID,
		"events":    events,
		"count":     len(events),
	})
}

// GET /api/v1/reports/classes?from=YYYY-MM-DD&to=YYYY-MM-DD&facility_id=
func (h *ReportHandler) Classes(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	dr, err := services.ParseDateRange(r.URL.Query().Get("from"), r.URL.Query().Get("to"))
	if err != nil {
		response.Error(w, r, err)
		return
	}

	rep, err := h.reportSvc.Classes(facilityID, dr)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	if r.URL.Query().Get("format") == "csv" {
		classesCSV(w, rep)
		return
	}
	response.JSON(w, r, http.StatusOK, rep)
}

// GET /api/v1/reports/inactive-members?days=30
func (h *ReportHandler) InactiveMembers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	days := 30
	if d := r.URL.Query().Get("days"); d != "" {
		if v, err2 := strconv.Atoi(d); err2 == nil && v > 0 {
			days = v
		}
	}

	rows, err := h.reportSvc.InactiveMembers(facilityID, days)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"days":    days,
		"count":   len(rows),
		"members": rows,
	})
}

// GET /api/v1/reports/trainers?facility_id=
func (h *ReportHandler) Trainers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	rep, err := h.reportSvc.Trainers(facilityID)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, rep)
}

// GET /api/v1/reports/expiring?days=7
func (h *ReportHandler) ExpiringMembers(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	facilityID, err := parseFacilityID(r, claims)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	days := 7
	if d := r.URL.Query().Get("days"); d != "" {
		if v, err2 := strconv.Atoi(d); err2 == nil && v > 0 {
			days = v
		}
	}

	rows, err := h.reportSvc.ExpiringMembers(facilityID, days)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"days":    days,
		"count":   len(rows),
		"members": rows,
	})
}
