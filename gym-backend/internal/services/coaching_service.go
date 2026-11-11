package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── Exercise Service ─────────────────────────────────────────────────────────

type ExerciseService interface {
	CreateExercise(req CreateExerciseRequest, createdByID uint) (*models.Exercise, error)
	GetExercise(id uint) (*models.Exercise, error)
	ListExercises(page, limit int, search string) ([]*models.Exercise, int64, error)
	UpdateExercise(id uint, req UpdateExerciseRequest) (*models.Exercise, error)
	DeleteExercise(id uint) error
}

type CreateExerciseRequest struct {
	Name         string `json:"name"`
	Category     string `json:"category"`
	MuscleGroups string `json:"muscle_groups"`
	Equipment    string `json:"equipment"`
	Instructions string `json:"instructions"`
	VideoURL     string `json:"video_url"`
}

type UpdateExerciseRequest struct {
	Name         *string `json:"name"`
	Category     *string `json:"category"`
	MuscleGroups *string `json:"muscle_groups"`
	Equipment    *string `json:"equipment"`
	Instructions *string `json:"instructions"`
	VideoURL     *string `json:"video_url"`
}

type exerciseService struct {
	repo   repositories.ExerciseRepository
	logger *slog.Logger
}

func NewExerciseService(repo repositories.ExerciseRepository, logger *slog.Logger) ExerciseService {
	return &exerciseService{repo: repo, logger: logger}
}

func (s *exerciseService) CreateExercise(req CreateExerciseRequest, createdByID uint) (*models.Exercise, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	e := &models.Exercise{
		Name:         req.Name,
		Category:     req.Category,
		MuscleGroups: req.MuscleGroups,
		Equipment:    req.Equipment,
		Instructions: req.Instructions,
		VideoURL:     req.VideoURL,
		IsActive:     true,
		CreatedByID:  createdByID,
	}
	if err := s.repo.Create(e); err != nil {
		return nil, err
	}
	return e, nil
}

func (s *exerciseService) GetExercise(id uint) (*models.Exercise, error) {
	e, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if e == nil {
		return nil, apperrors.New(http.StatusNotFound, "COACH_001", "exercise not found", "")
	}
	return e, nil
}

func (s *exerciseService) ListExercises(page, limit int, search string) ([]*models.Exercise, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	return s.repo.List(page, limit, search)
}

func (s *exerciseService) UpdateExercise(id uint, req UpdateExerciseRequest) (*models.Exercise, error) {
	e, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if e == nil {
		return nil, apperrors.New(http.StatusNotFound, "COACH_001", "exercise not found", "")
	}
	if req.Name != nil {
		e.Name = *req.Name
	}
	if req.Category != nil {
		e.Category = *req.Category
	}
	if req.MuscleGroups != nil {
		e.MuscleGroups = *req.MuscleGroups
	}
	if req.Equipment != nil {
		e.Equipment = *req.Equipment
	}
	if req.Instructions != nil {
		e.Instructions = *req.Instructions
	}
	if req.VideoURL != nil {
		e.VideoURL = *req.VideoURL
	}
	if err := s.repo.Update(e); err != nil {
		return nil, err
	}
	return e, nil
}

func (s *exerciseService) DeleteExercise(id uint) error {
	e, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}
	if e == nil {
		return apperrors.New(http.StatusNotFound, "COACH_001", "exercise not found", "")
	}
	return s.repo.Delete(id)
}

// ─── Coaching Service (workout/diet assignments + logs + feedback) ────────────

