package repositories

import (
	"fmt"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type StaffRepository interface {
	Create(s *models.Staff) error
	FindByID(id uint) (*models.Staff, error)
	List(status, department, search string, page, perPage int) ([]*models.Staff, int64, error)
	Update(s *models.Staff) error
	Delete(id uint) error
	MaxEmployeeSeq() int
}

type staffRepository struct{ db *gorm.DB }

func NewStaffRepository(db *gorm.DB) StaffRepository {
	return &staffRepository{db: db}
}

func (r *staffRepository) Create(s *models.Staff) error {
	return r.db.Create(s).Error
}

func (r *staffRepository) FindByID(id uint) (*models.Staff, error) {
	var s models.Staff
	err := r.db.First(&s, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &s, err
}

func (r *staffRepository) List(status, department, search string, page, perPage int) ([]*models.Staff, int64, error) {
	q := r.db.Model(&models.Staff{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if department != "" {
		q = q.Where("department = ?", department)
	}
	if search != "" {
		like := fmt.Sprintf("%%%s%%", search)
		q = q.Where("first_name LIKE ? OR last_name LIKE ? OR employee_id LIKE ? OR phone LIKE ?", like, like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * perPage
	var list []*models.Staff
	err := q.Order("created_at DESC").Offset(offset).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *staffRepository) Update(s *models.Staff) error {
	return r.db.Save(s).Error
}

func (r *staffRepository) Delete(id uint) error {
	return r.db.Delete(&models.Staff{}, id).Error
}

func (r *staffRepository) MaxEmployeeSeq() int {
	var maxID int
	r.db.Raw("SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, 4) AS UNSIGNED)), 0) FROM staff").Scan(&maxID)
	return maxID
}
