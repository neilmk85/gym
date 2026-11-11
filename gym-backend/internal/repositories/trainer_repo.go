package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type TrainerRepository interface {
	Create(t *models.TrainerProfile) error
	FindByID(id uint) (*models.TrainerProfile, error)
	FindByUserID(userID uint) (*models.TrainerProfile, error)
	List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.TrainerProfile, int64, error)
	Update(t *models.TrainerProfile) error
	Deactivate(id uint) error

	// Schedule
	GetSchedule(trainerID uint) ([]*models.TrainerSchedule, error)
	GetShift(id uint) (*models.TrainerSchedule, error)
	CreateShift(s *models.TrainerSchedule) error
	UpdateShift(s *models.TrainerSchedule) error
	DeleteShift(id uint) error
}

type trainerRepository struct {
	db *gorm.DB
}

func NewTrainerRepository(db *gorm.DB) TrainerRepository {
	return &trainerRepository{db: db}
}

func (r *trainerRepository) Create(t *models.TrainerProfile) error {
	return r.db.Create(t).Error
}

func (r *trainerRepository) FindByID(id uint) (*models.TrainerProfile, error) {
	var t models.TrainerProfile
	err := r.db.Preload("User").Preload("Facility").
		Where("id = ?", id).First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *trainerRepository) FindByUserID(userID uint) (*models.TrainerProfile, error) {
	var t models.TrainerProfile
	err := r.db.Preload("User").Preload("Facility").
		Where("user_id = ?", userID).First(&t).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (r *trainerRepository) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.TrainerProfile, int64, error) {
	query := r.db.Model(&models.TrainerProfile{}).Preload("User")

	if facilityID != nil {
		query = query.Where("trainer_profiles.facility_id = ?", *facilityID)
	}
	if activeOnly {
		query = query.Where("trainer_profiles.is_active = true")
	}
	if req.Search != "" {
		query = query.Joins("JOIN users ON users.id = trainer_profiles.user_id").
			Where("LOWER(users.first_name) LIKE ? OR LOWER(users.last_name) LIKE ? OR LOWER(users.email) LIKE ?",
				"%"+req.Search+"%", "%"+req.Search+"%", "%"+req.Search+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var trainers []*models.TrainerProfile
	if err := req.Apply(query).Find(&trainers).Error; err != nil {
		return nil, 0, err
	}
	return trainers, total, nil
}

func (r *trainerRepository) Update(t *models.TrainerProfile) error {
	return r.db.Save(t).Error
}

func (r *trainerRepository) Deactivate(id uint) error {
	return r.db.Model(&models.TrainerProfile{}).
		Where("id = ?", id).Update("is_active", false).Error
}

// ── Schedule ──────────────────────────────────────────────────────────────────

func (r *trainerRepository) GetSchedule(trainerID uint) ([]*models.TrainerSchedule, error) {
	var shifts []*models.TrainerSchedule
	err := r.db.Where("trainer_id = ?", trainerID).
		Order("day_of_week, start_time").
		Find(&shifts).Error
	return shifts, err
}

func (r *trainerRepository) GetShift(id uint) (*models.TrainerSchedule, error) {
	var s models.TrainerSchedule
	err := r.db.Where("id = ?", id).First(&s).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *trainerRepository) CreateShift(s *models.TrainerSchedule) error {
	return r.db.Create(s).Error
}

func (r *trainerRepository) UpdateShift(s *models.TrainerSchedule) error {
	return r.db.Save(s).Error
}

func (r *trainerRepository) DeleteShift(id uint) error {
	return r.db.Delete(&models.TrainerSchedule{}, id).Error
}
