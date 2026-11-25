package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/middleware"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gorm.io/gorm"
)

func facilityIDFromContext(r *http.Request) uint {
	_ = middleware.ClaimsFromContext(r.Context()) // ensure import used
	return 1 // single-facility app
}

func actorIDFromContext(r *http.Request) uint {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims != nil {
		return claims.UserID
	}
	return 0
}

type StaffAttendanceHandler struct {
	svc services.StaffAttendanceService
	db  *gorm.DB
}

func NewStaffAttendanceHandler(svc services.StaffAttendanceService, db *gorm.DB) *StaffAttendanceHandler {
	return &StaffAttendanceHandler{svc: svc, db: db}
}

type AttendanceSummaryRow struct {
	StaffID       uint    `json:"staff_id"`
	TrainerID     *uint   `json:"trainer_id,omitempty"`
	EmployeeID    string  `json:"employee_id"`
	FirstName     string  `json:"first_name"`
	LastName      string  `json:"last_name"`
	Role          string  `json:"role"`
	ExpectedDays  int     `json:"expected_days"`
	ExpectedHours float64 `json:"expected_hours"`
	PresentDays   float64 `json:"present_days"` // 0.5 for half-day
	AbsentDays    int     `json:"absent_days"`
	HoursWorked   float64 `json:"hours_worked"`
	AttendancePct float64 `json:"attendance_pct"`
}

// countMonSat returns the number of Mon–Sat days in [from, to] inclusive.
func countMonSat(from, to time.Time) int {
	count := 0
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		if d.Weekday() != time.Sunday {
			count++
		}
	}
	return count
}

// GET /api/v1/staff/attendance/summary?from=2026-11-01&to=2026-11-30&type=trainer&standard_hours=9
func (h *StaffAttendanceHandler) Summary(w http.ResponseWriter, r *http.Request) {
	fromStr := r.URL.Query().Get("from")
	toStr := r.URL.Query().Get("to")
	attendanceType := r.URL.Query().Get("type") // "trainer" or "staff"
	standardHours, _ := strconv.ParseFloat(r.URL.Query().Get("standard_hours"), 64)
	if standardHours <= 0 {
		standardHours = 9
	}

	fromDate, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid from date (use yyyy-MM-dd)"))
		return
	}
	toDate, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid to date (use yyyy-MM-dd)"))
		return
	}
	if toDate.Before(fromDate) {
		response.Error(w, r, apperrors.ErrValidation("to must be on or after from"))
		return
	}

	expectedDays := countMonSat(fromDate, toDate)
	expectedHours := float64(expectedDays) * standardHours

	var rows []AttendanceSummaryRow

	if attendanceType == "trainer" {
		// Trainers: aggregate biometric punches
		type trainerRow struct {
			StaffID     uint    `gorm:"column:staff_id"`
			TrainerID   uint    `gorm:"column:trainer_id"`
			EmployeeID  string  `gorm:"column:employee_id"`
			FirstName   string  `gorm:"column:first_name"`
			LastName    string  `gorm:"column:last_name"`
			PresentDays int     `gorm:"column:present_days"`
			HoursWorked float64 `gorm:"column:hours_worked"`
		}
		var raw []trainerRow
		toEnd := toDate.Add(24*time.Hour - time.Second)
		h.db.Raw(`
			SELECT s.id AS staff_id, tp.id AS trainer_id,
			       s.employee_id, s.first_name, s.last_name,
			       COUNT(DISTINCT DATE(tpu.punched_at)) AS present_days,
			       COALESCE(SUM(dh.daily_hours), 0) AS hours_worked
			FROM staffs s
			JOIN trainer_profiles tp ON tp.staff_id = s.id
			LEFT JOIN (
			    SELECT trainer_id, DATE(punched_at) AS punch_date,
			           TIMESTAMPDIFF(MINUTE, MIN(punched_at), MAX(punched_at)) / 60.0 AS daily_hours
			    FROM trainer_punches
			    WHERE punched_at >= ? AND punched_at <= ?
			    GROUP BY trainer_id, DATE(punched_at)
			) dh ON dh.trainer_id = tp.id
			LEFT JOIN trainer_punches tpu ON tpu.trainer_id = tp.id
			    AND tpu.punched_at >= ? AND tpu.punched_at <= ?
			WHERE s.status = 'active'
			GROUP BY s.id, tp.id
			ORDER BY s.first_name
		`, fromDate, toEnd, fromDate, toEnd).Scan(&raw)

		for _, r := range raw {
			tid := r.TrainerID
			pct := 0.0
			if expectedDays > 0 {
				pct = float64(r.PresentDays) / float64(expectedDays) * 100
			}
			rows = append(rows, AttendanceSummaryRow{
				StaffID:       r.StaffID,
				TrainerID:     &tid,
				EmployeeID:    r.EmployeeID,
				FirstName:     r.FirstName,
				LastName:      r.LastName,
				Role:          "trainer",
				ExpectedDays:  expectedDays,
				ExpectedHours: expectedHours,
				PresentDays:   float64(r.PresentDays),
				AbsentDays:    expectedDays - r.PresentDays,
				HoursWorked:   r.HoursWorked,
				AttendancePct: pct,
			})
		}
	} else {
		// Non-trainer staff: aggregate manual attendance records
		type staffRow struct {
			StaffID     uint    `gorm:"column:staff_id"`
			EmployeeID  string  `gorm:"column:employee_id"`
			FirstName   string  `gorm:"column:first_name"`
			LastName    string  `gorm:"column:last_name"`
			Role        string  `gorm:"column:role"`
			PresentDays int     `gorm:"column:present_days"`
			HalfDays    int     `gorm:"column:half_days"`
			AbsentDays  int     `gorm:"column:absent_days"`
		}
		var raw []staffRow
		h.db.Raw(`
			SELECT s.id AS staff_id, s.employee_id, s.first_name, s.last_name, s.role,
			       COALESCE(SUM(CASE WHEN sa.status = 'present'  THEN 1 ELSE 0 END), 0) AS present_days,
			       COALESCE(SUM(CASE WHEN sa.status = 'half_day' THEN 1 ELSE 0 END), 0) AS half_days,
			       COALESCE(SUM(CASE WHEN sa.status = 'absent'   THEN 1 ELSE 0 END), 0) AS absent_days
			FROM staffs s
			LEFT JOIN staff_attendances sa ON sa.staff_id = s.id
			    AND sa.date >= ? AND sa.date <= ?
			WHERE s.status = 'active' AND s.role != 'trainer'
			GROUP BY s.id
			ORDER BY s.first_name
		`, fromDate, toDate).Scan(&raw)

		for _, r := range raw {
			effectiveDays := float64(r.PresentDays) + float64(r.HalfDays)*0.5
			hoursWorked := effectiveDays * standardHours
			pct := 0.0
			if expectedDays > 0 {
				pct = effectiveDays / float64(expectedDays) * 100
			}
			absentDays := expectedDays - r.PresentDays - r.HalfDays
			if absentDays < 0 {
				absentDays = 0
			}
			rows = append(rows, AttendanceSummaryRow{
				StaffID:       r.StaffID,
				EmployeeID:    r.EmployeeID,
				FirstName:     r.FirstName,
				LastName:      r.LastName,
				Role:          r.Role,
				ExpectedDays:  expectedDays,
				ExpectedHours: expectedHours,
				PresentDays:   effectiveDays,
				AbsentDays:    absentDays,
				HoursWorked:   hoursWorked,
				AttendancePct: pct,
			})
		}
	}

	if rows == nil {
		rows = []AttendanceSummaryRow{}
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"rows":           rows,
		"expected_days":  expectedDays,
		"expected_hours": expectedHours,
		"standard_hours": standardHours,
		"from":           fromStr,
		"to":             toStr,
	})
}

