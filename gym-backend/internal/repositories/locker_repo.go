package repositories

import (
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ─── Locker ───────────────────────────────────────────────────────────────────

type LockerRepository interface {
	Create(l *models.Locker) error
	FindByID(id uint) (*models.Locker, error)
	List(status string) ([]*models.Locker, error)
	Update(l *models.Locker) error
	Delete(id uint) error
}

type lockerRepository struct{ db *gorm.DB }

func NewLockerRepository(db *gorm.DB) LockerRepository {
	return &lockerRepository{db: db}
}

func (r *lockerRepository) Create(l *models.Locker) error {
	return r.db.Create(l).Error
}

func (r *lockerRepository) FindByID(id uint) (*models.Locker, error) {
	var l models.Locker
	err := r.db.First(&l, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &l, err
}

func (r *lockerRepository) List(status string) ([]*models.Locker, error) {
	var list []*models.Locker
	q := r.db.Model(&models.Locker{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	err := q.Order("number asc").Find(&list).Error
	return list, err
}

func (r *lockerRepository) Update(l *models.Locker) error {
	return r.db.Save(l).Error
}

func (r *lockerRepository) Delete(id uint) error {
	return r.db.Delete(&models.Locker{}, id).Error
}

// ─── Locker Allotment ─────────────────────────────────────────────────────────

type LockerAllotmentRepository interface {
	Create(a *models.LockerAllotment) error
	FindByID(id uint) (*models.LockerAllotment, error)
	ListActive() ([]*models.LockerAllotment, error)
	ListByMember(memberID uint) ([]*models.LockerAllotment, error)
	ListByLocker(lockerID uint) ([]*models.LockerAllotment, error)
	Update(a *models.LockerAllotment) error
	HasActiveAllotment(lockerID uint) (bool, error)
	ExpireOverdue() error
}

type lockerAllotmentRepository struct{ db *gorm.DB }

func NewLockerAllotmentRepository(db *gorm.DB) LockerAllotmentRepository {
	return &lockerAllotmentRepository{db: db}
}

func (r *lockerAllotmentRepository) Create(a *models.LockerAllotment) error {
	return r.db.Create(a).Error
}

func (r *lockerAllotmentRepository) FindByID(id uint) (*models.LockerAllotment, error) {
	var a models.LockerAllotment
	err := r.db.Preload("Locker").Preload("Member.User").First(&a, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

func (r *lockerAllotmentRepository) ListActive() ([]*models.LockerAllotment, error) {
	var list []*models.LockerAllotment
	err := r.db.Preload("Locker").Preload("Member.User").
		Where("status = ?", models.AllotmentStatusActive).
		Order("end_date asc").Find(&list).Error
	return list, err
}

func (r *lockerAllotmentRepository) ListByMember(memberID uint) ([]*models.LockerAllotment, error) {
	var list []*models.LockerAllotment
	err := r.db.Preload("Locker").
		Where("member_id = ?", memberID).
		Order("start_date desc").Find(&list).Error
	return list, err
}

func (r *lockerAllotmentRepository) ListByLocker(lockerID uint) ([]*models.LockerAllotment, error) {
	var list []*models.LockerAllotment
	err := r.db.Preload("Member.User").
		Where("locker_id = ?", lockerID).
		Order("start_date desc").Find(&list).Error
	return list, err
}

func (r *lockerAllotmentRepository) Update(a *models.LockerAllotment) error {
	return r.db.Save(a).Error
}

func (r *lockerAllotmentRepository) HasActiveAllotment(lockerID uint) (bool, error) {
	var count int64
	err := r.db.Model(&models.LockerAllotment{}).
		Where("locker_id = ? AND status = ?", lockerID, models.AllotmentStatusActive).
		Count(&count).Error
	return count > 0, err
}

func (r *lockerAllotmentRepository) ExpireOverdue() error {
	now := time.Now()
	return r.db.Model(&models.LockerAllotment{}).
		Where("status = ? AND end_date < ?", models.AllotmentStatusActive, now).
		Update("status", models.AllotmentStatusExpired).Error
}
