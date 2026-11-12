package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type PlanRepository interface {
	Create(plan *models.Plan) error
	FindByID(id uint) (*models.Plan, error)
	List(req utils.PageRequest, facilityID *uint, activeOnly bool, gender, memberCategory string) ([]*models.Plan, int64, error)
	Update(plan *models.Plan) error
	Deactivate(id uint) error
	Activate(id uint) error
}

type planRepository struct {
	db *gorm.DB
}

func NewPlanRepository(db *gorm.DB) PlanRepository {
	return &planRepository{db: db}
}

func (r *planRepository) Create(plan *models.Plan) error {
	return r.db.Create(plan).Error
}

func (r *planRepository) FindByID(id uint) (*models.Plan, error) {
	var plan models.Plan
	err := r.db.Where("id = ?", id).First(&plan).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &plan, nil
}

func (r *planRepository) List(req utils.PageRequest, facilityID *uint, activeOnly bool, gender, memberCategory string) ([]*models.Plan, int64, error) {
	query := r.db.Model(&models.Plan{})
	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if activeOnly {
		query = query.Where("is_active = true")
	}
	if t, ok := req.Filters["type"]; ok && t != "" {
		query = query.Where("type = ?", t)
	}
	if gender != "" {
		query = query.Where("gender = ? OR gender = 'any'", gender)
	}
	if memberCategory != "" {
		query = query.Where("member_category = ?", memberCategory)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var plans []*models.Plan
	if err := query.Order("display_order ASC, created_at DESC").
		Offset((req.Page - 1) * req.PerPage).Limit(req.PerPage).
		Find(&plans).Error; err != nil {
		return nil, 0, err
	}
	return plans, total, nil
}

func (r *planRepository) Update(plan *models.Plan) error {
	return r.db.Save(plan).Error
}

func (r *planRepository) Deactivate(id uint) error {
	return r.db.Model(&models.Plan{}).Where("id = ?", id).Update("is_active", false).Error
}

func (r *planRepository) Activate(id uint) error {
	return r.db.Model(&models.Plan{}).Where("id = ?", id).Update("is_active", true).Error
}
