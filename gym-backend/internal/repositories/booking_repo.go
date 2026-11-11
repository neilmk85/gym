package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type BookingRepository interface {
	Create(b *models.ClassBooking) error
	FindByID(id uint) (*models.ClassBooking, error)
	FindByMemberAndClass(memberID, classID uint) (*models.ClassBooking, error)
	ListByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error)
	ListByClass(classID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error)
	Update(b *models.ClassBooking) error
	CountConfirmedByClass(classID uint) (int64, error)
	// First waitlisted booking for a class, ordered by waitlist_position ASC.
	FirstWaitlisted(classID uint) (*models.ClassBooking, error)
	// Shift all waitlist positions down by 1 after a specific position.
	ShiftWaitlistDown(classID uint, afterPosition int) error
	// List all bookings with optional filters (admin view).
	List(req utils.PageRequest, classID *uint, memberID *uint, status string) ([]*models.ClassBooking, int64, error)
	// Upcoming confirmed/waitlisted bookings for a member, ordered by class start time.
	ListUpcomingByMember(memberID uint, from time.Time, req utils.PageRequest) ([]*models.ClassBooking, int64, error)
}

type bookingRepository struct {
	db *gorm.DB
}

func NewBookingRepository(db *gorm.DB) BookingRepository {
	return &bookingRepository{db: db}
}

func (r *bookingRepository) Create(b *models.ClassBooking) error {
	return r.db.Create(b).Error
}

func (r *bookingRepository) FindByID(id uint) (*models.ClassBooking, error) {
	var b models.ClassBooking
	err := r.db.Preload("Class.Trainer.User").Preload("Member.User").
		Where("id = ?", id).First(&b).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *bookingRepository) FindByMemberAndClass(memberID, classID uint) (*models.ClassBooking, error) {
	var b models.ClassBooking
	err := r.db.Where("member_id = ? AND class_id = ? AND status != 'cancelled'", memberID, classID).
		First(&b).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *bookingRepository) ListByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	query := r.db.Model(&models.ClassBooking{}).Preload("Class.Trainer.User").
		Where("member_id = ?", memberID)

	if s, ok := req.Filters["status"]; ok && s != "" {
		query = query.Where("class_bookings.status = ?", s)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var bookings []*models.ClassBooking
	if err := req.Apply(query).Order("booked_at DESC").Find(&bookings).Error; err != nil {
		return nil, 0, err
	}
	return bookings, total, nil
}

func (r *bookingRepository) ListByClass(classID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	query := r.db.Model(&models.ClassBooking{}).Preload("Member.User").
		Where("class_id = ?", classID)

	if s, ok := req.Filters["status"]; ok && s != "" {
		query = query.Where("class_bookings.status = ?", s)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var bookings []*models.ClassBooking
	if err := req.Apply(query).Order("booked_at ASC").Find(&bookings).Error; err != nil {
		return nil, 0, err
	}
	return bookings, total, nil
}

func (r *bookingRepository) Update(b *models.ClassBooking) error {
	return r.db.Save(b).Error
}

func (r *bookingRepository) CountConfirmedByClass(classID uint) (int64, error) {
	var count int64
	err := r.db.Model(&models.ClassBooking{}).
		Where("class_id = ? AND status = 'confirmed'", classID).Count(&count).Error
	return count, err
}

func (r *bookingRepository) FirstWaitlisted(classID uint) (*models.ClassBooking, error) {
	var b models.ClassBooking
	err := r.db.Where("class_id = ? AND status = 'waitlisted'", classID).
		Order("waitlist_position ASC").First(&b).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *bookingRepository) ShiftWaitlistDown(classID uint, afterPosition int) error {
	return r.db.Model(&models.ClassBooking{}).
		Where("class_id = ? AND status = 'waitlisted' AND waitlist_position > ?", classID, afterPosition).
		UpdateColumn("waitlist_position", gorm.Expr("waitlist_position - 1")).Error
}

func (r *bookingRepository) List(req utils.PageRequest, classID *uint, memberID *uint, status string) ([]*models.ClassBooking, int64, error) {
	query := r.db.Model(&models.ClassBooking{}).
		Preload("Class").Preload("Member.User")

	if classID != nil {
		query = query.Where("class_id = ?", *classID)
	}
	if memberID != nil {
		query = query.Where("member_id = ?", *memberID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var bookings []*models.ClassBooking
	if err := req.Apply(query).Order("booked_at DESC").Find(&bookings).Error; err != nil {
		return nil, 0, err
	}
	return bookings, total, nil
}

func (r *bookingRepository) ListUpcomingByMember(memberID uint, from time.Time, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	query := r.db.Model(&models.ClassBooking{}).
		Preload("Class").
		Joins("JOIN classes ON classes.id = class_bookings.class_id").
		Where("class_bookings.member_id = ?", memberID).
		Where("class_bookings.status IN ?", []string{
			models.BookingStatusConfirmed,
			models.BookingStatusWaitlisted,
		}).
		Where("classes.start_time > ?", from)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (req.Page - 1) * req.PerPage
	var bookings []*models.ClassBooking
	if err := query.Offset(offset).Limit(req.PerPage).Order("classes.start_time ASC").Find(&bookings).Error; err != nil {
		return nil, 0, err
	}
	return bookings, total, nil
}
