package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type ClassRepository interface {
	Create(c *models.Class) error
	CreateBatch(classes []*models.Class) error
	FindByID(id uint) (*models.Class, error)
	List(req utils.PageRequest, facilityID *uint, trainerID *uint, status string) ([]*models.Class, int64, error)
	ListUpcoming(facilityID uint, from time.Time, limit int) ([]*models.Class, error)
	ListStartingBetween(from, to time.Time) ([]*models.Class, error)
	Update(c *models.Class) error
	IncrementEnrollment(id uint, delta int) error
	IncrementWaitlist(id uint, delta int) error
	// CompleteEndedClasses sets status=completed for all scheduled/ongoing
	// classes whose end_time is before the given cutoff.
	CompleteEndedClasses(before time.Time) (int64, error)
}

type classRepository struct {
	db *gorm.DB
}

func NewClassRepository(db *gorm.DB) ClassRepository {
	return &classRepository{db: db}
}

func (r *classRepository) Create(c *models.Class) error {
	return r.db.Create(c).Error
}

func (r *classRepository) FindByID(id uint) (*models.Class, error) {
	var c models.Class
	err := r.db.Preload("Trainer.User").Preload("Facility").
		Where("id = ?", id).First(&c).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *classRepository) List(req utils.PageRequest, facilityID *uint, trainerID *uint, status string) ([]*models.Class, int64, error) {
	query := r.db.Model(&models.Class{}).Preload("Trainer.User")

	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if trainerID != nil {
		query = query.Where("trainer_id = ?", *trainerID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if ct, ok := req.Filters["class_type"]; ok && ct != "" {
		query = query.Where("class_type = ?", ct)
	}
	if from, ok := req.Filters["from"]; ok && from != "" {
		query = query.Where("start_time >= ?", from)
	}
	if to, ok := req.Filters["to"]; ok && to != "" {
		query = query.Where("start_time <= ?", to)
	}
	if req.Search != "" {
		query = query.Where("LOWER(name) LIKE ?", "%"+req.Search+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var classes []*models.Class
	if err := req.Apply(query).Order("start_time ASC").Find(&classes).Error; err != nil {
		return nil, 0, err
	}
	return classes, total, nil
}

func (r *classRepository) ListUpcoming(facilityID uint, from time.Time, limit int) ([]*models.Class, error) {
	var classes []*models.Class
	err := r.db.Preload("Trainer.User").
		Where("facility_id = ? AND start_time >= ? AND status = 'scheduled' AND is_active = true", facilityID, from).
		Order("start_time ASC").Limit(limit).Find(&classes).Error
	return classes, err
}

func (r *classRepository) ListStartingBetween(from, to time.Time) ([]*models.Class, error) {
	var classes []*models.Class
	err := r.db.Preload("Trainer.User").
		Where("start_time >= ? AND start_time <= ? AND status = 'scheduled' AND is_active = true", from, to).
		Order("start_time ASC").Find(&classes).Error
	return classes, err
}

func (r *classRepository) Update(c *models.Class) error {
	return r.db.Save(c).Error
}

func (r *classRepository) IncrementEnrollment(id uint, delta int) error {
	return r.db.Model(&models.Class{}).Where("id = ?", id).
		UpdateColumn("current_enrollment", gorm.Expr("current_enrollment + ?", delta)).Error
}

func (r *classRepository) IncrementWaitlist(id uint, delta int) error {
	return r.db.Model(&models.Class{}).Where("id = ?", id).
		UpdateColumn("waitlist_count", gorm.Expr("waitlist_count + ?", delta)).Error
}

func (r *classRepository) CompleteEndedClasses(before time.Time) (int64, error) {
	res := r.db.Model(&models.Class{}).
		Where("status IN ? AND end_time < ?",
			[]string{models.ClassStatusScheduled, models.ClassStatusOngoing}, before).
		Updates(map[string]any{"status": models.ClassStatusCompleted, "is_active": false})
	return res.RowsAffected, res.Error
}

func (r *classRepository) CreateBatch(classes []*models.Class) error {
	if len(classes) == 0 {
		return nil
	}
	return r.db.Create(&classes).Error
}
