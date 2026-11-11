package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ─── Exercise Library ─────────────────────────────────────────────────────────

type ExerciseRepository interface {
	Create(e *models.Exercise) error
	FindByID(id uint) (*models.Exercise, error)
	List(page, limit int, search string) ([]*models.Exercise, int64, error)
	Update(e *models.Exercise) error
	Delete(id uint) error
}

type exerciseRepository struct{ db *gorm.DB }

func NewExerciseRepository(db *gorm.DB) ExerciseRepository {
	return &exerciseRepository{db: db}
}

func (r *exerciseRepository) Create(e *models.Exercise) error {
	return r.db.Create(e).Error
}

func (r *exerciseRepository) FindByID(id uint) (*models.Exercise, error) {
	var e models.Exercise
	err := r.db.First(&e, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &e, err
}

func (r *exerciseRepository) List(page, limit int, search string) ([]*models.Exercise, int64, error) {
	var list []*models.Exercise
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.Exercise{}).Where("is_active = true")
	if search != "" {
		q = q.Where("name LIKE ? OR category LIKE ? OR muscle_groups LIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}
	q.Count(&total)
	err := q.Order("name asc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *exerciseRepository) Update(e *models.Exercise) error {
	return r.db.Save(e).Error
}

func (r *exerciseRepository) Delete(id uint) error {
	return r.db.Model(&models.Exercise{}).Where("id = ?", id).Update("is_active", false).Error
}

// ─── Workout Assignment ───────────────────────────────────────────────────────

type WorkoutAssignmentRepository interface {
	Create(a *models.WorkoutAssignment) error
	FindByID(id uint) (*models.WorkoutAssignment, error)
	ListByMember(memberID uint, page, limit int) ([]*models.WorkoutAssignment, int64, error)
	ListByTrainer(trainerID uint, page, limit int) ([]*models.WorkoutAssignment, int64, error)
	Update(a *models.WorkoutAssignment) error
}

type workoutAssignmentRepository struct{ db *gorm.DB }

func NewWorkoutAssignmentRepository(db *gorm.DB) WorkoutAssignmentRepository {
	return &workoutAssignmentRepository{db: db}
}

func (r *workoutAssignmentRepository) Create(a *models.WorkoutAssignment) error {
	return r.db.Create(a).Error
}

func (r *workoutAssignmentRepository) FindByID(id uint) (*models.WorkoutAssignment, error) {
	var a models.WorkoutAssignment
	err := r.db.Preload("Member.User").Preload("Trainer.User").First(&a, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

func (r *workoutAssignmentRepository) ListByMember(memberID uint, page, limit int) ([]*models.WorkoutAssignment, int64, error) {
	var list []*models.WorkoutAssignment
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.WorkoutAssignment{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Preload("Trainer.User").Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *workoutAssignmentRepository) ListByTrainer(trainerID uint, page, limit int) ([]*models.WorkoutAssignment, int64, error) {
	var list []*models.WorkoutAssignment
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.WorkoutAssignment{}).Where("trainer_id = ?", trainerID)
	q.Count(&total)
	err := q.Preload("Member.User").Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *workoutAssignmentRepository) Update(a *models.WorkoutAssignment) error {
	return r.db.Save(a).Error
}

// ─── Diet Assignment ──────────────────────────────────────────────────────────

type DietAssignmentRepository interface {
	Create(a *models.DietAssignment) error
	FindByID(id uint) (*models.DietAssignment, error)
	ListByMember(memberID uint, page, limit int) ([]*models.DietAssignment, int64, error)
	ListByTrainer(trainerID uint, page, limit int) ([]*models.DietAssignment, int64, error)
	Update(a *models.DietAssignment) error
}

type dietAssignmentRepository struct{ db *gorm.DB }

func NewDietAssignmentRepository(db *gorm.DB) DietAssignmentRepository {
	return &dietAssignmentRepository{db: db}
}

func (r *dietAssignmentRepository) Create(a *models.DietAssignment) error {
	return r.db.Create(a).Error
}

func (r *dietAssignmentRepository) FindByID(id uint) (*models.DietAssignment, error) {
	var a models.DietAssignment
	err := r.db.Preload("Member.User").Preload("Trainer.User").First(&a, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &a, err
}

func (r *dietAssignmentRepository) ListByMember(memberID uint, page, limit int) ([]*models.DietAssignment, int64, error) {
	var list []*models.DietAssignment
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.DietAssignment{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Preload("Trainer.User").Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *dietAssignmentRepository) ListByTrainer(trainerID uint, page, limit int) ([]*models.DietAssignment, int64, error) {
	var list []*models.DietAssignment
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.DietAssignment{}).Where("trainer_id = ?", trainerID)
	q.Count(&total)
	err := q.Preload("Member.User").Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *dietAssignmentRepository) Update(a *models.DietAssignment) error {
	return r.db.Save(a).Error
}

// ─── Workout Log ──────────────────────────────────────────────────────────────

type WorkoutLogRepository interface {
	Create(l *models.WorkoutLog) error
	FindByID(id uint) (*models.WorkoutLog, error)
	ListByMember(memberID uint, page, limit int) ([]*models.WorkoutLog, int64, error)
	Update(l *models.WorkoutLog) error
}

type workoutLogRepository struct{ db *gorm.DB }

func NewWorkoutLogRepository(db *gorm.DB) WorkoutLogRepository {
	return &workoutLogRepository{db: db}
}

func (r *workoutLogRepository) Create(l *models.WorkoutLog) error {
	return r.db.Create(l).Error
}

func (r *workoutLogRepository) FindByID(id uint) (*models.WorkoutLog, error) {
	var l models.WorkoutLog
	err := r.db.First(&l, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &l, err
}

func (r *workoutLogRepository) ListByMember(memberID uint, page, limit int) ([]*models.WorkoutLog, int64, error) {
	var list []*models.WorkoutLog
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.WorkoutLog{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Order("log_date desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *workoutLogRepository) Update(l *models.WorkoutLog) error {
	return r.db.Save(l).Error
}

// ─── Trainer Feedback ─────────────────────────────────────────────────────────

type TrainerFeedbackRepository interface {
	Create(f *models.TrainerFeedback) error
	FindByID(id uint) (*models.TrainerFeedback, error)
	ListByMember(memberID uint, page, limit int) ([]*models.TrainerFeedback, int64, error)
	ListByTrainer(trainerID uint, page, limit int) ([]*models.TrainerFeedback, int64, error)
}

type trainerFeedbackRepository struct{ db *gorm.DB }

func NewTrainerFeedbackRepository(db *gorm.DB) TrainerFeedbackRepository {
	return &trainerFeedbackRepository{db: db}
}

func (r *trainerFeedbackRepository) Create(f *models.TrainerFeedback) error {
	return r.db.Create(f).Error
}

func (r *trainerFeedbackRepository) FindByID(id uint) (*models.TrainerFeedback, error) {
	var f models.TrainerFeedback
	err := r.db.Preload("Member.User").Preload("Trainer.User").First(&f, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &f, err
}

func (r *trainerFeedbackRepository) ListByMember(memberID uint, page, limit int) ([]*models.TrainerFeedback, int64, error) {
	var list []*models.TrainerFeedback
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.TrainerFeedback{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Preload("Trainer.User").Order("feedback_date desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *trainerFeedbackRepository) ListByTrainer(trainerID uint, page, limit int) ([]*models.TrainerFeedback, int64, error) {
	var list []*models.TrainerFeedback
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.TrainerFeedback{}).Where("trainer_id = ?", trainerID)
	q.Count(&total)
	err := q.Preload("Member.User").Order("feedback_date desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}