type CoachingService interface {
	// Workout assignments
	CreateWorkoutAssignment(req CreateWorkoutAssignmentRequest, createdByID uint) (*models.WorkoutAssignment, error)
	GetWorkoutAssignment(id uint) (*models.WorkoutAssignment, error)
	ListWorkoutAssignmentsByMember(memberID uint, page, limit int) ([]*models.WorkoutAssignment, int64, error)
	ListWorkoutAssignmentsByTrainer(trainerID uint, page, limit int) ([]*models.WorkoutAssignment, int64, error)
	RevokeWorkoutAssignment(id uint) error

	// Diet assignments
	CreateDietAssignment(req CreateDietAssignmentRequest, createdByID uint) (*models.DietAssignment, error)
	GetDietAssignment(id uint) (*models.DietAssignment, error)
	ListDietAssignmentsByMember(memberID uint, page, limit int) ([]*models.DietAssignment, int64, error)
	ListDietAssignmentsByTrainer(trainerID uint, page, limit int) ([]*models.DietAssignment, int64, error)
	RevokeDietAssignment(id uint) error

	// Workout logs
	CreateWorkoutLog(req CreateWorkoutLogRequest) (*models.WorkoutLog, error)
	GetWorkoutLog(id uint) (*models.WorkoutLog, error)
	ListWorkoutLogsByMember(memberID uint, page, limit int) ([]*models.WorkoutLog, int64, error)

	// Trainer feedback
	CreateTrainerFeedback(req CreateTrainerFeedbackRequest) (*models.TrainerFeedback, error)
	GetTrainerFeedback(id uint) (*models.TrainerFeedback, error)
	ListFeedbackByMember(memberID uint, page, limit int) ([]*models.TrainerFeedback, int64, error)
	ListFeedbackByTrainer(trainerID uint, page, limit int) ([]*models.TrainerFeedback, int64, error)
}

type CreateWorkoutAssignmentRequest struct {
	MemberID           uint   `json:"member_id"`
	TrainerID          uint   `json:"trainer_id"`
	TrainingTemplateID *uint  `json:"training_template_id"`
	Title              string `json:"title"`
	Description        string `json:"description"`
	StartDate          string `json:"start_date"` // YYYY-MM-DD
	EndDate            string `json:"end_date"`   // optional
	Notes              string `json:"notes"`
}