// POST /api/v1/staff/{id}/attendance
func (h *StaffAttendanceHandler) MarkAttendance(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}

	facilityID := facilityIDFromContext(r)
	actorID := actorIDFromContext(r)

	var req services.MarkAttendanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	a, err := h.svc.MarkAttendance(facilityID, staffID, actorID, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, a)
}

// GET /api/v1/staff/{id}/attendance?month=11&year=2026
func (h *StaffAttendanceHandler) ListByStaff(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))

	list, err := h.svc.ListByStaff(staffID, month, year)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// GET /api/v1/staff/attendance?date=2026-11-12
func (h *StaffAttendanceHandler) ListByDate(w http.ResponseWriter, r *http.Request) {
	facilityID := facilityIDFromContext(r)
	date := r.URL.Query().Get("date")
	list, err := h.svc.ListByDate(facilityID, date)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// GET /api/v1/staff/attendance/monthly?month=11&year=2026
func (h *StaffAttendanceHandler) ListByMonth(w http.ResponseWriter, r *http.Request) {
	facilityID := facilityIDFromContext(r)
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))

	list, err := h.svc.ListByMonth(facilityID, month, year)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// POST /api/v1/staff/{id}/salary-slip?month=11&year=2026
func (h *StaffAttendanceHandler) GenerateSalarySlip(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	facilityID := facilityIDFromContext(r)
	actorID := actorIDFromContext(r)

	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}

	var req services.GenerateSlipRequest
	if r.ContentLength > 0 {
		json.NewDecoder(r.Body).Decode(&req)
	}

	slip, err := h.svc.GenerateSalarySlip(facilityID, staffID, actorID, month, year, req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, slip)
}

// GET /api/v1/staff/{id}/salary-slip?month=11&year=2026
func (h *StaffAttendanceHandler) GetSalarySlip(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))
	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}

	slip, err := h.svc.GetSalarySlipByStaff(staffID, month, year)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if slip == nil {
		response.JSON(w, r, http.StatusOK, nil)
		return
	}
	response.JSON(w, r, http.StatusOK, slip)
}

// GET /api/v1/staff/salary-slips?month=11&year=2026
func (h *StaffAttendanceHandler) ListSalarySlips(w http.ResponseWriter, r *http.Request) {
	facilityID := facilityIDFromContext(r)
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))

	list, err := h.svc.ListSalarySlips(facilityID, month, year)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}

// PATCH /api/v1/staff/salary-slips/{id}/status
func (h *StaffAttendanceHandler) UpdateSlipStatus(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id64, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid slip id"))
		return
	}

	var body struct {
		Status string     `json:"status"`
		PaidAt *time.Time `json:"paid_at,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if body.Status == "" {
		response.Error(w, r, apperrors.ErrValidation("status is required"))
		return
	}

	slip, err := h.svc.UpdateSlipStatus(uint(id64), body.Status, body.PaidAt)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, slip)
}

// GET /api/v1/staff/{id}/salary-slips/history
func (h *StaffAttendanceHandler) ListSlipsByStaff(w http.ResponseWriter, r *http.Request) {
	staffID, err := pathUint(r, "id")
	if err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid staff id"))
		return
	}
	facilityID := facilityIDFromContext(r)

	list, err := h.svc.ListSlipsByStaff(facilityID, staffID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, list)
}
