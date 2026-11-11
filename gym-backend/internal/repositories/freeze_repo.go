package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type FreezeRepository interface {
	Create(f *models.SubscriptionFreeze) error
	FindByID(id uint) (*models.SubscriptionFreeze, error)
	FindActiveBySubscription(subID uint) (*models.SubscriptionFreeze, error)
	ListBySubscription(subID uint) ([]*models.SubscriptionFreeze, error)
	ListByMember(memberID uint) ([]*models.SubscriptionFreeze, error)
	Update(f *models.SubscriptionFreeze) error
	HasOverlap(subID uint, start, end string, excludeID uint) (bool, error)
}

type freezeRepository struct{ db *gorm.DB }

func NewFreezeRepository(db *gorm.DB) FreezeRepository {
	return &freezeRepository{db: db}
}

func (r *freezeRepository) Create(f *models.SubscriptionFreeze) error {
	return r.db.Create(f).Error
}

func (r *freezeRepository) FindByID(id uint) (*models.SubscriptionFreeze, error) {
	var f models.SubscriptionFreeze
	err := r.db.Preload("Member.User").First(&f, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &f, err
}

func (r *freezeRepository) FindActiveBySubscription(subID uint) (*models.SubscriptionFreeze, error) {
	var f models.SubscriptionFreeze
	err := r.db.Where("subscription_id = ? AND status IN ('pending','active')", subID).First(&f).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &f, err
}

func (r *freezeRepository) ListBySubscription(subID uint) ([]*models.SubscriptionFreeze, error) {
	var list []*models.SubscriptionFreeze
	err := r.db.Where("subscription_id = ?", subID).Order("start_date desc").Find(&list).Error
	return list, err
}

func (r *freezeRepository) ListByMember(memberID uint) ([]*models.SubscriptionFreeze, error) {
	var list []*models.SubscriptionFreeze
	err := r.db.Where("member_id = ?", memberID).Order("start_date desc").Find(&list).Error
	return list, err
}

func (r *freezeRepository) Update(f *models.SubscriptionFreeze) error {
	return r.db.Save(f).Error
}

func (r *freezeRepository) HasOverlap(subID uint, start, end string, excludeID uint) (bool, error) {
	var count int64
	q := r.db.Model(&models.SubscriptionFreeze{}).
		Where("subscription_id = ? AND status IN ('pending','active') AND id != ?", subID, excludeID).
		Where("start_date <= ? AND end_date >= ?", end, start)
	q.Count(&count)
	return count > 0, q.Error
}