type CreateDietAssignmentRequest struct {
	MemberID       uint   `json:"member_id"`
	TrainerID      uint   `json:"trainer_id"`
	DietTemplateID *uint  `json:"diet_template_id"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	StartDate      string `json:"start_date"` // YYYY-MM-DD
	EndDate        string `json:"end_date"`   // optional
	Notes          string `json:"notes"`
}

type CreateWorkoutLogRequest struct {
	MemberID            uint   `json:"member_id"`
	WorkoutAssignmentID *uint  `json:"workout_assignment_id"`
	PTSessionID         *uint  `json:"pt_session_id"`
	LogDate             string `json:"log_date"` // YYYY-MM-DD
	Status              string `json:"status"`
	DurationMinutes     int    `json:"duration_minutes"`
	Notes               string `json:"notes"`
	Exercises           string `json:"exercises"` // raw JSON
}

type CreateTrainerFeedbackRequest struct {
	MemberID            uint   `json:"member_id"`
	TrainerID           uint   `json:"trainer_id"`
	WorkoutAssignmentID *uint  `json:"workout_assignment_id"`
	PTSessionID         *uint  `json:"pt_session_id"`
	Rating              string `json:"rating"`
	Feedback            string `json:"feedback"`
	Goals               string `json:"goals"`
	Recommendations     string `json:"recommendations"`
	FeedbackDate        string `json:"feedback_date"` // YYYY-MM-DD
}

type coachingService struct {
	workoutRepo  repositories.WorkoutAssignmentRepository
	dietRepo     repositories.DietAssignmentRepository
	logRepo      repositories.WorkoutLogRepository
	feedbackRepo repositories.TrainerFeedbackRepository
	logger       *slog.Logger
}

func NewCoachingService(
	workoutRepo repositories.WorkoutAssignmentRepository,
	dietRepo repositories.DietAssignmentRepository,
	logRepo repositories.WorkoutLogRepository,
	feedbackRepo repositories.TrainerFeedbackRepository,
	logger *slog.Logger,
) CoachingService {
	return &coachingService{
		workoutRepo:  workoutRepo,
		dietRepo:     dietRepo,
		logRepo:      logRepo,
		feedbackRepo: feedbackRepo,
		logger:       logger,
	}
}

func parseDate(s string) (time.Time, error) {
	return time.Parse("2006-01-02", s)
}

func parseDatePtr(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// ── Workout Assignments ───────────────────────────────────────────────────────

func (s *coachingService) CreateWorkoutAssignment(req CreateWorkoutAssignmentRequest, _ uint) (*models.WorkoutAssignment, error) {
	if req.MemberID == 0 || req.TrainerID == 0 {
		return nil, apperrors.ErrValidation("member_id and trainer_id are required")
	}
	if req.Title == "" {
		return nil, apperrors.ErrValidation("title is required")
	}
	if req.StartDate == "" {
		return nil, apperrors.ErrValidation("start_date is required")
	}
	startDate, err := parseDate(req.StartDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid start_date format, use YYYY-MM-DD")
	}
	endDate, err := parseDatePtr(req.EndDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid end_date format, use YYYY-MM-DD")
	}
	a := &models.WorkoutAssignment{
		MemberID:           req.MemberID,
		TrainerID:          req.TrainerID,
		TrainingTemplateID: req.TrainingTemplateID,
		Title:              req.Title,
		Description:        req.Description,
		StartDate:          startDate,
		EndDate:            endDate,
		Status:             models.AssignmentStatusActive,
		Notes:              req.Notes,
	}
	if err := s.workoutRepo.Create(a); err != nil {
		return nil, err
	}
	return s.workoutRepo.FindByID(a.ID)
}

func (s *coachingService) GetWorkoutAssignment(id uint) (*models.WorkoutAssignment, error) {
	a, err := s.workoutRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, apperrors.New(http.StatusNotFound, "COACH_001", "workout assignment not found", "")
	}
	return a, nil
}

func (s *coachingService) ListWorkoutAssignmentsByMember(memberID uint, page, limit int) ([]*models.WorkoutAssignment, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.workoutRepo.ListByMember(memberID, page, limit)
}

func (s *coachingService) ListWorkoutAssignmentsByTrainer(trainerID uint, page, limit int) ([]*models.WorkoutAssignment, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.workoutRepo.ListByTrainer(trainerID, page, limit)
}

func (s *coachingService) RevokeWorkoutAssignment(id uint) error {
	a, err := s.workoutRepo.FindByID(id)
	if err != nil {
		return err
	}
	if a == nil {
		return apperrors.New(http.StatusNotFound, "COACH_001", "workout assignment not found", "")
	}
	a.Status = models.AssignmentStatusRevoked
	return s.workoutRepo.Update(a)
}

// ── Diet Assignments ──────────────────────────────────────────────────────────

func (s *coachingService) CreateDietAssignment(req CreateDietAssignmentRequest, _ uint) (*models.DietAssignment, error) {
	if req.MemberID == 0 || req.TrainerID == 0 {
		return nil, apperrors.ErrValidation("member_id and trainer_id are required")
	}
	if req.Title == "" {
		return nil, apperrors.ErrValidation("title is required")
	}
	if req.StartDate == "" {
		return nil, apperrors.ErrValidation("start_date is required")
	}
	startDate, err := parseDate(req.StartDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid start_date format, use YYYY-MM-DD")
	}
	endDate, err := parseDatePtr(req.EndDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid end_date format, use YYYY-MM-DD")
	}
	a := &models.DietAssignment{
		MemberID:       req.MemberID,
		TrainerID:      req.TrainerID,
		DietTemplateID: req.DietTemplateID,
		Title:          req.Title,
		Description:    req.Description,
		StartDate:      startDate,
		EndDate:        endDate,
		Status:         models.AssignmentStatusActive,
		Notes:          req.Notes,
	}
	if err := s.dietRepo.Create(a); err != nil {
		return nil, err
	}
	return s.dietRepo.FindByID(a.ID)
}

func (s *coachingService) GetDietAssignment(id uint) (*models.DietAssignment, error) {
	a, err := s.dietRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, apperrors.New(http.StatusNotFound, "COACH_001", "diet assignment not found", "")
	}
	return a, nil
}

func (s *coachingService) ListDietAssignmentsByMember(memberID uint, page, limit int) ([]*models.DietAssignment, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.dietRepo.ListByMember(memberID, page, limit)
}

func (s *coachingService) ListDietAssignmentsByTrainer(trainerID uint, page, limit int) ([]*models.DietAssignment, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.dietRepo.ListByTrainer(trainerID, page, limit)
}

func (s *coachingService) RevokeDietAssignment(id uint) error {
	a, err := s.dietRepo.FindByID(id)
	if err != nil {
		return err
	}
	if a == nil {
		return apperrors.New(http.StatusNotFound, "COACH_001", "diet assignment not found", "")
	}
	a.Status = models.AssignmentStatusRevoked
	return s.dietRepo.Update(a)
}

// ── Workout Logs ──────────────────────────────────────────────────────────────

func (s *coachingService) CreateWorkoutLog(req CreateWorkoutLogRequest) (*models.WorkoutLog, error) {
	if req.MemberID == 0 {
		return nil, apperrors.ErrValidation("member_id is required")
	}
	if req.LogDate == "" {
		return nil, apperrors.ErrValidation("log_date is required")
	}
	logDate, err := parseDate(req.LogDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid log_date format, use YYYY-MM-DD")
	}
	status := req.Status
	if status == "" {
		status = models.WorkoutLogStatusCompleted
	}
	l := &models.WorkoutLog{
		MemberID:            req.MemberID,
		WorkoutAssignmentID: req.WorkoutAssignmentID,
		PTSessionID:         req.PTSessionID,
		LogDate:             logDate,
		Status:              status,
		DurationMinutes:     req.DurationMinutes,
		Notes:               req.Notes,
		Exercises:           req.Exercises,
	}
	if err := s.logRepo.Create(l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *coachingService) GetWorkoutLog(id uint) (*models.WorkoutLog, error) {
	l, err := s.logRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if l == nil {
		return nil, apperrors.New(http.StatusNotFound, "COACH_001", "workout log not found", "")
	}
	return l, nil
}

func (s *coachingService) ListWorkoutLogsByMember(memberID uint, page, limit int) ([]*models.WorkoutLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.logRepo.ListByMember(memberID, page, limit)
}

// ── Trainer Feedback ──────────────────────────────────────────────────────────

func (s *coachingService) CreateTrainerFeedback(req CreateTrainerFeedbackRequest) (*models.TrainerFeedback, error) {
	if req.MemberID == 0 || req.TrainerID == 0 {
		return nil, apperrors.ErrValidation("member_id and trainer_id are required")
	}
	if req.Feedback == "" {
		return nil, apperrors.ErrValidation("feedback is required")
	}
	fbDate := time.Now()
	if req.FeedbackDate != "" {
		d, err := parseDate(req.FeedbackDate)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid feedback_date format, use YYYY-MM-DD")
		}
		fbDate = d
	}
	f := &models.TrainerFeedback{
		MemberID:            req.MemberID,
		TrainerID:           req.TrainerID,
		WorkoutAssignmentID: req.WorkoutAssignmentID,
		PTSessionID:         req.PTSessionID,
		Rating:              req.Rating,
		Feedback:            req.Feedback,
		Goals:               req.Goals,
		Recommendations:     req.Recommendations,
		FeedbackDate:        fbDate,
	}
	if err := s.feedbackRepo.Create(f); err != nil {
		return nil, err
	}
	return s.feedbackRepo.FindByID(f.ID)
}

func (s *coachingService) GetTrainerFeedback(id uint) (*models.TrainerFeedback, error) {
	f, err := s.feedbackRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if f == nil {
		return nil, apperrors.New(http.StatusNotFound, "COACH_001", "feedback not found", "")
	}
	return f, nil
}

func (s *coachingService) ListFeedbackByMember(memberID uint, page, limit int) ([]*models.TrainerFeedback, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.feedbackRepo.ListByMember(memberID, page, limit)
}

func (s *coachingService) ListFeedbackByTrainer(trainerID uint, page, limit int) ([]*models.TrainerFeedback, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.feedbackRepo.ListByTrainer(trainerID, page, limit)
}
