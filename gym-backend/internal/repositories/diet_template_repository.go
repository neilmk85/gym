package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type DietTemplateRepository interface {
	Create(t *models.DietTemplate) error
	FindByID(id uint) (*models.DietTemplate, error)
	List(req utils.PageRequest, category string, activeOnly bool) ([]*models.DietTemplate, int64, error)
	Update(t *models.DietTemplate) error
	Delete(id uint) error
	CountAll() (int64, error)
}

type dietTemplateRepository struct {
	db *gorm.DB
}

func NewDietTemplateRepository(db *gorm.DB) DietTemplateRepository {
	return &dietTemplateRepository{db: db}
}

func (r *dietTemplateRepository) Create(t *models.DietTemplate) error {
	return r.db.Create(t).Error
}

func (r *dietTemplateRepository) FindByID(id uint) (*models.DietTemplate, error) {
	var t models.DietTemplate
	err := r.db.Where("id = ?", id).First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *dietTemplateRepository) List(req utils.PageRequest, category string, activeOnly bool) ([]*models.DietTemplate, int64, error) {
	query := r.db.Model(&models.DietTemplate{})

	if category != "" {
		query = query.Where("category = ?", category)
	}
	if activeOnly {
		query = query.Where("is_active = true")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var templates []*models.DietTemplate
	if err := query.Order("created_at DESC").
		Offset((req.Page - 1) * req.PerPage).Limit(req.PerPage).
		Find(&templates).Error; err != nil {
		return nil, 0, err
	}
	return templates, total, nil
}

func (r *dietTemplateRepository) Update(t *models.DietTemplate) error {
	return r.db.Save(t).Error
}

func (r *dietTemplateRepository) Delete(id uint) error {
	return r.db.Delete(&models.DietTemplate{}, id).Error
}

func (r *dietTemplateRepository) CountAll() (int64, error) {
	var count int64
	err := r.db.Model(&models.DietTemplate{}).Count(&count).Error
	return count, err
}
