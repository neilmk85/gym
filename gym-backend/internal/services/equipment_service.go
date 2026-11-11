package services

import (
	"log/slog"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

type CreateEquipmentRequest struct {
	Name         string   `json:"name"`
	Brand        string   `json:"brand"`
	Category     string   `json:"category"`
	Quantity     int      `json:"quantity"`
	WeightKg     *float64 `json:"weight_kg"`
	Unit         string   `json:"unit"`
	Condition    string   `json:"condition"`
	Location     string   `json:"location"`
	SerialNumber string   `json:"serial_number"`
	PurchasedAt  string   `json:"purchased_at"`
	Notes        string   `json:"notes"`
}

type UpdateEquipmentRequest struct {
	Name         string   `json:"name"`
	Brand        string   `json:"brand"`
	Category     string   `json:"category"`
	Quantity     *int     `json:"quantity"`
	WeightKg     *float64 `json:"weight_kg"`
	Unit         string   `json:"unit"`
	Condition    string   `json:"condition"`
	Location     string   `json:"location"`
	SerialNumber string   `json:"serial_number"`
	PurchasedAt  string   `json:"purchased_at"`
	Notes        string   `json:"notes"`
}

type EquipmentService interface {
	Create(req CreateEquipmentRequest) (*models.Equipment, error)
	GetByID(id uint) (*models.Equipment, error)
	List(condition, category, search string, page, perPage int) ([]*models.Equipment, int64, error)
	Update(id uint, req UpdateEquipmentRequest) (*models.Equipment, error)
	Delete(id uint) error
}

type equipmentService struct {
	repo   repositories.EquipmentRepository
	logger *slog.Logger
}

func NewEquipmentService(repo repositories.EquipmentRepository, logger *slog.Logger) EquipmentService {
	return &equipmentService{repo: repo, logger: logger}
}

func (s *equipmentService) Create(req CreateEquipmentRequest) (*models.Equipment, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.Brand == "" {
		return nil, apperrors.ErrValidation("brand is required")
	}
	if req.Category == "" {
		return nil, apperrors.ErrValidation("category is required")
	}

	qty := req.Quantity
	if qty < 1 {
		qty = 1
	}
	unit := req.Unit
	if unit == "" {
		unit = "pcs"
	}
	condition := req.Condition
	if condition == "" {
		condition = "good"
	}

	e := &models.Equipment{
		Name:         req.Name,
		Brand:        req.Brand,
		Category:     req.Category,
		Quantity:     qty,
		WeightKg:     req.WeightKg,
		Unit:         unit,
		Condition:    condition,
		Location:     req.Location,
		SerialNumber: req.SerialNumber,
		Notes:        req.Notes,
	}

	if req.PurchasedAt != "" {
		if t, err := time.Parse("2006-01-02", req.PurchasedAt); err == nil {
			e.PurchasedAt = &t
		}
	}

	if err := s.repo.Create(e); err != nil {
		s.logger.Error("create equipment failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return e, nil
}

func (s *equipmentService) GetByID(id uint) (*models.Equipment, error) {
	e, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if e == nil {
		return nil, apperrors.New(404, "EQUIPMENT_NOT_FOUND", "equipment not found", "")
	}
	return e, nil
}

func (s *equipmentService) List(condition, category, search string, page, perPage int) ([]*models.Equipment, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 500 {
		perPage = 25
	}
	list, total, err := s.repo.List(condition, category, search, page, perPage)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	return list, total, nil
}

func (s *equipmentService) Update(id uint, req UpdateEquipmentRequest) (*models.Equipment, error) {
	e, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if e == nil {
		return nil, apperrors.New(404, "EQUIPMENT_NOT_FOUND", "equipment not found", "")
	}

	if req.Name != "" {
		e.Name = req.Name
	}
	if req.Brand != "" {
		e.Brand = req.Brand
	}
	if req.Category != "" {
		e.Category = req.Category
	}
	if req.Quantity != nil {
		e.Quantity = *req.Quantity
	}
	if req.WeightKg != nil {
		e.WeightKg = req.WeightKg
	}
	if req.Unit != "" {
		e.Unit = req.Unit
	}
	if req.Condition != "" {
		e.Condition = req.Condition
	}
	if req.Location != "" {
		e.Location = req.Location
	}
	if req.SerialNumber != "" {
		e.SerialNumber = req.SerialNumber
	}
	if req.PurchasedAt != "" {
		if t, err := time.Parse("2006-01-02", req.PurchasedAt); err == nil {
			e.PurchasedAt = &t
		}
	}
	if req.Notes != "" {
		e.Notes = req.Notes
	}

	if err := s.repo.Update(e); err != nil {
		s.logger.Error("update equipment failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return e, nil
}

func (s *equipmentService) Delete(id uint) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete equipment failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}
