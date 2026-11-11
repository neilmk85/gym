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

type CreateDietTemplateRequest struct {
	FacilityID    *uint    `json:"facility_id"`
	Name          string   `json:"name"`
	Category      string   `json:"category"`
	Description   string   `json:"description"`
	TotalCalories int      `json:"total_calories"`
	ProteinG      float64  `json:"protein_g"`
	CarbsG        float64  `json:"carbs_g"`
	FatG          float64  `json:"fat_g"`
	MealPlan      string   `json:"meal_plan"`
	MealSections  string   `json:"meal_sections"`
	Tags          []string `json:"tags"`
}

type UpdateDietTemplateRequest struct {
	Name          string   `json:"name"`
	Category      string   `json:"category"`
	Description   string   `json:"description"`
	TotalCalories *int     `json:"total_calories"`
	ProteinG      *float64 `json:"protein_g"`
	CarbsG        *float64 `json:"carbs_g"`
	FatG          *float64 `json:"fat_g"`
	MealPlan      string   `json:"meal_plan"`
	MealSections  string   `json:"meal_sections"`
	Tags          []string `json:"tags"`
	IsActive      *bool    `json:"is_active"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type DietTemplateService interface {
	Create(req CreateDietTemplateRequest, createdByID uint) (*models.DietTemplate, error)
	GetByID(id uint) (*models.DietTemplate, error)
	List(req utils.PageRequest, category string, activeOnly bool) ([]*models.DietTemplate, int64, error)
	Update(id uint, req UpdateDietTemplateRequest) (*models.DietTemplate, error)
	Delete(id uint) error
	SeedDefaults() error // seeds 4 default templates if none exist
}

type dietTemplateService struct {
	repo   repositories.DietTemplateRepository
	logger *slog.Logger
}

func NewDietTemplateService(
	repo repositories.DietTemplateRepository,
	logger *slog.Logger,
) DietTemplateService {
	return &dietTemplateService{
		repo:   repo,
		logger: logger,
	}
}

func (s *dietTemplateService) Create(req CreateDietTemplateRequest, createdByID uint) (*models.DietTemplate, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.Category == "" {
		return nil, apperrors.ErrValidation("category is required")
	}

	t := &models.DietTemplate{
		FacilityID:    req.FacilityID,
		Name:          req.Name,
		Category:      req.Category,
		Description:   req.Description,
		TotalCalories: req.TotalCalories,
		ProteinG:      req.ProteinG,
		CarbsG:        req.CarbsG,
		FatG:          req.FatG,
		MealPlan:      req.MealPlan,
		MealSections:  req.MealSections,
		Tags:          models.StringSlice(req.Tags),
		IsActive:      true,
		CreatedByID:   &createdByID,
	}

	if err := s.repo.Create(t); err != nil {
		s.logger.Error("create diet template failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return t, nil
}

func (s *dietTemplateService) GetByID(id uint) (*models.DietTemplate, error) {
	t, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if t == nil {
		return nil, apperrors.New(http.StatusNotFound, "DT_001", "Diet template not found", "")
	}
	return t, nil
}

func (s *dietTemplateService) List(req utils.PageRequest, category string, activeOnly bool) ([]*models.DietTemplate, int64, error) {
	return s.repo.List(req, category, activeOnly)
}

func (s *dietTemplateService) Update(id uint, req UpdateDietTemplateRequest) (*models.DietTemplate, error) {
	t, err := s.repo.FindByID(id)
	if err != nil || t == nil {
		return nil, apperrors.New(http.StatusNotFound, "DT_001", "Diet template not found", "")
	}

	if req.Name != "" {
		t.Name = req.Name
	}
	if req.Category != "" {
		t.Category = req.Category
	}
	if req.Description != "" {
		t.Description = req.Description
	}
	if req.TotalCalories != nil {
		t.TotalCalories = *req.TotalCalories
	}
	if req.ProteinG != nil {
		t.ProteinG = *req.ProteinG
	}
	if req.CarbsG != nil {
		t.CarbsG = *req.CarbsG
	}
	if req.FatG != nil {
		t.FatG = *req.FatG
	}
	if req.MealPlan != "" {
		t.MealPlan = req.MealPlan
	}
	if req.MealSections != "" {
		t.MealSections = req.MealSections
	}
	if req.Tags != nil {
		t.Tags = models.StringSlice(req.Tags)
	}
	if req.IsActive != nil {
		t.IsActive = *req.IsActive
	}

	if err := s.repo.Update(t); err != nil {
		s.logger.Error("update diet template failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return t, nil
}

func (s *dietTemplateService) Delete(id uint) error {
	t, err := s.repo.FindByID(id)
	if err != nil || t == nil {
		return apperrors.New(http.StatusNotFound, "DT_001", "Diet template not found", "")
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete diet template failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}

func (s *dietTemplateService) SeedDefaults() error {
	count, err := s.repo.CountAll()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	defaults := []*models.DietTemplate{
		{
			Name:          "Weight Loss Starter",
			Category:      "weight_loss",
			Description:   "A calorie-controlled plan focused on high protein and moderate carbs to support fat loss.",
			TotalCalories: 1500,
			ProteinG:      140,
			CarbsG:        100,
			FatG:          55,
			MealPlan:      "Breakfast: 2 boiled eggs + 1 cup oats + black coffee. Mid-Morning: Apple + 10 almonds. Lunch: 150g grilled chicken breast + 1 cup brown rice + steamed broccoli. Afternoon: Low-fat Greek yogurt + berries. Dinner: 150g baked salmon + large green salad with olive oil dressing. Evening: 1 scoop whey protein in water.",
			Tags:          models.StringSlice{"weight_loss", "high_protein", "low_carb"},
			IsDefault:     true,
			IsActive:      true,
		},
		{
			Name:          "Muscle Gain Pro",
			Category:      "muscle_gain",
			Description:   "A high-calorie, high-protein plan designed to support muscle hypertrophy and recovery.",
			TotalCalories: 3200,
			ProteinG:      200,
			CarbsG:        380,
			FatG:          80,
			MealPlan:      "Pre-Workout (6am): 1 cup oats + 2 scoops protein + banana. Breakfast (8am): 4 whole eggs + 4 egg whites scrambled + 2 slices whole grain toast. Mid-Morning: 200g cottage cheese + fruit. Lunch: 200g lean beef or chicken + 2 cups rice + vegetables. Pre-Workout Snack: Rice cakes + peanut butter. Post-Workout: Protein shake + fast carbs. Dinner: 200g salmon or turkey + sweet potato + greens. Before Bed: Casein protein or cottage cheese.",
			Tags:          models.StringSlice{"muscle_gain", "bulking", "high_calorie", "high_protein"},
			IsDefault:     true,
			IsActive:      true,
		},
		{
			Name:          "Balanced Vegetarian",
			Category:      "vegetarian",
			Description:   "A balanced plant-based plan providing complete nutrition through food combining.",
			TotalCalories: 2000,
			ProteinG:      90,
			CarbsG:        260,
			FatG:          65,
			MealPlan:      "Breakfast: Tofu scramble with spinach and tomatoes + whole grain toast. Snack: Handful of mixed nuts + fruit. Lunch: Lentil soup or dal + brown rice + side salad. Snack: Hummus with veggie sticks. Dinner: Chickpea curry or black bean tacos + quinoa. Evening: Warm milk or plant protein shake. Focus: Complete proteins via food combining (legumes + grains), B12 supplementation recommended.",
			Tags:          models.StringSlice{"vegetarian", "plant_based", "balanced", "maintenance"},
			IsDefault:     true,
			IsActive:      true,
		},
		{
			Name:          "Keto Shred",
			Category:      "keto",
			Description:   "A ketogenic plan with very low carbs and high fat to enter and maintain ketosis for fat loss.",
			TotalCalories: 1800,
			ProteinG:      150,
			CarbsG:        25,
			FatG:          130,
			MealPlan:      "Breakfast: 3 whole eggs fried in butter + bacon + avocado. Snack: Cheese cubes + macadamia nuts. Lunch: Large Caesar salad with grilled chicken + olive oil dressing, no croutons. Snack: 2 tbsp almond butter + celery. Dinner: 200g ribeye steak + roasted asparagus in butter + side salad. Evening: Fat bombs (coconut oil + cocoa + almond butter). Note: Keep net carbs under 25g. Enter ketosis in 3-5 days.",
			Tags:          models.StringSlice{"keto", "fat_loss", "low_carb", "high_fat"},
			IsDefault:     true,
			IsActive:      true,
		},
	}

	for _, t := range defaults {
		if err := s.repo.Create(t); err != nil {
			s.logger.Error("seed diet template failed", "name", t.Name, "err", err)
			return apperrors.ErrInternal
		}
	}

	s.logger.Info("seeded default diet templates", "count", len(defaults))
	return nil
}
