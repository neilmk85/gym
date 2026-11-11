package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type SubscriptionRepository interface {
	Create(sub *models.Subscription) error
	FindByID(id uint) (*models.Subscription, error)
	FindActiveByMember(memberID uint) (*models.Subscription, error)
	ListByMember(memberID uint, req utils.PageRequest) ([]*models.Subscription, int64, error)
	List(req utils.PageRequest) ([]*models.Subscription, int64, error)
	Update(sub *models.Subscription) error
	FindExpiringBefore(date time.Time) ([]*models.Subscription, error)
	FindExpiredActive(now time.Time) ([]*models.Subscription, error)
	FindAutoRenewDueSoon(from, to time.Time) ([]*models.Subscription, error)
	FindPausedDue(now time.Time) ([]*models.Subscription, error)
}

type subscriptionRepository struct {
	db *gorm.DB
}

func NewSubscriptionRepository(db *gorm.DB) SubscriptionRepository {
	return &subscriptionRepository{db: db}
}

func (r *subscriptionRepository) Create(sub *models.Subscription) error {
	return r.db.Create(sub).Error
}

func (r *subscriptionRepository) FindByID(id uint) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.Preload("Plan").Where("id = ?", id).First(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

func (r *subscriptionRepository) FindActiveByMember(memberID uint) (*models.Subscription, error) {
	var sub models.Subscription
	err := r.db.Preload("Plan").
		Where("member_id = ? AND status IN ('active','paused')", memberID).
		Order("created_at DESC").First(&sub).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

func (r *subscriptionRepository) ListByMember(memberID uint, req utils.PageRequest) ([]*models.Subscription, int64, error) {
	query := r.db.Model(&models.Subscription{}).Preload("Plan").Where("member_id = ?", memberID)
	if s, ok := req.Filters["status"]; ok && s != "" {
		query = query.Where("status = ?", s)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var subs []*models.Subscription
	if err := req.Apply(query).Find(&subs).Error; err != nil {
		return nil, 0, err
	}
	return subs, total, nil
}

func (r *subscriptionRepository) List(req utils.PageRequest) ([]*models.Subscription, int64, error) {
	query := r.db.Model(&models.Subscription{}).Preload("Plan").Preload("Member.User")
	if s, ok := req.Filters["status"]; ok && s != "" {
		query = query.Where("status = ?", s)
	}
	if from, ok := req.Filters["from"]; ok && from != "" {
		query = query.Where("end_date >= ?", from)
	}
	if to, ok := req.Filters["to"]; ok && to != "" {
		query = query.Where("end_date <= ?", to)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var subs []*models.Subscription
	if err := req.Apply(query).Find(&subs).Error; err != nil {
		return nil, 0, err
	}
	return subs, total, nil
}

func (r *subscriptionRepository) Update(sub *models.Subscription) error {
	return r.db.Save(sub).Error
}

func (r *subscriptionRepository) FindExpiringBefore(date time.Time) ([]*models.Subscription, error) {
	var subs []*models.Subscription
	err := r.db.Preload("Plan").
		Where("status = 'active' AND end_date <= ? AND auto_renew = true", date).
		Find(&subs).Error
	return subs, err
}

func (r *subscriptionRepository) FindExpiredActive(now time.Time) ([]*models.Subscription, error) {
	var subs []*models.Subscription
	err := r.db.Where("status = 'active' AND end_date < ? AND auto_renew = false", now).
		Find(&subs).Error
	return subs, err
}

// FindPausedDue returns paused subscriptions whose paused_until date is today or in the past.
func (r *subscriptionRepository) FindPausedDue(now time.Time) ([]*models.Subscription, error) {
	var subs []*models.Subscription
	err := r.db.Preload("Plan").
		Where("status = 'paused' AND paused_until IS NOT NULL AND paused_until <= ?", now).
		Find(&subs).Error
	return subs, err
}

// FindAutoRenewDueSoon finds active auto-renew subscriptions whose next_renewal_date
// falls within [from, to], used to send payment-due reminders.
func (r *subscriptionRepository) FindAutoRenewDueSoon(from, to time.Time) ([]*models.Subscription, error) {
	var subs []*models.Subscription
	err := r.db.Preload("Plan").
		Where("status = 'active' AND auto_renew = true AND next_renewal_date BETWEEN ? AND ?", from, to).
		Find(&subs).Error
	return subs, err
}
