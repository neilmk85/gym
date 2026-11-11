package repositories

import (
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ─── PT Package ───────────────────────────────────────────────────────────────

type PTPackageRepository interface {
	Create(p *models.PTPackage) error
	FindByID(id uint) (*models.PTPackage, error)
	ListByFacility(facilityID uint) ([]*models.PTPackage, error)
	Update(p *models.PTPackage) error
}

type ptPackageRepository struct{ db *gorm.DB }

func NewPTPackageRepository(db *gorm.DB) PTPackageRepository {
	return &ptPackageRepository{db: db}
}

func (r *ptPackageRepository) Create(p *models.PTPackage) error {
	return r.db.Create(p).Error
}

func (r *ptPackageRepository) FindByID(id uint) (*models.PTPackage, error) {
	var p models.PTPackage
	err := r.db.First(&p, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &p, err
}

func (r *ptPackageRepository) ListByFacility(facilityID uint) ([]*models.PTPackage, error) {
	var list []*models.PTPackage
	err := r.db.Where("facility_id = ? AND is_active = true", facilityID).Order("created_at desc").Find(&list).Error
	return list, err
}

func (r *ptPackageRepository) Update(p *models.PTPackage) error {
	return r.db.Save(p).Error
}

// ─── Member PT Package ────────────────────────────────────────────────────────

type MemberPTPackageRepository interface {
	Create(m *models.MemberPTPackage) error
	FindByID(id uint) (*models.MemberPTPackage, error)
	FindActiveByMember(memberID uint) ([]*models.MemberPTPackage, error)
	ListByMember(memberID uint, page, limit int) ([]*models.MemberPTPackage, int64, error)
	ListByFacility(facilityID uint, page, limit int) ([]*models.MemberPTPackage, int64, error)
	Update(m *models.MemberPTPackage) error
	IncrementUsed(id uint) error
	DecrementUsed(id uint) error
}

type memberPTPackageRepository struct{ db *gorm.DB }

func NewMemberPTPackageRepository(db *gorm.DB) MemberPTPackageRepository {
	return &memberPTPackageRepository{db: db}
}

func (r *memberPTPackageRepository) Create(m *models.MemberPTPackage) error {
	return r.db.Create(m).Error
}

func (r *memberPTPackageRepository) FindByID(id uint) (*models.MemberPTPackage, error) {
	var m models.MemberPTPackage
	err := r.db.Preload("Member.User").Preload("PTPackage").Preload("Trainer.User").First(&m, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &m, err
}

func (r *memberPTPackageRepository) FindActiveByMember(memberID uint) ([]*models.MemberPTPackage, error) {
	var list []*models.MemberPTPackage
	now := time.Now()
	err := r.db.Where("member_id = ? AND is_active = true AND expires_at > ?", memberID, now).
		Preload("PTPackage").Order("expires_at asc").Find(&list).Error
	return list, err
}

func (r *memberPTPackageRepository) ListByMember(memberID uint, page, limit int) ([]*models.MemberPTPackage, int64, error) {
	var list []*models.MemberPTPackage
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.MemberPTPackage{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Preload("PTPackage").Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *memberPTPackageRepository) ListByFacility(facilityID uint, page, limit int) ([]*models.MemberPTPackage, int64, error) {
	var list []*models.MemberPTPackage
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.MemberPTPackage{}).Where("facility_id = ?", facilityID)
	q.Count(&total)
	err := q.Preload("Member.User").Preload("PTPackage").Preload("Trainer.User").
		Order("purchased_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *memberPTPackageRepository) Update(m *models.MemberPTPackage) error {
	return r.db.Save(m).Error
}

func (r *memberPTPackageRepository) IncrementUsed(id uint) error {
	return r.db.Model(&models.MemberPTPackage{}).Where("id = ?", id).
		UpdateColumn("used_sessions", gorm.Expr("used_sessions + 1")).Error
}

func (r *memberPTPackageRepository) DecrementUsed(id uint) error {
	return r.db.Model(&models.MemberPTPackage{}).Where("id = ? AND used_sessions > 0", id).
		UpdateColumn("used_sessions", gorm.Expr("used_sessions - 1")).Error
}

// ─── PT Session ───────────────────────────────────────────────────────────────

type PTSessionRepository interface {
	Create(s *models.PTSession) error
	FindByID(id uint) (*models.PTSession, error)
	ListByMember(memberID uint, page, limit int) ([]*models.PTSession, int64, error)
	ListByTrainer(trainerID uint, page, limit int) ([]*models.PTSession, int64, error)
	ListByFacility(facilityID uint, trainerID uint, status string, page, limit int) ([]*models.PTSession, int64, error)
	Update(s *models.PTSession) error
}

type ptSessionRepository struct{ db *gorm.DB }

func NewPTSessionRepository(db *gorm.DB) PTSessionRepository {
	return &ptSessionRepository{db: db}
}

func (r *ptSessionRepository) Create(s *models.PTSession) error {
	return r.db.Create(s).Error
}

func (r *ptSessionRepository) FindByID(id uint) (*models.PTSession, error) {
	var s models.PTSession
	err := r.db.Preload("Member.User").Preload("Trainer.User").First(&s, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &s, err
}

func (r *ptSessionRepository) ListByMember(memberID uint, page, limit int) ([]*models.PTSession, int64, error) {
	var list []*models.PTSession
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.PTSession{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Preload("Trainer.User").Order("scheduled_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *ptSessionRepository) ListByTrainer(trainerID uint, page, limit int) ([]*models.PTSession, int64, error) {
	var list []*models.PTSession
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.PTSession{}).Where("trainer_id = ?", trainerID)
	q.Count(&total)
	err := q.Preload("Member.User").Order("scheduled_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *ptSessionRepository) ListByFacility(facilityID uint, trainerID uint, status string, page, limit int) ([]*models.PTSession, int64, error) {
	var list []*models.PTSession
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.PTSession{}).Where("facility_id = ?", facilityID)
	if trainerID > 0 {
		q = q.Where("trainer_id = ?", trainerID)
	}
	if status != "" && status != "all" {
		q = q.Where("status = ?", status)
	}
	q.Count(&total)
	err := q.Preload("Member.User").Preload("Trainer.User").Order("scheduled_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *ptSessionRepository) Update(s *models.PTSession) error {
	return r.db.Save(s).Error
}

// ─── Session Credit Ledger ────────────────────────────────────────────────────

type SessionCreditLedgerRepository interface {
	Create(e *models.SessionCreditLedger) error
	ListByMember(memberID uint) ([]*models.SessionCreditLedger, error)
	ListByPackage(packageID uint) ([]*models.SessionCreditLedger, error)
}

type sessionCreditLedgerRepository struct{ db *gorm.DB }

func NewSessionCreditLedgerRepository(db *gorm.DB) SessionCreditLedgerRepository {
	return &sessionCreditLedgerRepository{db: db}
}

func (r *sessionCreditLedgerRepository) Create(e *models.SessionCreditLedger) error {
	return r.db.Create(e).Error
}

func (r *sessionCreditLedgerRepository) ListByMember(memberID uint) ([]*models.SessionCreditLedger, error) {
	var list []*models.SessionCreditLedger
	err := r.db.Where("member_id = ?", memberID).Order("created_at desc").Find(&list).Error
	return list, err
}

func (r *sessionCreditLedgerRepository) ListByPackage(packageID uint) ([]*models.SessionCreditLedger, error) {
	var list []*models.SessionCreditLedger
	err := r.db.Where("member_pt_package_id = ?", packageID).Order("created_at desc").Find(&list).Error
	return list, err
}
