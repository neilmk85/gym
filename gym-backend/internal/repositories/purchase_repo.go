package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type PurchaseRepository interface {
	Create(p *models.Purchase) error
	FindByID(id uint) (*models.Purchase, error)
	List(status, paymentStatus string, vendorID *uint, page, perPage int) ([]*models.Purchase, int64, error)
	Update(p *models.Purchase) error
	Delete(id uint) error
	MaxPurchaseSeq() int
}

type purchaseRepository struct{ db *gorm.DB }

func NewPurchaseRepository(db *gorm.DB) PurchaseRepository {
	return &purchaseRepository{db: db}
}

func (r *purchaseRepository) Create(p *models.Purchase) error {
	return r.db.Create(p).Error
}

func (r *purchaseRepository) FindByID(id uint) (*models.Purchase, error) {
	var p models.Purchase
	err := r.db.Preload("Items").Preload("Vendor").First(&p, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &p, err
}

func (r *purchaseRepository) List(status, paymentStatus string, vendorID *uint, page, perPage int) ([]*models.Purchase, int64, error) {
	q := r.db.Model(&models.Purchase{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if paymentStatus != "" {
		q = q.Where("payment_status = ?", paymentStatus)
	}
	if vendorID != nil {
		q = q.Where("vendor_id = ?", *vendorID)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * perPage
	var list []*models.Purchase
	err := q.Preload("Items").Order("created_at DESC").Offset(offset).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *purchaseRepository) Update(p *models.Purchase) error {
	return r.db.Session(&gorm.Session{FullSaveAssociations: true}).Save(p).Error
}

func (r *purchaseRepository) Delete(id uint) error {
	r.db.Where("purchase_id = ?", id).Delete(&models.PurchaseItem{})
	return r.db.Delete(&models.Purchase{}, id).Error
}

func (r *purchaseRepository) MaxPurchaseSeq() int {
	var maxSeq int
	r.db.Raw("SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number, 4) AS UNSIGNED)), 0) FROM purchases").Scan(&maxSeq)
	return maxSeq
}
