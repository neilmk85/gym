package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ─── Commission Rule ──────────────────────────────────────────────────────────

type CommissionRuleRepository interface {
	Create(r *models.CommissionRule) error
	FindByID(id uint) (*models.CommissionRule, error)
	ListByStaff(staffID uint) ([]*models.CommissionRule, error)
	FindActiveByStaffAndEvent(staffID uint, eventType string) (*models.CommissionRule, error)
	Update(r *models.CommissionRule) error
	Delete(id uint) error
}

type commissionRuleRepository struct{ db *gorm.DB }

func NewCommissionRuleRepository(db *gorm.DB) CommissionRuleRepository {
	return &commissionRuleRepository{db: db}
}

func (r *commissionRuleRepository) Create(rule *models.CommissionRule) error {
	return r.db.Create(rule).Error
}

func (r *commissionRuleRepository) FindByID(id uint) (*models.CommissionRule, error) {
	var rule models.CommissionRule
	err := r.db.First(&rule, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &rule, err
}

func (r *commissionRuleRepository) ListByStaff(staffID uint) ([]*models.CommissionRule, error) {
	var list []*models.CommissionRule
	err := r.db.Where("staff_id = ?", staffID).Order("event_type asc").Find(&list).Error
	return list, err
}

func (r *commissionRuleRepository) FindActiveByStaffAndEvent(staffID uint, eventType string) (*models.CommissionRule, error) {
	var rule models.CommissionRule
	err := r.db.Where("staff_id = ? AND event_type = ? AND is_active = true", staffID, eventType).First(&rule).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &rule, err
}

func (r *commissionRuleRepository) Update(rule *models.CommissionRule) error {
	return r.db.Save(rule).Error
}

func (r *commissionRuleRepository) Delete(id uint) error {
	return r.db.Model(&models.CommissionRule{}).Where("id = ?", id).Update("is_active", false).Error
}

// ─── Commission Entry ─────────────────────────────────────────────────────────

type CommissionEntryRepository interface {
	Create(e *models.CommissionEntry) error
	FindByID(id uint) (*models.CommissionEntry, error)
	ListByStaff(staffID uint, page, limit int) ([]*models.CommissionEntry, int64, error)
	ListPendingByStaff(staffID uint) ([]*models.CommissionEntry, error)
	Update(e *models.CommissionEntry) error
}

type commissionEntryRepository struct{ db *gorm.DB }

func NewCommissionEntryRepository(db *gorm.DB) CommissionEntryRepository {
	return &commissionEntryRepository{db: db}
}

func (r *commissionEntryRepository) Create(e *models.CommissionEntry) error {
	return r.db.Create(e).Error
}

func (r *commissionEntryRepository) FindByID(id uint) (*models.CommissionEntry, error) {
	var e models.CommissionEntry
	err := r.db.Preload("Staff").First(&e, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &e, err
}

func (r *commissionEntryRepository) ListByStaff(staffID uint, page, limit int) ([]*models.CommissionEntry, int64, error) {
	var list []*models.CommissionEntry
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.CommissionEntry{}).Where("staff_id = ?", staffID)
	q.Count(&total)
	err := q.Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *commissionEntryRepository) ListPendingByStaff(staffID uint) ([]*models.CommissionEntry, error) {
	var list []*models.CommissionEntry
	err := r.db.Where("staff_id = ? AND status = 'pending'", staffID).Order("created_at asc").Find(&list).Error
	return list, err
}

func (r *commissionEntryRepository) Update(e *models.CommissionEntry) error {
	return r.db.Save(e).Error
}

// ─── Commission Payout ────────────────────────────────────────────────────────

type CommissionPayoutRepository interface {
	Create(p *models.CommissionPayout) error
	FindByID(id uint) (*models.CommissionPayout, error)
	ListByStaff(staffID uint, page, limit int) ([]*models.CommissionPayout, int64, error)
	Update(p *models.CommissionPayout) error
}

type commissionPayoutRepository struct{ db *gorm.DB }

func NewCommissionPayoutRepository(db *gorm.DB) CommissionPayoutRepository {
	return &commissionPayoutRepository{db: db}
}

func (r *commissionPayoutRepository) Create(p *models.CommissionPayout) error {
	return r.db.Create(p).Error
}

func (r *commissionPayoutRepository) FindByID(id uint) (*models.CommissionPayout, error) {
	var p models.CommissionPayout
	err := r.db.Preload("Staff").First(&p, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &p, err
}

func (r *commissionPayoutRepository) ListByStaff(staffID uint, page, limit int) ([]*models.CommissionPayout, int64, error) {
	var list []*models.CommissionPayout
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.CommissionPayout{}).Where("staff_id = ?", staffID)
	q.Count(&total)
	err := q.Preload("Staff").Order("period_start desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *commissionPayoutRepository) Update(p *models.CommissionPayout) error {
	return r.db.Save(p).Error
}
