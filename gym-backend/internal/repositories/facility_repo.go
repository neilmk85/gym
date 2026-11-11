package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type FacilityRepository interface {
	Create(f *models.Facility) error
	FindByID(id uint) (*models.Facility, error)
	List(req utils.PageRequest) ([]*models.Facility, int64, error)
	Update(f *models.Facility) error
}

type facilityRepository struct {
	db *gorm.DB
}

func NewFacilityRepository(db *gorm.DB) FacilityRepository {
	return &facilityRepository{db: db}
}

func (r *facilityRepository) Create(f *models.Facility) error {
	return r.db.Create(f).Error
}

func (r *facilityRepository) FindByID(id uint) (*models.Facility, error) {
	var f models.Facility
	err := r.db.Where("id = ?", id).First(&f).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &f, nil
}

func (r *facilityRepository) List(req utils.PageRequest) ([]*models.Facility, int64, error) {
	query := r.db.Model(&models.Facility{})

	if s := req.Search; s != "" {
		like := "%" + s + "%"
		query = query.Where("name LIKE ? OR city LIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var facilities []*models.Facility
	if err := req.Apply(query).Find(&facilities).Error; err != nil {
		return nil, 0, err
	}
	return facilities, total, nil
}

func (r *facilityRepository) Update(f *models.Facility) error {
	return r.db.Save(f).Error
}
