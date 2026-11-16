package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type MaintenanceRepository interface {
	Create(t *models.MaintenanceTask) error
	FindByID(id uint) (*models.MaintenanceTask, error)
	List(req utils.PageRequest, facilityID uint, status, category, priority string) ([]*models.MaintenanceTask, int64, error)
	Update(t *models.MaintenanceTask) error
	Delete(id uint) error
}

type maintenanceRepository struct{ db *gorm.DB }

func NewMaintenanceRepository(db *gorm.DB) MaintenanceRepository {
	return &maintenanceRepository{db: db}
}

func (r *maintenanceRepository) Create(t *models.MaintenanceTask) error {
	return r.db.Create(t).Error
}

func (r *maintenanceRepository) FindByID(id uint) (*models.MaintenanceTask, error) {
	var t models.MaintenanceTask
	err := r.db.Where("id = ?", id).First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *maintenanceRepository) List(req utils.PageRequest, facilityID uint, status, category, priority string) ([]*models.MaintenanceTask, int64, error) {
	q := r.db.Model(&models.MaintenanceTask{})
	if facilityID > 0 {
		q = q.Where("facility_id = ?", facilityID)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if category != "" {
		q = q.Where("category = ?", category)
	}
	if priority != "" {
		q = q.Where("priority = ?", priority)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var tasks []*models.MaintenanceTask
	if err := q.Order("created_at DESC").
		Offset((req.Page - 1) * req.PerPage).Limit(req.PerPage).
		Find(&tasks).Error; err != nil {
		return nil, 0, err
	}
	return tasks, total, nil
}

func (r *maintenanceRepository) Update(t *models.MaintenanceTask) error {
	return r.db.Save(t).Error
}

func (r *maintenanceRepository) Delete(id uint) error {
	return r.db.Delete(&models.MaintenanceTask{}, id).Error
}
