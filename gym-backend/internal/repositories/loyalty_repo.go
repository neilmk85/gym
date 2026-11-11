package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ─── Referral Code ────────────────────────────────────────────────────────────

type ReferralCodeRepository interface {
	Create(rc *models.ReferralCode) error
	FindByMember(memberID uint) (*models.ReferralCode, error)
	FindByCode(code string) (*models.ReferralCode, error)
}

type referralCodeRepository struct{ db *gorm.DB }

func NewReferralCodeRepository(db *gorm.DB) ReferralCodeRepository {
	return &referralCodeRepository{db: db}
}

func (r *referralCodeRepository) Create(rc *models.ReferralCode) error {
	return r.db.Create(rc).Error
}

func (r *referralCodeRepository) FindByMember(memberID uint) (*models.ReferralCode, error) {
	var rc models.ReferralCode
	err := r.db.Where("member_id = ?", memberID).First(&rc).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &rc, err
}

func (r *referralCodeRepository) FindByCode(code string) (*models.ReferralCode, error) {
	var rc models.ReferralCode
	err := r.db.Where("code = ? AND is_active = true", code).First(&rc).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &rc, err
}

// ─── Referral ─────────────────────────────────────────────────────────────────

type ReferralRepository interface {
	Create(ref *models.Referral) error
	FindByID(id uint) (*models.Referral, error)
	ListByReferrer(referrerID uint) ([]*models.Referral, error)
	Update(ref *models.Referral) error
}

type referralRepository struct{ db *gorm.DB }

func NewReferralRepository(db *gorm.DB) ReferralRepository {
	return &referralRepository{db: db}
}

func (r *referralRepository) Create(ref *models.Referral) error {
	return r.db.Create(ref).Error
}

func (r *referralRepository) FindByID(id uint) (*models.Referral, error) {
	var ref models.Referral
	err := r.db.First(&ref, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &ref, err
}

func (r *referralRepository) ListByReferrer(referrerID uint) ([]*models.Referral, error) {
	var list []*models.Referral
	err := r.db.Where("referrer_id = ?", referrerID).Order("created_at desc").Find(&list).Error
	return list, err
}

func (r *referralRepository) Update(ref *models.Referral) error {
	return r.db.Save(ref).Error
}

// ─── Loyalty Account ──────────────────────────────────────────────────────────

type LoyaltyAccountRepository interface {
	FindOrCreate(memberID uint) (*models.LoyaltyAccount, error)
	FindByMember(memberID uint) (*models.LoyaltyAccount, error)
	Update(acc *models.LoyaltyAccount) error
}

type loyaltyAccountRepository struct{ db *gorm.DB }

func NewLoyaltyAccountRepository(db *gorm.DB) LoyaltyAccountRepository {
	return &loyaltyAccountRepository{db: db}
}

func (r *loyaltyAccountRepository) FindOrCreate(memberID uint) (*models.LoyaltyAccount, error) {
	var acc models.LoyaltyAccount
	err := r.db.Where("member_id = ?", memberID).FirstOrCreate(&acc, models.LoyaltyAccount{MemberID: memberID}).Error
	return &acc, err
}

func (r *loyaltyAccountRepository) FindByMember(memberID uint) (*models.LoyaltyAccount, error) {
	var acc models.LoyaltyAccount
	err := r.db.Where("member_id = ?", memberID).First(&acc).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &acc, err
}

func (r *loyaltyAccountRepository) Update(acc *models.LoyaltyAccount) error {
	return r.db.Save(acc).Error
}

// ─── Loyalty Config ───────────────────────────────────────────────────────────

type LoyaltyConfigRepository interface {
	Get(facilityID uint) (*models.LoyaltyConfig, error)
	Upsert(cfg *models.LoyaltyConfig) error
}

type loyaltyConfigRepository struct{ db *gorm.DB }

func NewLoyaltyConfigRepository(db *gorm.DB) LoyaltyConfigRepository {
	return &loyaltyConfigRepository{db: db}
}

func (r *loyaltyConfigRepository) Get(facilityID uint) (*models.LoyaltyConfig, error) {
	var cfg models.LoyaltyConfig
	err := r.db.Where("facility_id = ?", facilityID).First(&cfg).Error
	if err == gorm.ErrRecordNotFound {
		// Return defaults without persisting
		return &models.LoyaltyConfig{FacilityID: facilityID}, nil
	}
	return &cfg, err
}

func (r *loyaltyConfigRepository) Upsert(cfg *models.LoyaltyConfig) error {
	return r.db.Save(cfg).Error
}

// ─── Loyalty Transaction ──────────────────────────────────────────────────────

type LoyaltyTransactionRepository interface {
	Create(tx *models.LoyaltyTransaction) error
	ListByMember(memberID uint, page, limit int) ([]*models.LoyaltyTransaction, int64, error)
}

type loyaltyTransactionRepository struct{ db *gorm.DB }

func NewLoyaltyTransactionRepository(db *gorm.DB) LoyaltyTransactionRepository {
	return &loyaltyTransactionRepository{db: db}
}

func (r *loyaltyTransactionRepository) Create(tx *models.LoyaltyTransaction) error {
	return r.db.Create(tx).Error
}

func (r *loyaltyTransactionRepository) ListByMember(memberID uint, page, limit int) ([]*models.LoyaltyTransaction, int64, error) {
	var list []*models.LoyaltyTransaction
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.LoyaltyTransaction{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}
