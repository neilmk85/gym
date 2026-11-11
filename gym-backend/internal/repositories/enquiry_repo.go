package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

// ─── Enquiry Repository ───────────────────────────────────────────────────────

type EnquiryRepository interface {
	Create(e *models.Enquiry) error
	FindByID(id uint) (*models.Enquiry, error)
	List(req utils.PageRequest, facilityID *uint, status string, search string) ([]*models.Enquiry, int64, error)
	Update(e *models.Enquiry) error
	Delete(id uint) error
}

type enquiryRepository struct{ db *gorm.DB }

func NewEnquiryRepository(db *gorm.DB) EnquiryRepository {
	return &enquiryRepository{db: db}
}

func (r *enquiryRepository) Create(e *models.Enquiry) error {
	return r.db.Create(e).Error
}

func (r *enquiryRepository) FindByID(id uint) (*models.Enquiry, error) {
	var e models.Enquiry
	err := r.db.Preload("AssignedTo").Where("id = ?", id).First(&e).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *enquiryRepository) List(req utils.PageRequest, facilityID *uint, status string, search string) ([]*models.Enquiry, int64, error) {
	query := r.db.Model(&models.Enquiry{}).Preload("AssignedTo")

	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("name LIKE ? OR email LIKE ? OR phone LIKE ?", like, like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var enquiries []*models.Enquiry
	if err := query.Order("created_at DESC").
		Offset((req.Page - 1) * req.PerPage).Limit(req.PerPage).
		Find(&enquiries).Error; err != nil {
		return nil, 0, err
	}
	return enquiries, total, nil
}

func (r *enquiryRepository) Update(e *models.Enquiry) error {
	return r.db.Save(e).Error
}

func (r *enquiryRepository) Delete(id uint) error {
	return r.db.Delete(&models.Enquiry{}, id).Error
}
