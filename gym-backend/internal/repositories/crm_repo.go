package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ─── Lead Activity ────────────────────────────────────────────────────────────

type LeadActivityRepository interface {
	Create(a *models.LeadActivity) error
	ListByEnquiry(enquiryID uint) ([]*models.LeadActivity, error)
	Delete(id uint) error
}

type leadActivityRepository struct{ db *gorm.DB }

func NewLeadActivityRepository(db *gorm.DB) LeadActivityRepository {
	return &leadActivityRepository{db: db}
}

func (r *leadActivityRepository) Create(a *models.LeadActivity) error {
	return r.db.Create(a).Error
}

func (r *leadActivityRepository) ListByEnquiry(enquiryID uint) ([]*models.LeadActivity, error) {
	var list []*models.LeadActivity
	err := r.db.Where("enquiry_id = ?", enquiryID).Order("activity_date desc").Find(&list).Error
	return list, err
}

func (r *leadActivityRepository) Delete(id uint) error {
	return r.db.Delete(&models.LeadActivity{}, id).Error
}

// ─── Lead Follow-Up ───────────────────────────────────────────────────────────

type LeadFollowUpRepository interface {
	Create(f *models.LeadFollowUp) error
	FindByID(id uint) (*models.LeadFollowUp, error)
	ListByEnquiry(enquiryID uint) ([]*models.LeadFollowUp, error)
	ListPendingByAssignee(userID uint, page, limit int) ([]*models.LeadFollowUp, int64, error)
	Update(f *models.LeadFollowUp) error
}

type leadFollowUpRepository struct{ db *gorm.DB }

func NewLeadFollowUpRepository(db *gorm.DB) LeadFollowUpRepository {
	return &leadFollowUpRepository{db: db}
}

func (r *leadFollowUpRepository) Create(f *models.LeadFollowUp) error {
	return r.db.Create(f).Error
}

func (r *leadFollowUpRepository) FindByID(id uint) (*models.LeadFollowUp, error) {
	var f models.LeadFollowUp
	err := r.db.First(&f, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &f, err
}

func (r *leadFollowUpRepository) ListByEnquiry(enquiryID uint) ([]*models.LeadFollowUp, error) {
	var list []*models.LeadFollowUp
	err := r.db.Where("enquiry_id = ?", enquiryID).Order("due_date asc").Find(&list).Error
	return list, err
}

func (r *leadFollowUpRepository) ListPendingByAssignee(userID uint, page, limit int) ([]*models.LeadFollowUp, int64, error) {
	var list []*models.LeadFollowUp
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.LeadFollowUp{}).Where("assigned_to_id = ? AND is_completed = false", userID)
	q.Count(&total)
	err := q.Order("due_date asc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *leadFollowUpRepository) Update(f *models.LeadFollowUp) error {
	return r.db.Save(f).Error
}

// ─── Trial Visit ──────────────────────────────────────────────────────────────

type TrialVisitRepository interface {
	Create(t *models.TrialVisit) error
	FindByID(id uint) (*models.TrialVisit, error)
	ListByEnquiry(enquiryID uint) ([]*models.TrialVisit, error)
	ListUpcoming(page, limit int) ([]*models.TrialVisit, int64, error)
	Update(t *models.TrialVisit) error
}

type trialVisitRepository struct{ db *gorm.DB }

func NewTrialVisitRepository(db *gorm.DB) TrialVisitRepository {
	return &trialVisitRepository{db: db}
}

func (r *trialVisitRepository) Create(t *models.TrialVisit) error {
	return r.db.Create(t).Error
}

func (r *trialVisitRepository) FindByID(id uint) (*models.TrialVisit, error) {
	var t models.TrialVisit
	err := r.db.First(&t, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &t, err
}

func (r *trialVisitRepository) ListByEnquiry(enquiryID uint) ([]*models.TrialVisit, error) {
	var list []*models.TrialVisit
	err := r.db.Where("enquiry_id = ?", enquiryID).Order("scheduled_at asc").Find(&list).Error
	return list, err
}

func (r *trialVisitRepository) ListUpcoming(page, limit int) ([]*models.TrialVisit, int64, error) {
	var list []*models.TrialVisit
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.TrialVisit{}).Where("status = 'scheduled'")
	q.Count(&total)
	err := q.Order("scheduled_at asc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *trialVisitRepository) Update(t *models.TrialVisit) error {
	return r.db.Save(t).Error
}

// ─── Member Waiver ────────────────────────────────────────────────────────────

type MemberWaiverRepository interface {
	Create(w *models.MemberWaiver) error
	FindByID(id uint) (*models.MemberWaiver, error)
	FindActiveByMember(memberID uint, waiverType string) (*models.MemberWaiver, error)
	ListByMember(memberID uint) ([]*models.MemberWaiver, error)
	Update(w *models.MemberWaiver) error
}

type memberWaiverRepository struct{ db *gorm.DB }

func NewMemberWaiverRepository(db *gorm.DB) MemberWaiverRepository {
	return &memberWaiverRepository{db: db}
}

func (r *memberWaiverRepository) Create(w *models.MemberWaiver) error {
	return r.db.Create(w).Error
}

func (r *memberWaiverRepository) FindByID(id uint) (*models.MemberWaiver, error) {
	var w models.MemberWaiver
	err := r.db.Preload("Member.User").First(&w, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &w, err
}

func (r *memberWaiverRepository) FindActiveByMember(memberID uint, waiverType string) (*models.MemberWaiver, error) {
	var w models.MemberWaiver
	err := r.db.Where("member_id = ? AND waiver_type = ? AND status = 'signed'", memberID, waiverType).
		Order("signed_at desc").First(&w).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &w, err
}

func (r *memberWaiverRepository) ListByMember(memberID uint) ([]*models.MemberWaiver, error) {
	var list []*models.MemberWaiver
	err := r.db.Where("member_id = ?", memberID).Order("created_at desc").Find(&list).Error
	return list, err
}

func (r *memberWaiverRepository) Update(w *models.MemberWaiver) error {
	return r.db.Save(w).Error
}
