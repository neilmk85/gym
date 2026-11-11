package repositories

import (
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type StaffAttendanceRepository interface {
	Create(a *models.StaffAttendance) error
	Update(a *models.StaffAttendance) error
	FindByStaffAndDate(staffID uint, date time.Time) (*models.StaffAttendance, error)
	ListByStaff(staffID uint, month, year int) ([]*models.StaffAttendance, error)
	ListByDate(facilityID uint, date time.Time) ([]*models.StaffAttendance, error)
	ListByMonth(facilityID uint, month, year int) ([]*models.StaffAttendance, error)
	CountByStaffAndMonth(staffID uint, month, year int) (present, halfDay, absent, leave, holiday int)

	// SalarySlip
	CreateSlip(s *models.SalarySlip) error
	UpdateSlip(s *models.SalarySlip) error
	FindSlipByStaffAndMonth(staffID uint, month, year int) (*models.SalarySlip, error)
	FindSlipByID(id uint) (*models.SalarySlip, error)
	ListSlipsByMonth(facilityID uint, month, year int) ([]*models.SalarySlip, error)
	ListSlipsByStaff(facilityID, staffID uint) ([]*models.SalarySlip, error)
}

type staffAttendanceRepository struct {
	db *gorm.DB
}

func NewStaffAttendanceRepository(db *gorm.DB) StaffAttendanceRepository {
	return &staffAttendanceRepository{db: db}
}

func (r *staffAttendanceRepository) Create(a *models.StaffAttendance) error {
	return r.db.Create(a).Error
}

func (r *staffAttendanceRepository) Update(a *models.StaffAttendance) error {
	return r.db.Save(a).Error
}

func (r *staffAttendanceRepository) FindByStaffAndDate(staffID uint, date time.Time) (*models.StaffAttendance, error) {
	var a models.StaffAttendance
	dateStr := date.Format("2006-01-02")
	res := r.db.Where("staff_id = ? AND DATE(date) = ?", staffID, dateStr).
		Preload("Staff").First(&a)
	if res.Error == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, res.Error
}

func (r *staffAttendanceRepository) ListByStaff(staffID uint, month, year int) ([]*models.StaffAttendance, error) {
	var list []*models.StaffAttendance
	err := r.db.Where("staff_id = ? AND MONTH(date) = ? AND YEAR(date) = ?", staffID, month, year).
		Order("date ASC").Find(&list).Error
	return list, err
}

func (r *staffAttendanceRepository) ListByDate(facilityID uint, date time.Time) ([]*models.StaffAttendance, error) {
	var list []*models.StaffAttendance
	dateStr := date.Format("2006-01-02")
	err := r.db.Where("facility_id = ? AND DATE(date) = ?", facilityID, dateStr).
		Preload("Staff").Order("staff_id ASC").Find(&list).Error
	return list, err
}

func (r *staffAttendanceRepository) ListByMonth(facilityID uint, month, year int) ([]*models.StaffAttendance, error) {
	var list []*models.StaffAttendance
	err := r.db.Where("facility_id = ? AND MONTH(date) = ? AND YEAR(date) = ?", facilityID, month, year).
		Preload("Staff").Order("date ASC, staff_id ASC").Find(&list).Error
	return list, err
}

func (r *staffAttendanceRepository) CountByStaffAndMonth(staffID uint, month, year int) (present, halfDay, absent, leave, holiday int) {
	type row struct {
		Status string
		Count  int
	}
	var rows []row
	r.db.Model(&models.StaffAttendance{}).
		Select("status, COUNT(*) as count").
		Where("staff_id = ? AND MONTH(date) = ? AND YEAR(date) = ?", staffID, month, year).
		Group("status").Scan(&rows)

	for _, r := range rows {
		switch r.Status {
		case models.AttendanceStatusPresent:
			present = r.Count
		case models.AttendanceStatusHalfDay:
			halfDay = r.Count
		case models.AttendanceStatusAbsent:
			absent = r.Count
		case models.AttendanceStatusLeave:
			leave = r.Count
		case models.AttendanceStatusHoliday:
			holiday = r.Count
		}
	}
	return
}

func (r *staffAttendanceRepository) CreateSlip(s *models.SalarySlip) error {
	return r.db.Create(s).Error
}

func (r *staffAttendanceRepository) UpdateSlip(s *models.SalarySlip) error {
	return r.db.Save(s).Error
}

func (r *staffAttendanceRepository) FindSlipByStaffAndMonth(staffID uint, month, year int) (*models.SalarySlip, error) {
	var s models.SalarySlip
	res := r.db.Where("staff_id = ? AND month = ? AND year = ?", staffID, month, year).
		Preload("Staff").First(&s)
	if res.Error == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &s, res.Error
}

func (r *staffAttendanceRepository) FindSlipByID(id uint) (*models.SalarySlip, error) {
	var s models.SalarySlip
	res := r.db.Preload("Staff").First(&s, id)
	if res.Error == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &s, res.Error
}

func (r *staffAttendanceRepository) ListSlipsByMonth(facilityID uint, month, year int) ([]*models.SalarySlip, error) {
	var list []*models.SalarySlip
	err := r.db.Where("facility_id = ? AND month = ? AND year = ?", facilityID, month, year).
		Preload("Staff").Order("staff_id ASC").Find(&list).Error
	return list, err
}

func (r *staffAttendanceRepository) ListSlipsByStaff(facilityID, staffID uint) ([]*models.SalarySlip, error) {
	var list []*models.SalarySlip
	err := r.db.Where("facility_id = ? AND staff_id = ?", facilityID, staffID).
		Preload("Staff").Order("year DESC, month DESC").Find(&list).Error
	return list, err
}
