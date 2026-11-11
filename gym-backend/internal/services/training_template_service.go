package services

import (
	"log/slog"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type CreateTrainingTemplateRequest struct {
	FacilityID      *uint    `json:"facility_id"`
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	Difficulty      string   `json:"difficulty"`
	Description     string   `json:"description"`
	DurationWeeks   int      `json:"duration_weeks"`
	SessionsPerWeek int      `json:"sessions_per_week"`
	WorkoutPlan     string   `json:"workout_plan"`
	Equipment       []string `json:"equipment"`
	Tags            []string `json:"tags"`
}

type UpdateTrainingTemplateRequest struct {
	Name            string   `json:"name"`
	Category        string   `json:"category"`
	Difficulty      string   `json:"difficulty"`
	Description     string   `json:"description"`
	DurationWeeks   *int     `json:"duration_weeks"`
	SessionsPerWeek *int     `json:"sessions_per_week"`
	WorkoutPlan     string   `json:"workout_plan"`
	Equipment       []string `json:"equipment"`
	Tags            []string `json:"tags"`
	IsActive        *bool    `json:"is_active"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type TrainingTemplateService interface {
	Create(req CreateTrainingTemplateRequest, createdByID uint) (*models.TrainingTemplate, error)
	GetByID(id uint) (*models.TrainingTemplate, error)
	List(req utils.PageRequest, category string, difficulty string, activeOnly bool) ([]*models.TrainingTemplate, int64, error)
	Update(id uint, req UpdateTrainingTemplateRequest) (*models.TrainingTemplate, error)
	Delete(id uint) error
	SeedDefaults() error // seeds 4 default templates if none exist
}

type trainingTemplateService struct {
	repo   repositories.TrainingTemplateRepository
	logger *slog.Logger
}

func NewTrainingTemplateService(
	repo repositories.TrainingTemplateRepository,
	logger *slog.Logger,
) TrainingTemplateService {
	return &trainingTemplateService{
		repo:   repo,
		logger: logger,
	}
}

func (s *trainingTemplateService) Create(req CreateTrainingTemplateRequest, createdByID uint) (*models.TrainingTemplate, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.Category == "" {
		return nil, apperrors.ErrValidation("category is required")
	}
	if req.Difficulty == "" {
		return nil, apperrors.ErrValidation("difficulty is required")
	}

	t := &models.TrainingTemplate{
		FacilityID:      req.FacilityID,
		Name:            req.Name,
		Category:        req.Category,
		Difficulty:      req.Difficulty,
		Description:     req.Description,
		DurationWeeks:   req.DurationWeeks,
		SessionsPerWeek: req.SessionsPerWeek,
		WorkoutPlan:     req.WorkoutPlan,
		Equipment:       models.StringSlice(req.Equipment),
		Tags:            models.StringSlice(req.Tags),
		IsActive:        true,
		CreatedByID:     &createdByID,
	}

	if err := s.repo.Create(t); err != nil {
		s.logger.Error("create training template failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return t, nil
}

func (s *trainingTemplateService) GetByID(id uint) (*models.TrainingTemplate, error) {
	t, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if t == nil {
		return nil, apperrors.New(http.StatusNotFound, "TT_001", "Training template not found", "")
	}
	return t, nil
}

func (s *trainingTemplateService) List(req utils.PageRequest, category string, difficulty string, activeOnly bool) ([]*models.TrainingTemplate, int64, error) {
	return s.repo.List(req, category, difficulty, activeOnly)
}

func (s *trainingTemplateService) Update(id uint, req UpdateTrainingTemplateRequest) (*models.TrainingTemplate, error) {
	t, err := s.repo.FindByID(id)
	if err != nil || t == nil {
		return nil, apperrors.New(http.StatusNotFound, "TT_001", "Training template not found", "")
	}

	if req.Name != "" {
		t.Name = req.Name
	}
	if req.Category != "" {
		t.Category = req.Category
	}
	if req.Difficulty != "" {
		t.Difficulty = req.Difficulty
	}
	if req.Description != "" {
		t.Description = req.Description
	}
	if req.DurationWeeks != nil {
		t.DurationWeeks = *req.DurationWeeks
	}
	if req.SessionsPerWeek != nil {
		t.SessionsPerWeek = *req.SessionsPerWeek
	}
	if req.WorkoutPlan != "" {
		t.WorkoutPlan = req.WorkoutPlan
	}
	if req.Equipment != nil {
		t.Equipment = models.StringSlice(req.Equipment)
	}
	if req.Tags != nil {
		t.Tags = models.StringSlice(req.Tags)
	}
	if req.IsActive != nil {
		t.IsActive = *req.IsActive
	}

	if err := s.repo.Update(t); err != nil {
		s.logger.Error("update training template failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return t, nil
}

func (s *trainingTemplateService) Delete(id uint) error {
	t, err := s.repo.FindByID(id)
	if err != nil || t == nil {
		return apperrors.New(http.StatusNotFound, "TT_001", "Training template not found", "")
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete training template failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}

func (s *trainingTemplateService) SeedDefaults() error {
	count, err := s.repo.CountAll()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	defaults := []*models.TrainingTemplate{
		{
			Name:            "Beginner Full Body",
			Category:        "strength",
			Difficulty:      "beginner",
			Description:     "A 4-week full body program for beginners focusing on foundational compound movements.",
			DurationWeeks:   4,
			SessionsPerWeek: 3,
			WorkoutPlan:     "Week 1-2 (Monday/Wednesday/Friday):\nA. Squat 3x8, B. Push-up 3x10, C. Dumbbell Row 3x10, D. Plank 3x30s, E. Glute Bridge 3x12.\nRest 60-90s between sets. Focus on form over weight.\n\nWeek 3-4: Increase reps to 12 or add light weight. Add: Lunges 3x10, Overhead Press 3x10, Lat Pulldown 3x10.",
			Equipment:       models.StringSlice{"dumbbells", "resistance_bands", "mat"},
			Tags:            models.StringSlice{"beginner", "full_body", "compound", "strength_foundation"},
			IsDefault:       true,
			IsActive:        true,
		},
		{
			Name:            "Intermediate Push/Pull/Legs",
			Category:        "strength",
			Difficulty:      "intermediate",
			Description:     "An 8-week PPL split for intermediate lifters focused on strength and hypertrophy.",
			DurationWeeks:   8,
			SessionsPerWeek: 4,
			WorkoutPlan:     "Mon (Push): Bench Press 4x6, Overhead Press 3x8, Incline DB Press 3x10, Lateral Raises 3x15, Tricep Dips 3x10.\nTue (Pull): Deadlift 4x5, Pull-ups 4x6, Barbell Row 3x8, Face Pull 3x15, Bicep Curl 3x12.\nThu (Legs): Squat 4x6, Romanian Deadlift 3x8, Leg Press 3x10, Calf Raises 4x15, Leg Curl 3x10.\nFri (Upper): Weighted Push-up/Bench 3x8, DB Row 3x8, Arnold Press 3x10, Chest Fly 3x12, Cable Row 3x12.\n\nProgressive overload: add 2.5-5kg each week on main lifts.",
			Equipment:       models.StringSlice{"barbell", "dumbbells", "pull_up_bar", "cable_machine", "bench"},
			Tags:            models.StringSlice{"intermediate", "strength", "hypertrophy", "ppl"},
			IsDefault:       true,
			IsActive:        true,
		},
		{
			Name:            "HIIT Fat Burner",
			Category:        "hiit",
			Difficulty:      "advanced",
			Description:     "A 6-week high-intensity interval training program designed for maximum fat loss.",
			DurationWeeks:   6,
			SessionsPerWeek: 5,
			WorkoutPlan:     "Mon/Wed/Fri (HIIT Circuits, 45 min):\nWarm-up 5 min jog. Circuit x4 (40s on/20s off): Jump Squats, Burpees, Mountain Climbers, High Knees, Push-ups, Jump Lunges, Box Jumps, Sprint in place.\nCool-down 5 min.\n\nTue/Thu (Moderate Cardio + Core):\n30 min steady-state cardio (run, bike, or row at 65% max HR).\nCore: Plank 3x60s, Bicycle Crunches 3x20, Russian Twists 3x20, Leg Raises 3x15, V-Ups 3x12.\n\nWeek 5-6: Increase work intervals to 45s, reduce rest to 15s.",
			Equipment:       models.StringSlice{"bodyweight", "jump_box", "timer", "mat"},
			Tags:            models.StringSlice{"hiit", "fat_loss", "cardio", "advanced", "high_intensity"},
			IsDefault:       true,
			IsActive:        true,
		},
		{
			Name:            "Yoga & Mindfulness Flow",
			Category:        "yoga",
			Difficulty:      "beginner",
			Description:     "A 6-week yoga program combining strength flow, flexibility, and mindfulness practices.",
			DurationWeeks:   6,
			SessionsPerWeek: 3,
			WorkoutPlan:     "Mon (Strength Flow, 60 min):\nSun Salutation A x5, Warrior I & II, Triangle Pose, Chair Pose, Crow Pose (or modification), Core series: Boat Pose 3x30s, Plank variations.\n\nWed (Flexibility & Hip Openers, 60 min):\nYin-style: Pigeon Pose 3 min each side, Seated Forward Fold 3 min, Butterfly Pose 3 min, Reclined Spinal Twist, Legs-Up-Wall 5 min.\n\nFri (Balance & Restoration, 45 min):\nTree Pose, Warrior III, Eagle Pose, Child's Pose, Legs-Up-Wall, Savasana 10 min.\n\nAll sessions: Begin with 5 min pranayama breathing. End with 5-10 min meditation.",
			Equipment:       models.StringSlice{"yoga_mat", "blocks", "strap", "bolster"},
			Tags:            models.StringSlice{"yoga", "flexibility", "mindfulness", "beginner", "stress_relief"},
			IsDefault:       true,
			IsActive:        true,
		},
	}

	for _, t := range defaults {
		if err := s.repo.Create(t); err != nil {
			s.logger.Error("seed training template failed", "name", t.Name, "err", err)
			return apperrors.ErrInternal
		}
	}

	s.logger.Info("seeded default training templates", "count", len(defaults))
	return nil
}
