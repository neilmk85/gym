package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type AuditLogRepository interface {
	Create(log *models.AuditLog) error
	List(req utils.PageRequest, userID *uint, resourceType string) ([]*models.AuditLog, int64, error)
}

type auditLogRepository struct {
	db *gorm.DB
}

func NewAuditLogRepository(db *gorm.DB) AuditLogRepository {
	return &auditLogRepository{db: db}
}

func (r *auditLogRepository) Create(log *models.AuditLog) error {
	return r.db.Create(log).Error
}

func (r *auditLogRepository) List(req utils.PageRequest, userID *uint, resourceType string) ([]*models.AuditLog, int64, error) {
	query := r.db.Model(&models.AuditLog{})
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	if resourceType != "" {
		query = query.Where("resource_type = ?", resourceType)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []*models.AuditLog
	if err := req.Apply(query).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}
