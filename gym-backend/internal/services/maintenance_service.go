package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ─────────────────────────────────────────────────────────────────────

type CreateMaintenanceRequest struct {
	FacilityID   uint    `json:"facility_id"`
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	Category     string  `json:"category"`
	Priority     string  `json:"priority"`
	AssignedTo   string  `json:"assigned_to"`
	EstimateCost float64 `json:"estimate_cost"`
	ScheduledAt  string  `json:"scheduled_at"` // RFC3339 or empty
	Notes        string  `json:"notes"`
}

type UpdateMaintenanceRequest struct {
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Category     string   `json:"category"`
	Priority     string   `json:"priority"`
	Status       string   `json:"status"`
	AssignedTo   string   `json:"assigned_to"`
	EstimateCost *float64 `json:"estimate_cost"`
	ActualCost   *float64 `json:"actual_cost"`
	ScheduledAt  string   `json:"scheduled_at"`
	Notes        string   `json:"notes"`
}

// ─── Interface ────────────────────────────────────────────────────────────────

type MaintenanceService interface {
	Create(req CreateMaintenanceRequest, createdByID uint) (*models.MaintenanceTask, error)
	GetByID(id uint) (*models.MaintenanceTask, error)
	List(req utils.PageRequest, facilityID uint, status, category, priority string) ([]*models.MaintenanceTask, int64, error)
	Update(id uint, req UpdateMaintenanceRequest) (*models.MaintenanceTask, error)
	Delete(id uint) error
}

// ─── Implementation ───────────────────────────────────────────────────────────

type maintenanceService struct {
	repo   repositories.MaintenanceRepository
	logger *slog.Logger
}

func NewMaintenanceService(repo repositories.MaintenanceRepository, logger *slog.Logger) MaintenanceService {
	return &maintenanceService{repo: repo, logger: logger}
}

func (s *maintenanceService) Create(req CreateMaintenanceRequest, createdByID uint) (*models.MaintenanceTask, error) {
	if req.Title == "" {
		return nil, apperrors.ErrValidation("title is required")
	}

	cat := req.Category
	if cat == "" {
		cat = models.MaintenanceCategoryOther
	}
	pri := req.Priority
	if pri == "" {
		pri = models.MaintenancePriorityMedium
	}

	t := &models.MaintenanceTask{
		FacilityID:   req.FacilityID,
		Title:        req.Title,
		Description:  req.Description,
		Category:     cat,
		Priority:     pri,
		Status:       models.MaintenanceStatusPending,
		AssignedTo:   req.AssignedTo,
		EstimateCost: req.EstimateCost,
		Notes:        req.Notes,
		CreatedByID:  &createdByID,
	}
	if req.ScheduledAt != "" {
		parsed, err := time.Parse(time.RFC3339, req.ScheduledAt)
		if err == nil {
			t.ScheduledAt = &parsed
		}
	}

	if err := s.repo.Create(t); err != nil {
		s.logger.Error("create maintenance task failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return t, nil
}

func (s *maintenanceService) GetByID(id uint) (*models.MaintenanceTask, error) {
	t, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if t == nil {
		return nil, apperrors.New(http.StatusNotFound, "MAINT_001", "Maintenance task not found", "")
	}
	return t, nil
}

func (s *maintenanceService) List(req utils.PageRequest, facilityID uint, status, category, priority string) ([]*models.MaintenanceTask, int64, error) {
	return s.repo.List(req, facilityID, status, category, priority)
}

func (s *maintenanceService) Update(id uint, req UpdateMaintenanceRequest) (*models.MaintenanceTask, error) {
	t, err := s.repo.FindByID(id)
	if err != nil || t == nil {
		return nil, apperrors.New(http.StatusNotFound, "MAINT_001", "Maintenance task not found", "")
	}

	if req.Title != "" {
		t.Title = req.Title
	}
	if req.Description != "" {
		t.Description = req.Description
	}
	if req.Category != "" {
		t.Category = req.Category
	}
	if req.Priority != "" {
		t.Priority = req.Priority
	}
	if req.AssignedTo != "" {
		t.AssignedTo = req.AssignedTo
	}
	if req.Notes != "" {
		t.Notes = req.Notes
	}
	if req.EstimateCost != nil {
		t.EstimateCost = *req.EstimateCost
	}
	if req.ActualCost != nil {
		t.ActualCost = *req.ActualCost
	}
	if req.ScheduledAt != "" {
		parsed, err := time.Parse(time.RFC3339, req.ScheduledAt)
		if err == nil {
			t.ScheduledAt = &parsed
		}
	}
	if req.Status != "" {
		old := t.Status
		t.Status = req.Status
		if req.Status == models.MaintenanceStatusDone && old != models.MaintenanceStatusDone {
			now := time.Now()
			t.CompletedAt = &now
		}
	}

	if err := s.repo.Update(t); err != nil {
		s.logger.Error("update maintenance task failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return t, nil
}

func (s *maintenanceService) Delete(id uint) error {
	t, err := s.repo.FindByID(id)
	if err != nil || t == nil {
		return apperrors.New(http.StatusNotFound, "MAINT_001", "Maintenance task not found", "")
	}
	return s.repo.Delete(id)
}
