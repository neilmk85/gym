package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type PaymentRepository interface {
	Create(p *models.Payment) error
	FindByID(id uint) (*models.Payment, error)
	ListByMember(memberID uint, req utils.PageRequest) ([]*models.Payment, int64, error)
	List(req utils.PageRequest) ([]*models.Payment, int64, error)
	Update(p *models.Payment) error
	SumBySubscription(subscriptionID uint) (float64, error)
}

type paymentRepository struct {
	db *gorm.DB
}

func NewPaymentRepository(db *gorm.DB) PaymentRepository {
	return &paymentRepository{db: db}
}

func (r *paymentRepository) Create(p *models.Payment) error {
	return r.db.Create(p).Error
}

func (r *paymentRepository) FindByID(id uint) (*models.Payment, error) {
	var p models.Payment
	err := r.db.Preload("Member.User").Preload("Subscription.Plan").
		Where("id = ?", id).First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *paymentRepository) ListByMember(memberID uint, req utils.PageRequest) ([]*models.Payment, int64, error) {
	query := r.db.Model(&models.Payment{}).Preload("Subscription.Plan").
		Where("member_id = ?", memberID)

	if s, ok := req.Filters["status"]; ok && s != "" {
		query = query.Where("status = ?", s)
	}
	if m, ok := req.Filters["method"]; ok && m != "" {
		query = query.Where("payment_method = ?", m)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var payments []*models.Payment
	if err := req.Apply(query).Order("paid_at DESC").Find(&payments).Error; err != nil {
		return nil, 0, err
	}
	return payments, total, nil
}

func (r *paymentRepository) List(req utils.PageRequest) ([]*models.Payment, int64, error) {
	query := r.db.Model(&models.Payment{}).Preload("Member.User").Preload("Subscription.Plan")

	if s, ok := req.Filters["status"]; ok && s != "" {
		query = query.Where("status = ?", s)
	}
	if m, ok := req.Filters["method"]; ok && m != "" {
		query = query.Where("payment_method = ?", m)
	}
	if fid, ok := req.Filters["member_id"]; ok && fid != "" {
		query = query.Where("member_id = ?", fid)
	}
	if from, ok := req.Filters["from"]; ok && from != "" {
		query = query.Where("paid_at >= ?", from)
	}
	if to, ok := req.Filters["to"]; ok && to != "" {
		query = query.Where("paid_at <= ?", to+" 23:59:59")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var payments []*models.Payment
	if err := req.Apply(query).Order("paid_at DESC").Find(&payments).Error; err != nil {
		return nil, 0, err
	}
	return payments, total, nil
}

func (r *paymentRepository) Update(p *models.Payment) error {
	return r.db.Save(p).Error
}

func (r *paymentRepository) SumBySubscription(subscriptionID uint) (float64, error) {
	var total float64
	err := r.db.Model(&models.Payment{}).
		Where("subscription_id = ? AND status = 'completed'", subscriptionID).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&total).Error
	return total, err
}
