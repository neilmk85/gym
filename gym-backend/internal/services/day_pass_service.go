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

// ─── DTOs ────────────────────────────────────────────────────────────────────

type CreateDayPassRequest struct {
	FacilityID uint    `json:"facility_id"`
	GuestName  string  `json:"guest_name"`
	GuestEmail string  `json:"guest_email"`
	GuestPhone string  `json:"guest_phone"`
	PassDate   string  `json:"pass_date"`   // YYYY-MM-DD
	ValidFrom  string  `json:"valid_from,omitempty"`  // optional override; defaults to pass_date
	ValidUntil string  `json:"valid_until,omitempty"` // optional override; defaults to pass_date
	Price      float64 `json:"price"`
	Notes      string  `json:"notes"`
}

type UpdateDayPassRequest struct {
	GuestName  string   `json:"guest_name"`
	GuestEmail string   `json:"guest_email"`
	GuestPhone string   `json:"guest_phone"`
	Price      *float64 `json:"price"`
	Notes      string   `json:"notes"`
	Status     string   `json:"status"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type DayPassService interface {
	Create(req CreateDayPassRequest, createdByID uint) (*models.DayPass, error)
	GetByID(id uint) (*models.DayPass, error)
	List(req utils.PageRequest, facilityID *uint, status string, dateFrom string, dateTo string) ([]*models.DayPass, int64, error)
	Update(id uint, req UpdateDayPassRequest) (*models.DayPass, error)
	Delete(id uint) error
	CheckIn(id uint) (*models.DayPass, error)
	ExpireOldPasses() error
}

type dayPassService struct {
	repo   repositories.DayPassRepository
	logger *slog.Logger
}

func NewDayPassService(
	repo repositories.DayPassRepository,
	logger *slog.Logger,
) DayPassService {
	return &dayPassService{
		repo:   repo,
		logger: logger,
	}
}

func parseDateFlexible(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}

func (s *dayPassService) Create(req CreateDayPassRequest, createdByID uint) (*models.DayPass, error) {
	if req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("facility_id is required")
	}
	if req.GuestName == "" {
		return nil, apperrors.ErrValidation("guest_name is required")
	}
	if req.PassDate == "" {
		return nil, apperrors.ErrValidation("pass_date is required")
	}
	passDate, err := time.Parse("2006-01-02", req.PassDate)
	if err != nil {
		return nil, apperrors.ErrValidation("pass_date must be in YYYY-MM-DD format")
	}

	// A day pass is valid for exactly one day; derive valid_from/valid_until from pass_date.
	validFrom := passDate
	validUntil := passDate
	if req.ValidFrom != "" {
		if t, err := parseDateFlexible(req.ValidFrom); err == nil {
			validFrom = t
		}
	}
	if req.ValidUntil != "" {
		if t, err := parseDateFlexible(req.ValidUntil); err == nil {
			validUntil = t
		}
	}

	if req.Price < 0 {
		return nil, apperrors.ErrValidation("price cannot be negative")
	}

	p := &models.DayPass{
		FacilityID:  req.FacilityID,
		GuestName:   req.GuestName,
		GuestEmail:  req.GuestEmail,
		GuestPhone:  req.GuestPhone,
		PassDate:    passDate,
		ValidFrom:   validFrom,
		ValidUntil:  validUntil,
		Price:       req.Price,
		Status:      models.DayPassStatusActive,
		Notes:       req.Notes,
		CreatedByID: &createdByID,
	}

	if err := s.repo.Create(p); err != nil {
		s.logger.Error("create day pass failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return p, nil
}

func (s *dayPassService) GetByID(id uint) (*models.DayPass, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if p == nil {
		return nil, apperrors.New(http.StatusNotFound, "DP_001", "Day pass not found", "")
	}
	return p, nil
}

func (s *dayPassService) List(req utils.PageRequest, facilityID *uint, status string, dateFrom string, dateTo string) ([]*models.DayPass, int64, error) {
	return s.repo.List(req, facilityID, status, dateFrom, dateTo)
}

func (s *dayPassService) Update(id uint, req UpdateDayPassRequest) (*models.DayPass, error) {
	p, err := s.repo.FindByID(id)
	if err != nil || p == nil {
		return nil, apperrors.New(http.StatusNotFound, "DP_001", "Day pass not found", "")
	}

	if req.Status != "" {
		switch req.Status {
		case models.DayPassStatusActive, models.DayPassStatusUsed,
			models.DayPassStatusExpired, models.DayPassStatusCancelled:
			// valid
		default:
			return nil, apperrors.ErrValidation("invalid status; allowed values: active, used, expired, cancelled")
		}
		p.Status = req.Status
	}

	if req.GuestName != "" {
		p.GuestName = req.GuestName
	}
	if req.GuestEmail != "" {
		p.GuestEmail = req.GuestEmail
	}
	if req.GuestPhone != "" {
		p.GuestPhone = req.GuestPhone
	}
	if req.Price != nil {
		if *req.Price < 0 {
			return nil, apperrors.ErrValidation("price cannot be negative")
		}
		p.Price = *req.Price
	}
	if req.Notes != "" {
		p.Notes = req.Notes
	}

	if err := s.repo.Update(p); err != nil {
		s.logger.Error("update day pass failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return p, nil
}

func (s *dayPassService) Delete(id uint) error {
	p, err := s.repo.FindByID(id)
	if err != nil || p == nil {
		return apperrors.New(http.StatusNotFound, "DP_001", "Day pass not found", "")
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete day pass failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}

func (s *dayPassService) CheckIn(id uint) (*models.DayPass, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if p == nil {
		return nil, apperrors.New(http.StatusNotFound, "DP_001", "Day pass not found", "")
	}
	if p.Status != models.DayPassStatusActive {
		return nil, apperrors.ErrValidation("day pass is not active; cannot check in")
	}

	now := time.Now()
	p.CheckedInAt = &now
	p.Status = models.DayPassStatusUsed

	if err := s.repo.Update(p); err != nil {
		s.logger.Error("check in day pass failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return p, nil
}

func (s *dayPassService) ExpireOldPasses() error {
	if err := s.repo.ExpireOldPasses(); err != nil {
		s.logger.Error("expire old day passes failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}
