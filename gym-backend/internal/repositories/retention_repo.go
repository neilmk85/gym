package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ─── Body Measurements ────────────────────────────────────────────────────────

type BodyMeasurementRepository interface {
	Create(m *models.MemberBodyMeasurement) error
	FindByID(id uint) (*models.MemberBodyMeasurement, error)
	ListByMember(memberID uint, page, limit int) ([]*models.MemberBodyMeasurement, int64, error)
	Delete(id uint) error
}

type bodyMeasurementRepository struct{ db *gorm.DB }

func NewBodyMeasurementRepository(db *gorm.DB) BodyMeasurementRepository {
	return &bodyMeasurementRepository{db: db}
}

func (r *bodyMeasurementRepository) Create(m *models.MemberBodyMeasurement) error {
	return r.db.Create(m).Error
}

func (r *bodyMeasurementRepository) FindByID(id uint) (*models.MemberBodyMeasurement, error) {
	var m models.MemberBodyMeasurement
	err := r.db.First(&m, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &m, err
}

func (r *bodyMeasurementRepository) ListByMember(memberID uint, page, limit int) ([]*models.MemberBodyMeasurement, int64, error) {
	var list []*models.MemberBodyMeasurement
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.MemberBodyMeasurement{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Order("measured_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *bodyMeasurementRepository) Delete(id uint) error {
	return r.db.Delete(&models.MemberBodyMeasurement{}, id).Error
}

// ─── Progress Photos ──────────────────────────────────────────────────────────

type ProgressPhotoRepository interface {
	Create(p *models.MemberProgressPhoto) error
	FindByID(id uint) (*models.MemberProgressPhoto, error)
	ListByMember(memberID uint, page, limit int) ([]*models.MemberProgressPhoto, int64, error)
	Delete(id uint) error
}

type progressPhotoRepository struct{ db *gorm.DB }

func NewProgressPhotoRepository(db *gorm.DB) ProgressPhotoRepository {
	return &progressPhotoRepository{db: db}
}

func (r *progressPhotoRepository) Create(p *models.MemberProgressPhoto) error {
	return r.db.Create(p).Error
}

func (r *progressPhotoRepository) FindByID(id uint) (*models.MemberProgressPhoto, error) {
	var p models.MemberProgressPhoto
	err := r.db.First(&p, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &p, err
}

func (r *progressPhotoRepository) ListByMember(memberID uint, page, limit int) ([]*models.MemberProgressPhoto, int64, error) {
	var list []*models.MemberProgressPhoto
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.MemberProgressPhoto{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Order("photo_date desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *progressPhotoRepository) Delete(id uint) error {
	return r.db.Delete(&models.MemberProgressPhoto{}, id).Error
}

// ─── Retention Risk ───────────────────────────────────────────────────────────

type RetentionRiskRepository interface {
	Create(r *models.RetentionRisk) error
	FindByID(id uint) (*models.RetentionRisk, error)
	ListByMember(memberID uint, page, limit int) ([]*models.RetentionRisk, int64, error)
	ListOpen(page, limit int) ([]*models.RetentionRisk, int64, error)
	Update(r *models.RetentionRisk) error
}

type retentionRiskRepository struct{ db *gorm.DB }

func NewRetentionRiskRepository(db *gorm.DB) RetentionRiskRepository {
	return &retentionRiskRepository{db: db}
}

func (r *retentionRiskRepository) Create(risk *models.RetentionRisk) error {
	return r.db.Create(risk).Error
}

func (r *retentionRiskRepository) FindByID(id uint) (*models.RetentionRisk, error) {
	var risk models.RetentionRisk
	err := r.db.Preload("Member.User").First(&risk, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &risk, err
}

func (r *retentionRiskRepository) ListByMember(memberID uint, page, limit int) ([]*models.RetentionRisk, int64, error) {
	var list []*models.RetentionRisk
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.RetentionRisk{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *retentionRiskRepository) ListOpen(page, limit int) ([]*models.RetentionRisk, int64, error) {
	var list []*models.RetentionRisk
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.RetentionRisk{}).Where("is_resolved = false")
	q.Count(&total)
	err := q.Preload("Member.User").Order("risk_level desc, created_at asc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *retentionRiskRepository) Update(risk *models.RetentionRisk) error {
	return r.db.Save(risk).Error
}

// ─── Retention Action ─────────────────────────────────────────────────────────

type RetentionActionRepository interface {
	Create(a *models.RetentionAction) error
	FindByID(id uint) (*models.RetentionAction, error)
	ListByRisk(riskID uint) ([]*models.RetentionAction, error)
	ListByAssignee(userID uint, page, limit int) ([]*models.RetentionAction, int64, error)
	Update(a *models.RetentionAction) error
}

type retentionActionRepository struct{ db *gorm.DB }

func NewRetentionActionRepository(db *gorm.DB) RetentionActionRepository {
	return &retentionActionRepository{db: db}
}

func (r *retentionActionRepository) Create(a *models.RetentionAction) error {
	return r.db.Create(a).Error
}

func (r *retentionActionRepository) FindByID(id uint) (*models.RetentionAction, error) {
	var a models.RetentionAction
	err := r.db.First(&a, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

func (r *retentionActionRepository) ListByRisk(riskID uint) ([]*models.RetentionAction, error) {
	var list []*models.RetentionAction
	err := r.db.Where("retention_risk_id = ?", riskID).Order("due_date asc").Find(&list).Error
	return list, err
}

func (r *retentionActionRepository) ListByAssignee(userID uint, page, limit int) ([]*models.RetentionAction, int64, error) {
	var list []*models.RetentionAction
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.RetentionAction{}).Where("assigned_to_id = ? AND status = 'open'", userID)
	q.Count(&total)
	err := q.Order("due_date asc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *retentionActionRepository) Update(a *models.RetentionAction) error {
	return r.db.Save(a).Error
}
