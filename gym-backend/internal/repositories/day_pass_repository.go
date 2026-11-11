package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type DayPassRepository interface {
	Create(p *models.DayPass) error
	FindByID(id uint) (*models.DayPass, error)
	List(req utils.PageRequest, facilityID *uint, status string, dateFrom string, dateTo string) ([]*models.DayPass, int64, error)
	Update(p *models.DayPass) error
	Delete(id uint) error
	ExpireOldPasses() error // sets status=expired where valid_until < NOW() AND status=active
}

type dayPassRepository struct {
	db *gorm.DB
}

func NewDayPassRepository(db *gorm.DB) DayPassRepository {
	return &dayPassRepository{db: db}
}

func (r *dayPassRepository) Create(p *models.DayPass) error {
	return r.db.Create(p).Error
}

func (r *dayPassRepository) FindByID(id uint) (*models.DayPass, error) {
	var p models.DayPass
	err := r.db.Where("id = ?", id).First(&p).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (r *dayPassRepository) List(req utils.PageRequest, facilityID *uint, status string, dateFrom string, dateTo string) ([]*models.DayPass, int64, error) {
	query := r.db.Model(&models.DayPass{})

	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if dateFrom != "" {
		query = query.Where("pass_date >= ?", dateFrom)
	}
	if dateTo != "" {
		query = query.Where("pass_date <= ?", dateTo)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var passes []*models.DayPass
	if err := query.Order("pass_date DESC, created_at DESC").
		Offset((req.Page - 1) * req.PerPage).Limit(req.PerPage).
		Find(&passes).Error; err != nil {
		return nil, 0, err
	}
	return passes, total, nil
}

func (r *dayPassRepository) Update(p *models.DayPass) error {
	return r.db.Save(p).Error
}

func (r *dayPassRepository) Delete(id uint) error {
	return r.db.Delete(&models.DayPass{}, id).Error
}

func (r *dayPassRepository) ExpireOldPasses() error {
	return r.db.Model(&models.DayPass{}).
		Where("valid_until < ? AND status = ?", time.Now(), models.DayPassStatusActive).
		Update("status", models.DayPassStatusExpired).Error
}
