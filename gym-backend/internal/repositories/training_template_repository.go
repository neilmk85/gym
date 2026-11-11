package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type TrainingTemplateRepository interface {
	Create(t *models.TrainingTemplate) error
	FindByID(id uint) (*models.TrainingTemplate, error)
	List(req utils.PageRequest, category string, difficulty string, activeOnly bool) ([]*models.TrainingTemplate, int64, error)
	Update(t *models.TrainingTemplate) error
	Delete(id uint) error
	CountAll() (int64, error)
}

type trainingTemplateRepository struct {
	db *gorm.DB
}

func NewTrainingTemplateRepository(db *gorm.DB) TrainingTemplateRepository {
	return &trainingTemplateRepository{db: db}
}

func (r *trainingTemplateRepository) Create(t *models.TrainingTemplate) error {
	return r.db.Create(t).Error
}

func (r *trainingTemplateRepository) FindByID(id uint) (*models.TrainingTemplate, error) {
	var t models.TrainingTemplate
	err := r.db.Where("id = ?", id).First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *trainingTemplateRepository) List(req utils.PageRequest, category string, difficulty string, activeOnly bool) ([]*models.TrainingTemplate, int64, error) {
	query := r.db.Model(&models.TrainingTemplate{})

	if category != "" {
		query = query.Where("category = ?", category)
	}
	if difficulty != "" {
		query = query.Where("difficulty = ?", difficulty)
	}
	if activeOnly {
		query = query.Where("is_active = true")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var templates []*models.TrainingTemplate
	if err := query.Order("created_at DESC").
		Offset((req.Page - 1) * req.PerPage).Limit(req.PerPage).
		Find(&templates).Error; err != nil {
		return nil, 0, err
	}
	return templates, total, nil
}

func (r *trainingTemplateRepository) Update(t *models.TrainingTemplate) error {
	return r.db.Save(t).Error
}

func (r *trainingTemplateRepository) Delete(id uint) error {
	return r.db.Delete(&models.TrainingTemplate{}, id).Error
}

func (r *trainingTemplateRepository) CountAll() (int64, error) {
	var count int64
	err := r.db.Model(&models.TrainingTemplate{}).Count(&count).Error
	return count, err
}
