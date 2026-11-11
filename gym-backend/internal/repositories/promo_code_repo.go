package repositories

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type PromoCodeRepository interface {
	Create(code *models.PromoCode) error
	FindByCode(code string) (*models.PromoCode, error)
	FindByID(id uint) (*models.PromoCode, error)
	List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.PromoCode, int64, error)
	Update(code *models.PromoCode) error
	Deactivate(id uint) error
	RecordUsage(usage *models.PromoCodeUsage) error
	CountUsageByMember(promoID, memberID uint) (int64, error)
	IncrementUses(id uint) error
}

type promoCodeRepository struct {
	db *gorm.DB
}

func NewPromoCodeRepository(db *gorm.DB) PromoCodeRepository {
	return &promoCodeRepository{db: db}
}

func (r *promoCodeRepository) Create(code *models.PromoCode) error {
	return r.db.Create(code).Error
}

func (r *promoCodeRepository) FindByCode(code string) (*models.PromoCode, error) {
	var pc models.PromoCode
	err := r.db.Where("UPPER(code) = UPPER(?) AND is_active = true", strings.ToUpper(code)).First(&pc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &pc, nil
}

func (r *promoCodeRepository) FindByID(id uint) (*models.PromoCode, error) {
	var pc models.PromoCode
	err := r.db.Where("id = ?", id).First(&pc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &pc, nil
}

func (r *promoCodeRepository) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.PromoCode, int64, error) {
	query := r.db.Model(&models.PromoCode{})
	if facilityID != nil {
		query = query.Where("facility_id = ? OR facility_id IS NULL", *facilityID)
	}
	if activeOnly {
		query = query.Where("is_active = true")
	}
	if s := req.Search; s != "" {
		query = query.Where("code LIKE ?", "%"+s+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var codes []*models.PromoCode
	if err := req.Apply(query).Find(&codes).Error; err != nil {
		return nil, 0, err
	}
	return codes, total, nil
}

func (r *promoCodeRepository) Update(code *models.PromoCode) error {
	return r.db.Save(code).Error
}

func (r *promoCodeRepository) Deactivate(id uint) error {
	return r.db.Model(&models.PromoCode{}).Where("id = ?", id).Update("is_active", false).Error
}

func (r *promoCodeRepository) RecordUsage(usage *models.PromoCodeUsage) error {
	usage.UsedAt = time.Now()
	return r.db.Create(usage).Error
}

func (r *promoCodeRepository) CountUsageByMember(promoID, memberID uint) (int64, error) {
	var count int64
	err := r.db.Model(&models.PromoCodeUsage{}).
		Where("promo_code_id = ? AND member_id = ?", promoID, memberID).
		Count(&count).Error
	return count, err
}

func (r *promoCodeRepository) IncrementUses(id uint) error {
	return r.db.Model(&models.PromoCode{}).
		Where("id = ?", id).
		UpdateColumn("current_uses", gorm.Expr("current_uses + 1")).Error
}
