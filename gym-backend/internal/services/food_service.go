package services

import (
	"log/slog"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type CreateFoodRequest struct {
	Name       string  `json:"name"`
	Category   string  `json:"category"`
	Unit       string  `json:"unit"`
	PerUnit    float64 `json:"per_unit"`
	CalPer     float64 `json:"cal_per"`
	ProteinPer float64 `json:"protein_per"`
	CarbsPer   float64 `json:"carbs_per"`
	FatPer     float64 `json:"fat_per"`
	DefaultQty float64 `json:"default_qty"`
}

type UpdateFoodRequest struct {
	Name       string   `json:"name"`
	Category   string   `json:"category"`
	Unit       string   `json:"unit"`
	PerUnit    *float64 `json:"per_unit"`
	CalPer     *float64 `json:"cal_per"`
	ProteinPer *float64 `json:"protein_per"`
	CarbsPer   *float64 `json:"carbs_per"`
	FatPer     *float64 `json:"fat_per"`
	DefaultQty *float64 `json:"default_qty"`
	IsActive   *bool    `json:"is_active"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type BulkImportResult struct {
	Imported int `json:"imported"`
	Skipped  int `json:"skipped"`
	Total    int `json:"total"`
}

type FoodService interface {
	Create(req CreateFoodRequest) (*models.Food, error)
	GetByID(id uint) (*models.Food, error)
	List(search, category string, activeOnly bool) ([]*models.Food, int64, error)
	Update(id uint, req UpdateFoodRequest) (*models.Food, error)
	Delete(id uint) error
	SeedDefaults() error
	BulkImport(reqs []CreateFoodRequest) (*BulkImportResult, error)
}

type foodService struct {
	repo   repositories.FoodRepository
	logger *slog.Logger
}

func NewFoodService(repo repositories.FoodRepository, logger *slog.Logger) FoodService {
	return &foodService{repo: repo, logger: logger}
}

var validFoodUnits = map[string]bool{
	"g":     true,
	"ml":    true,
	"pcs":   true,
	"slice": true,
	"tbsp":  true,
}

func (s *foodService) Create(req CreateFoodRequest) (*models.Food, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.Category == "" {
		return nil, apperrors.ErrValidation("category is required")
	}
	if !validFoodUnits[req.Unit] {
		return nil, apperrors.ErrValidation("unit must be one of: g, ml, pcs, slice, tbsp")
	}
	if req.PerUnit <= 0 {
		return nil, apperrors.ErrValidation("per_unit must be greater than 0")
	}

	f := &models.Food{
		Name:       req.Name,
		Category:   req.Category,
		Unit:       req.Unit,
		PerUnit:    req.PerUnit,
		CalPer:     req.CalPer,
		ProteinPer: req.ProteinPer,
		CarbsPer:   req.CarbsPer,
		FatPer:     req.FatPer,
		DefaultQty: req.DefaultQty,
		IsActive:   true,
	}

	if err := s.repo.Create(f); err != nil {
		s.logger.Error("create food failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return f, nil
}

func (s *foodService) GetByID(id uint) (*models.Food, error) {
	f, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if f == nil {
		return nil, apperrors.New(http.StatusNotFound, "FOOD_001", "Food not found", "")
	}
	return f, nil
}

func (s *foodService) List(search, category string, activeOnly bool) ([]*models.Food, int64, error) {
	return s.repo.List(search, category, activeOnly)
}

func (s *foodService) Update(id uint, req UpdateFoodRequest) (*models.Food, error) {
	f, err := s.repo.FindByID(id)
	if err != nil || f == nil {
		return nil, apperrors.New(http.StatusNotFound, "FOOD_001", "Food not found", "")
	}

	if req.Name != "" {
		f.Name = req.Name
	}
	if req.Category != "" {
		f.Category = req.Category
	}
	if req.Unit != "" {
		if !validFoodUnits[req.Unit] {
			return nil, apperrors.ErrValidation("unit must be one of: g, ml, pcs, slice, tbsp")
		}
		f.Unit = req.Unit
	}
	if req.PerUnit != nil {
		f.PerUnit = *req.PerUnit
	}
	if req.CalPer != nil {
		f.CalPer = *req.CalPer
	}
	if req.ProteinPer != nil {
		f.ProteinPer = *req.ProteinPer
	}
	if req.CarbsPer != nil {
		f.CarbsPer = *req.CarbsPer
	}
	if req.FatPer != nil {
		f.FatPer = *req.FatPer
	}
	if req.DefaultQty != nil {
		f.DefaultQty = *req.DefaultQty
	}
	if req.IsActive != nil {
		f.IsActive = *req.IsActive
	}

	if err := s.repo.Update(f); err != nil {
		s.logger.Error("update food failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return f, nil
}

func (s *foodService) Delete(id uint) error {
	f, err := s.repo.FindByID(id)
	if err != nil || f == nil {
		return apperrors.New(http.StatusNotFound, "FOOD_001", "Food not found", "")
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete food failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}

func (s *foodService) BulkImport(reqs []CreateFoodRequest) (*BulkImportResult, error) {
	if len(reqs) == 0 {
		return &BulkImportResult{}, nil
	}

	foods := make([]*models.Food, 0, len(reqs))
	for _, req := range reqs {
		if req.Name == "" || req.Category == "" || !validFoodUnits[req.Unit] || req.PerUnit <= 0 {
			continue // skip invalid rows silently
		}
		foods = append(foods, &models.Food{
			Name:       req.Name,
			Category:   req.Category,
			Unit:       req.Unit,
			PerUnit:    req.PerUnit,
			CalPer:     req.CalPer,
			ProteinPer: req.ProteinPer,
			CarbsPer:   req.CarbsPer,
			FatPer:     req.FatPer,
			DefaultQty: req.DefaultQty,
			IsActive:   true,
		})
	}

	imported, skipped, err := s.repo.BulkCreate(foods)
	if err != nil {
		s.logger.Error("bulk import foods failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	return &BulkImportResult{
		Imported: imported,
		Skipped:  skipped,
		Total:    len(reqs),
	}, nil
}

func (s *foodService) SeedDefaults() error {
	count, err := s.repo.CountAll()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	defaults := []*models.Food{
		// Beverages
		{Name: "Lemon Water", Category: "beverages", Unit: "ml", PerUnit: 100, CalPer: 2, ProteinPer: 0, CarbsPer: 0.6, FatPer: 0, DefaultQty: 250},
		{Name: "Green Tea", Category: "beverages", Unit: "ml", PerUnit: 100, CalPer: 1, ProteinPer: 0, CarbsPer: 0.2, FatPer: 0, DefaultQty: 200},
		{Name: "Black Coffee", Category: "beverages", Unit: "ml", PerUnit: 100, CalPer: 2, ProteinPer: 0.3, CarbsPer: 0, FatPer: 0, DefaultQty: 200},
		{Name: "Whole Milk", Category: "beverages", Unit: "ml", PerUnit: 100, CalPer: 61, ProteinPer: 3.2, CarbsPer: 4.8, FatPer: 3.3, DefaultQty: 200},
		{Name: "Skimmed Milk", Category: "beverages", Unit: "ml", PerUnit: 100, CalPer: 34, ProteinPer: 3.4, CarbsPer: 5, FatPer: 0.1, DefaultQty: 200},
		{Name: "Coconut Water", Category: "beverages", Unit: "ml", PerUnit: 100, CalPer: 19, ProteinPer: 0.7, CarbsPer: 3.7, FatPer: 0.2, DefaultQty: 200},
		{Name: "Protein Shake", Category: "beverages", Unit: "ml", PerUnit: 100, CalPer: 40, ProteinPer: 8, CarbsPer: 3, FatPer: 0.5, DefaultQty: 300},
		// Fruits
		{Name: "Banana", Category: "fruits", Unit: "g", PerUnit: 100, CalPer: 89, ProteinPer: 1.1, CarbsPer: 23, FatPer: 0.3, DefaultQty: 120},
		{Name: "Apple", Category: "fruits", Unit: "g", PerUnit: 100, CalPer: 52, ProteinPer: 0.3, CarbsPer: 14, FatPer: 0.2, DefaultQty: 150},
		{Name: "Mango", Category: "fruits", Unit: "g", PerUnit: 100, CalPer: 60, ProteinPer: 0.8, CarbsPer: 15, FatPer: 0.4, DefaultQty: 150},
		{Name: "Papaya", Category: "fruits", Unit: "g", PerUnit: 100, CalPer: 43, ProteinPer: 0.5, CarbsPer: 11, FatPer: 0.3, DefaultQty: 150},
		{Name: "Orange", Category: "fruits", Unit: "g", PerUnit: 100, CalPer: 47, ProteinPer: 0.9, CarbsPer: 12, FatPer: 0.1, DefaultQty: 150},
		{Name: "Pomegranate", Category: "fruits", Unit: "g", PerUnit: 100, CalPer: 83, ProteinPer: 1.7, CarbsPer: 19, FatPer: 1.2, DefaultQty: 100},
		{Name: "Watermelon", Category: "fruits", Unit: "g", PerUnit: 100, CalPer: 30, ProteinPer: 0.6, CarbsPer: 7.6, FatPer: 0.2, DefaultQty: 200},
		// Nuts & Seeds
		{Name: "Almonds", Category: "nuts", Unit: "g", PerUnit: 100, CalPer: 579, ProteinPer: 21, CarbsPer: 22, FatPer: 50, DefaultQty: 25},
		{Name: "Walnuts", Category: "nuts", Unit: "g", PerUnit: 100, CalPer: 654, ProteinPer: 15, CarbsPer: 14, FatPer: 65, DefaultQty: 20},
		{Name: "Peanuts", Category: "nuts", Unit: "g", PerUnit: 100, CalPer: 567, ProteinPer: 26, CarbsPer: 16, FatPer: 49, DefaultQty: 30},
		{Name: "Chia Seeds", Category: "nuts", Unit: "g", PerUnit: 100, CalPer: 486, ProteinPer: 17, CarbsPer: 42, FatPer: 31, DefaultQty: 15},
		{Name: "Flaxseeds", Category: "nuts", Unit: "g", PerUnit: 100, CalPer: 534, ProteinPer: 18, CarbsPer: 29, FatPer: 42, DefaultQty: 10},
		{Name: "Cashews", Category: "nuts", Unit: "g", PerUnit: 100, CalPer: 553, ProteinPer: 18, CarbsPer: 30, FatPer: 44, DefaultQty: 25},
		{Name: "Pumpkin Seeds", Category: "nuts", Unit: "g", PerUnit: 100, CalPer: 559, ProteinPer: 30, CarbsPer: 11, FatPer: 49, DefaultQty: 20},
		// Dairy & Eggs
		{Name: "Whole Egg", Category: "dairy", Unit: "pcs", PerUnit: 1, CalPer: 78, ProteinPer: 6, CarbsPer: 0.6, FatPer: 5, DefaultQty: 2},
		{Name: "Egg White", Category: "dairy", Unit: "pcs", PerUnit: 1, CalPer: 17, ProteinPer: 3.6, CarbsPer: 0.2, FatPer: 0.1, DefaultQty: 4},
		{Name: "Paneer", Category: "dairy", Unit: "g", PerUnit: 100, CalPer: 265, ProteinPer: 18, CarbsPer: 1.2, FatPer: 21, DefaultQty: 100},
		{Name: "Greek Yogurt", Category: "dairy", Unit: "g", PerUnit: 100, CalPer: 59, ProteinPer: 10, CarbsPer: 3.6, FatPer: 0.4, DefaultQty: 150},
		{Name: "Curd (Dahi)", Category: "dairy", Unit: "g", PerUnit: 100, CalPer: 61, ProteinPer: 3.5, CarbsPer: 4.7, FatPer: 3.3, DefaultQty: 150},
		// Grains
		{Name: "Oats", Category: "grains", Unit: "g", PerUnit: 100, CalPer: 389, ProteinPer: 17, CarbsPer: 66, FatPer: 7, DefaultQty: 80},
		{Name: "White Rice (cooked)", Category: "grains", Unit: "g", PerUnit: 100, CalPer: 130, ProteinPer: 2.7, CarbsPer: 28, FatPer: 0.3, DefaultQty: 150},
		{Name: "Brown Rice (cooked)", Category: "grains", Unit: "g", PerUnit: 100, CalPer: 123, ProteinPer: 2.7, CarbsPer: 26, FatPer: 1, DefaultQty: 150},
		{Name: "Roti / Chapati", Category: "grains", Unit: "pcs", PerUnit: 1, CalPer: 120, ProteinPer: 4, CarbsPer: 23, FatPer: 1.5, DefaultQty: 2},
		{Name: "Brown Bread", Category: "grains", Unit: "slice", PerUnit: 1, CalPer: 70, ProteinPer: 3, CarbsPer: 13, FatPer: 1, DefaultQty: 2},
		{Name: "Poha (cooked)", Category: "grains", Unit: "g", PerUnit: 100, CalPer: 110, ProteinPer: 2.2, CarbsPer: 23, FatPer: 1.2, DefaultQty: 150},
		{Name: "Upma", Category: "grains", Unit: "g", PerUnit: 100, CalPer: 107, ProteinPer: 3, CarbsPer: 18, FatPer: 3, DefaultQty: 150},
		{Name: "Idli", Category: "grains", Unit: "pcs", PerUnit: 1, CalPer: 39, ProteinPer: 1.5, CarbsPer: 7, FatPer: 0.4, DefaultQty: 3},
		{Name: "Dosa", Category: "grains", Unit: "pcs", PerUnit: 1, CalPer: 134, ProteinPer: 3, CarbsPer: 21, FatPer: 4.5, DefaultQty: 2},
		{Name: "Quinoa (cooked)", Category: "grains", Unit: "g", PerUnit: 100, CalPer: 120, ProteinPer: 4.4, CarbsPer: 21, FatPer: 1.9, DefaultQty: 150},
		{Name: "Muesli", Category: "grains", Unit: "g", PerUnit: 100, CalPer: 363, ProteinPer: 9, CarbsPer: 68, FatPer: 6, DefaultQty: 60},
		// Protein - Non Veg
		{Name: "Chicken Breast (cooked)", Category: "protein", Unit: "g", PerUnit: 100, CalPer: 165, ProteinPer: 31, CarbsPer: 0, FatPer: 3.6, DefaultQty: 150},
		{Name: "Tuna (canned)", Category: "protein", Unit: "g", PerUnit: 100, CalPer: 116, ProteinPer: 26, CarbsPer: 0, FatPer: 1, DefaultQty: 100},
		{Name: "Salmon (cooked)", Category: "protein", Unit: "g", PerUnit: 100, CalPer: 208, ProteinPer: 20, CarbsPer: 0, FatPer: 13, DefaultQty: 150},
		{Name: "Fish - Rohu (cooked)", Category: "protein", Unit: "g", PerUnit: 100, CalPer: 97, ProteinPer: 16, CarbsPer: 0, FatPer: 3.4, DefaultQty: 150},
		// Pulses
		{Name: "Moong Dal (cooked)", Category: "pulses", Unit: "g", PerUnit: 100, CalPer: 105, ProteinPer: 7, CarbsPer: 19, FatPer: 0.4, DefaultQty: 150},
		{Name: "Chana Dal (cooked)", Category: "pulses", Unit: "g", PerUnit: 100, CalPer: 164, ProteinPer: 9, CarbsPer: 27, FatPer: 2.7, DefaultQty: 150},
		{Name: "Masoor Dal (cooked)", Category: "pulses", Unit: "g", PerUnit: 100, CalPer: 116, ProteinPer: 9, CarbsPer: 20, FatPer: 0.4, DefaultQty: 150},
		{Name: "Rajma (cooked)", Category: "pulses", Unit: "g", PerUnit: 100, CalPer: 127, ProteinPer: 9, CarbsPer: 23, FatPer: 0.5, DefaultQty: 150},
		{Name: "Chickpeas (cooked)", Category: "pulses", Unit: "g", PerUnit: 100, CalPer: 164, ProteinPer: 9, CarbsPer: 27, FatPer: 2.6, DefaultQty: 150},
		{Name: "Mixed Sprouts", Category: "pulses", Unit: "g", PerUnit: 100, CalPer: 30, ProteinPer: 3, CarbsPer: 6, FatPer: 0.2, DefaultQty: 100},
		// Snacks & Others
		{Name: "Peanut Butter", Category: "snacks", Unit: "tbsp", PerUnit: 1, CalPer: 88, ProteinPer: 3.7, CarbsPer: 3, FatPer: 7.5, DefaultQty: 2},
		{Name: "Honey", Category: "snacks", Unit: "tbsp", PerUnit: 1, CalPer: 64, ProteinPer: 0.1, CarbsPer: 17, FatPer: 0, DefaultQty: 1},
		{Name: "Roasted Chana", Category: "snacks", Unit: "g", PerUnit: 100, CalPer: 364, ProteinPer: 22, CarbsPer: 52, FatPer: 6, DefaultQty: 50},
		{Name: "Makhana (Fox Nuts)", Category: "snacks", Unit: "g", PerUnit: 100, CalPer: 347, ProteinPer: 9.7, CarbsPer: 76, FatPer: 0.1, DefaultQty: 30},
		{Name: "Protein Bar", Category: "snacks", Unit: "pcs", PerUnit: 1, CalPer: 200, ProteinPer: 20, CarbsPer: 22, FatPer: 7, DefaultQty: 1},
		{Name: "Sweet Potato (cooked)", Category: "snacks", Unit: "g", PerUnit: 100, CalPer: 86, ProteinPer: 1.6, CarbsPer: 20, FatPer: 0.1, DefaultQty: 150},
		// Supplements
		{Name: "Whey Protein Powder", Category: "supplements", Unit: "g", PerUnit: 100, CalPer: 370, ProteinPer: 75, CarbsPer: 10, FatPer: 4, DefaultQty: 30},
	}

	for _, f := range defaults {
		f.IsActive = true
		if err := s.repo.Create(f); err != nil {
			s.logger.Error("seed food failed", "name", f.Name, "err", err)
			return apperrors.ErrInternal
		}
	}

	s.logger.Info("seeded default foods", "count", len(defaults))
	return nil
}
