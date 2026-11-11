package repositories

import (
	"fmt"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type VendorRepository interface {
	Create(v *models.Vendor) error
	FindByID(id uint) (*models.Vendor, error)
	List(status, category, search string, page, perPage int) ([]*models.Vendor, int64, error)
	Update(v *models.Vendor) error
	Delete(id uint) error
}

type vendorRepository struct{ db *gorm.DB }

func NewVendorRepository(db *gorm.DB) VendorRepository {
	return &vendorRepository{db: db}
}

func (r *vendorRepository) Create(v *models.Vendor) error {
	return r.db.Create(v).Error
}

func (r *vendorRepository) FindByID(id uint) (*models.Vendor, error) {
	var v models.Vendor
	err := r.db.First(&v, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &v, err
}

func (r *vendorRepository) List(status, category, search string, page, perPage int) ([]*models.Vendor, int64, error) {
	q := r.db.Model(&models.Vendor{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if category != "" {
		q = q.Where("category = ?", category)
	}
	if search != "" {
		like := fmt.Sprintf("%%%s%%", search)
		q = q.Where("name LIKE ? OR contact_name LIKE ? OR phone LIKE ?", like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * perPage
	var list []*models.Vendor
	err := q.Order("name ASC").Offset(offset).Limit(perPage).Find(&list).Error
	return list, total, err
}

func (r *vendorRepository) Update(v *models.Vendor) error {
	return r.db.Save(v).Error
}

func (r *vendorRepository) Delete(id uint) error {
	return r.db.Delete(&models.Vendor{}, id).Error
}
