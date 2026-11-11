package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type AttendanceRepository interface {
	Create(a *models.Attendance) error
	FindByID(id uint) (*models.Attendance, error)
	FindOpenCheckIn(memberID uint) (*models.Attendance, error) // check-in with no check-out
	List(req utils.PageRequest, facilityID *uint, memberID *uint) ([]*models.Attendance, int64, error)
	Update(a *models.Attendance) error
	Stats(memberID uint) (*models.MemberAttendanceStats, error)
	CountTodayByMember(memberID uint, facilityID uint) (int64, error)
}

type attendanceRepository struct {
	db *gorm.DB
}

func NewAttendanceRepository(db *gorm.DB) AttendanceRepository {
	return &attendanceRepository{db: db}
}

func (r *attendanceRepository) Create(a *models.Attendance) error {
	return r.db.Create(a).Error
}

func (r *attendanceRepository) FindByID(id uint) (*models.Attendance, error) {
	var a models.Attendance
	err := r.db.Preload("Member.User").Preload("Facility").
		Where("id = ?", id).First(&a).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

// FindOpenCheckIn returns the latest attendance record for a member that has no check-out yet.
func (r *attendanceRepository) FindOpenCheckIn(memberID uint) (*models.Attendance, error) {
	var a models.Attendance
	err := r.db.Where("member_id = ? AND check_out_at IS NULL", memberID).
		Order("check_in_at DESC").First(&a).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func (r *attendanceRepository) List(req utils.PageRequest, facilityID *uint, memberID *uint) ([]*models.Attendance, int64, error) {
	query := r.db.Model(&models.Attendance{}).Preload("Member.User")

	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if memberID != nil {
		query = query.Where("member_id = ?", *memberID)
	}
	if m, ok := req.Filters["method"]; ok && m != "" {
		query = query.Where("method = ?", m)
	}
	if from, ok := req.Filters["from"]; ok && from != "" {
		query = query.Where("check_in_at >= ?", from)
	}
	if to, ok := req.Filters["to"]; ok && to != "" {
		query = query.Where("check_in_at <= ?", to)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var records []*models.Attendance
	if err := req.Apply(query).Order("check_in_at DESC").Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

func (r *attendanceRepository) Update(a *models.Attendance) error {
	return r.db.Save(a).Error
}

func (r *attendanceRepository) Stats(memberID uint) (*models.MemberAttendanceStats, error) {
	stats := &models.MemberAttendanceStats{MemberID: memberID}

	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	weekStart := time.Date(now.Year(), now.Month(), now.Day()-int(now.Weekday()), 0, 0, 0, 0, now.Location())

	// Total visits.
	r.db.Model(&models.Attendance{}).Where("member_id = ?", memberID).Count(&stats.TotalVisits)

	// This month.
	r.db.Model(&models.Attendance{}).
		Where("member_id = ? AND check_in_at >= ?", memberID, monthStart).
		Count(&stats.VisitsThisMonth)

	// This week.
	r.db.Model(&models.Attendance{}).
		Where("member_id = ? AND check_in_at >= ?", memberID, weekStart).
		Count(&stats.VisitsThisWeek)

	// Average duration (only completed sessions).
	r.db.Model(&models.Attendance{}).
		Where("member_id = ? AND duration_mins IS NOT NULL", memberID).
		Select("COALESCE(AVG(duration_mins), 0)").
		Scan(&stats.AvgDurationMins)

	// Last visit.
	var last models.Attendance
	if err := r.db.Where("member_id = ?", memberID).
		Order("check_in_at DESC").First(&last).Error; err == nil {
		stats.LastVisitAt = &last.CheckInAt
	}

	return stats, nil
}

func (r *attendanceRepository) CountTodayByMember(memberID uint, facilityID uint) (int64, error) {
	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.AddDate(0, 0, 1)
	var count int64
	err := r.db.Model(&models.Attendance{}).
		Where("member_id = ? AND facility_id = ? AND check_in_at >= ? AND check_in_at < ?",
			memberID, facilityID, today, tomorrow).
		Count(&count).Error
	return count, err
}
