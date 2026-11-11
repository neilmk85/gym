package services

import (
	"log/slog"
	"math"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

type MarkAttendanceRequest struct {
	Date         string  `json:"date"`          // "2026-11-12"
	Status       string  `json:"status"`        // present, absent, half_day, leave, holiday
	CheckIn      string  `json:"check_in"`      // "09:00"
	CheckOut     string  `json:"check_out"`     // "18:00"
	WorkingHours float64 `json:"working_hours"`
	Notes        string  `json:"notes"`
}

type GenerateSlipRequest struct {
	WorkingDays int     `json:"working_days"` // override default 26
	Bonus       float64 `json:"bonus"`
	Deductions  float64 `json:"deductions"`
	Notes       string  `json:"notes"`
}

type StaffAttendanceService interface {
	MarkAttendance(facilityID, staffID, actorID uint, req MarkAttendanceRequest) (*models.StaffAttendance, error)
	ListByStaff(staffID uint, month, year int) ([]*models.StaffAttendance, error)
	ListByDate(facilityID uint, date string) ([]*models.StaffAttendance, error)
	ListByMonth(facilityID uint, month, year int) ([]*models.StaffAttendance, error)

	GenerateSalarySlip(facilityID, staffID, actorID uint, month, year int, req GenerateSlipRequest) (*models.SalarySlip, error)
	GetSalarySlip(slipID uint) (*models.SalarySlip, error)
	GetSalarySlipByStaff(staffID uint, month, year int) (*models.SalarySlip, error)
	ListSalarySlips(facilityID uint, month, year int) ([]*models.SalarySlip, error)
	ListSlipsByStaff(facilityID, staffID uint) ([]*models.SalarySlip, error)
	UpdateSlipStatus(slipID uint, status string, paidAt *time.Time) (*models.SalarySlip, error)
}

type staffAttendanceService struct {
	repo      repositories.StaffAttendanceRepository
	staffRepo repositories.StaffRepository
	logger    *slog.Logger
}

func NewStaffAttendanceService(
	repo repositories.StaffAttendanceRepository,
	staffRepo repositories.StaffRepository,
	logger *slog.Logger,
) StaffAttendanceService {
	return &staffAttendanceService{repo: repo, staffRepo: staffRepo, logger: logger}
}

func (s *staffAttendanceService) MarkAttendance(facilityID, staffID, actorID uint, req MarkAttendanceRequest) (*models.StaffAttendance, error) {
	staff, err := s.staffRepo.FindByID(staffID)
	if err != nil || staff == nil {
		return nil, apperrors.New(404, "STAFF_NOT_FOUND", "staff member not found", "")
	}

	date := time.Now()
	if req.Date != "" {
		if t, err := time.Parse("2006-01-02", req.Date); err == nil {
			date = t
		}
	}

	status := req.Status
	if status == "" {
		status = models.AttendanceStatusPresent
	}

	// Upsert: update if record exists for this staff+date
	existing, _ := s.repo.FindByStaffAndDate(staffID, date)
	if existing != nil {
		existing.Status = status
		if req.CheckIn != "" {
			existing.CheckIn = &req.CheckIn
		}
		if req.CheckOut != "" {
			existing.CheckOut = &req.CheckOut
		}
		if req.WorkingHours > 0 {
			existing.WorkingHours = req.WorkingHours
		} else if req.CheckIn != "" && req.CheckOut != "" {
			existing.WorkingHours = calcHours(req.CheckIn, req.CheckOut)
		}
		if req.Notes != "" {
			existing.Notes = req.Notes
		}
		existing.MarkedByID = actorID
		if err := s.repo.Update(existing); err != nil {
			return nil, apperrors.ErrInternal
		}
		return existing, nil
	}

	a := &models.StaffAttendance{
		FacilityID: facilityID,
		StaffID:    staffID,
		Date:       date,
		Status:     status,
		Notes:      req.Notes,
		MarkedByID: actorID,
	}
	if req.CheckIn != "" {
		a.CheckIn = &req.CheckIn
	}
	if req.CheckOut != "" {
		a.CheckOut = &req.CheckOut
	}
	if req.WorkingHours > 0 {
		a.WorkingHours = req.WorkingHours
	} else if req.CheckIn != "" && req.CheckOut != "" {
		a.WorkingHours = calcHours(req.CheckIn, req.CheckOut)
	}

	if err := s.repo.Create(a); err != nil {
		s.logger.Error("mark attendance failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return a, nil
}

func (s *staffAttendanceService) ListByStaff(staffID uint, month, year int) ([]*models.StaffAttendance, error) {
	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}
	list, err := s.repo.ListByStaff(staffID, month, year)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	return list, nil
}

func (s *staffAttendanceService) ListByDate(facilityID uint, dateStr string) ([]*models.StaffAttendance, error) {
	date := time.Now()
	if dateStr != "" {
		if t, err := time.Parse("2006-01-02", dateStr); err == nil {
			date = t
		}
	}
	list, err := s.repo.ListByDate(facilityID, date)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	return list, nil
}

func (s *staffAttendanceService) ListByMonth(facilityID uint, month, year int) ([]*models.StaffAttendance, error) {
	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}
	list, err := s.repo.ListByMonth(facilityID, month, year)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	return list, nil
}

func (s *staffAttendanceService) GenerateSalarySlip(facilityID, staffID, actorID uint, month, year int, req GenerateSlipRequest) (*models.SalarySlip, error) {
	staff, err := s.staffRepo.FindByID(staffID)
	if err != nil || staff == nil {
		return nil, apperrors.New(404, "STAFF_NOT_FOUND", "staff member not found", "")
	}

	present, halfDay, absent, leave, holiday := s.repo.CountByStaffAndMonth(staffID, month, year)

	workingDays := req.WorkingDays
	if workingDays <= 0 {
		workingDays = workingDaysInMonth(month, year)
	}

	// EarnedSalary = BaseSalary * effectiveDays / workingDays
	// Leave days count as paid; holiday days don't deduct
	effectiveDays := float64(present) + float64(halfDay)*0.5 + float64(leave) + float64(holiday)
	if effectiveDays > float64(workingDays) {
		effectiveDays = float64(workingDays)
	}

	earnedSalary := staff.Salary * effectiveDays / float64(workingDays)
	earnedSalary = math.Round(earnedSalary*100) / 100

	netSalary := earnedSalary + req.Bonus - req.Deductions
	if netSalary < 0 {
		netSalary = 0
	}
	netSalary = math.Round(netSalary*100) / 100

	// Upsert salary slip
	existing, _ := s.repo.FindSlipByStaffAndMonth(staffID, month, year)
	if existing != nil && existing.Status == models.SalarySlipStatusPaid {
		return nil, apperrors.ErrValidation("salary slip already marked as paid")
	}

	if existing != nil {
		existing.WorkingDays = workingDays
		existing.PresentDays = present
		existing.AbsentDays = absent
		existing.HalfDays = halfDay
		existing.LeaveDays = leave
		existing.HolidayDays = holiday
		existing.BaseSalary = staff.Salary
		existing.EarnedSalary = earnedSalary
		existing.Deductions = req.Deductions
		existing.Bonus = req.Bonus
		existing.NetSalary = netSalary
		if req.Notes != "" {
			existing.Notes = req.Notes
		}
		existing.GeneratedByID = actorID
		if err := s.repo.UpdateSlip(existing); err != nil {
			return nil, apperrors.ErrInternal
		}
		return existing, nil
	}

	slip := &models.SalarySlip{
		FacilityID:    facilityID,
		StaffID:       staffID,
		Month:         month,
		Year:          year,
		WorkingDays:   workingDays,
		PresentDays:   present,
		AbsentDays:    absent,
		HalfDays:      halfDay,
		LeaveDays:     leave,
		HolidayDays:   holiday,
		BaseSalary:    staff.Salary,
		EarnedSalary:  earnedSalary,
		Deductions:    req.Deductions,
		Bonus:         req.Bonus,
		NetSalary:     netSalary,
		Status:        models.SalarySlipStatusDraft,
		Notes:         req.Notes,
		GeneratedByID: actorID,
	}
	if err := s.repo.CreateSlip(slip); err != nil {
		s.logger.Error("create salary slip failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return slip, nil
}

func (s *staffAttendanceService) GetSalarySlip(slipID uint) (*models.SalarySlip, error) {
	slip, err := s.repo.FindSlipByID(slipID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if slip == nil {
		return nil, apperrors.New(404, "SLIP_NOT_FOUND", "salary slip not found", "")
	}
	return slip, nil
}

func (s *staffAttendanceService) GetSalarySlipByStaff(staffID uint, month, year int) (*models.SalarySlip, error) {
	slip, err := s.repo.FindSlipByStaffAndMonth(staffID, month, year)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	return slip, nil
}

func (s *staffAttendanceService) ListSalarySlips(facilityID uint, month, year int) ([]*models.SalarySlip, error) {
	if month == 0 {
		month = int(time.Now().Month())
	}
	if year == 0 {
		year = time.Now().Year()
	}
	list, err := s.repo.ListSlipsByMonth(facilityID, month, year)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	return list, nil
}

func (s *staffAttendanceService) ListSlipsByStaff(facilityID, staffID uint) ([]*models.SalarySlip, error) {
	list, err := s.repo.ListSlipsByStaff(facilityID, staffID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	return list, nil
}

func (s *staffAttendanceService) UpdateSlipStatus(slipID uint, status string, paidAt *time.Time) (*models.SalarySlip, error) {
	slip, err := s.repo.FindSlipByID(slipID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if slip == nil {
		return nil, apperrors.New(404, "SLIP_NOT_FOUND", "salary slip not found", "")
	}
	slip.Status = status
	if status == models.SalarySlipStatusPaid {
		if paidAt != nil {
			slip.PaidAt = paidAt
		} else {
			now := time.Now()
			slip.PaidAt = &now
		}
	}
	if err := s.repo.UpdateSlip(slip); err != nil {
		return nil, apperrors.ErrInternal
	}
	return slip, nil
}

// workingDaysInMonth returns typical working days (Mon-Sat) in a month.
func workingDaysInMonth(month, year int) int {
	// Count Mon-Sat days in the month (India standard: 6-day work week)
	firstDay := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	lastDay := firstDay.AddDate(0, 1, -1)
	count := 0
	for d := firstDay; !d.After(lastDay); d = d.AddDate(0, 0, 1) {
		if d.Weekday() != time.Sunday {
			count++
		}
	}
	return count
}

// calcHours computes hours worked between HH:MM strings.
func calcHours(checkIn, checkOut string) float64 {
	t1, err1 := time.Parse("15:04", checkIn)
	t2, err2 := time.Parse("15:04", checkOut)
	if err1 != nil || err2 != nil {
		return 0
	}
	diff := t2.Sub(t1).Hours()
	if diff < 0 {
		return 0
	}
	return math.Round(diff*100) / 100
}
