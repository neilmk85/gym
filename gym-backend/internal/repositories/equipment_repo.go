package repositories

import (
	"fmt"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type EquipmentRepository interface {
	Create(e *models.Equipment) error
	FindByID(id uint) (*models.Equipment, error)
	List(condition, category, search string, page, perPage int) ([]*models.Equipment, int64, error)
	Update(e *models.Equipment) error
	Delete(id uint) error
}

type equipmentRepository struct{ db *gorm.DB }

func NewEquipmentRepository(db *gorm.DB) EquipmentRepository {
	return &equipmentRepository{db: db}
}

func (r *equipmentRepository) Create(e *models.Equipment) error {
	return r.db.Create(e).Error
}

func (r *equipmentRepository) FindByID(id uint) (*models.Equipment, error) {
	var e models.Equipment
	err := r.db.First(&e, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &e, err
}

func (r *equipmentRepository) List(condition, category, search string, page, perPage int) ([]*models.Equipment, int64, error) {
	q := r.db.Model(&models.Equipment{})
	if condition != "" {
		q = q.Where("condition = ?", condition)
	}
	if category != "" {
		q = q.Where("category = ?", category)
	}
	if search != "" {
		like := fmt.Sprintf("%%%s%%", search)
		q = q.Where("name LIKE ? OR brand LIKE ? OR serial_number LIKE ?", like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * perPage
	var list []*models.Equipment
	err := q.Order("category ASC, name ASC").Offset(offset).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *equipmentRepository) Update(e *models.Equipment) error {
	return r.db.Save(e).Error
}

func (r *equipmentRepository) Delete(id uint) error {
	return r.db.Delete(&models.Equipment{}, id).Error
}
