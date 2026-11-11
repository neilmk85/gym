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

type CreateEnquiryRequest struct {
	FacilityID   uint   `json:"facility_id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Phone        string `json:"phone"`
	Source       string `json:"source"`
	PlanInterest string `json:"plan_interest"`
	Notes        string `json:"notes"`
	FollowUpDate string `json:"follow_up_date"` // "YYYY-MM-DD" or ""
	AssignedToID *uint  `json:"assigned_to_id"`
}

type UpdateEnquiryRequest struct {
	Name         *string `json:"name"`
	Email        *string `json:"email"`
	Phone        *string `json:"phone"`
	Source       *string `json:"source"`
	PlanInterest *string `json:"plan_interest"`
	Status       *string `json:"status"`
	Notes        *string `json:"notes"`
	FollowUpDate *string `json:"follow_up_date"` // "YYYY-MM-DD" or "clear"
	AssignedToID *uint   `json:"assigned_to_id"`
	ConvertedMemberID *uint `json:"converted_member_id"`
}

// ─── Service interface ────────────────────────────────────────────────────────

type EnquiryService interface {
	Create(req CreateEnquiryRequest, createdByID uint) (*models.Enquiry, error)
	GetByID(id uint) (*models.Enquiry, error)
	List(req utils.PageRequest, facilityID *uint, status string, search string) ([]*models.Enquiry, int64, error)
	Update(id uint, req UpdateEnquiryRequest) (*models.Enquiry, error)
	Delete(id uint) error
}

// ─── Implementation ───────────────────────────────────────────────────────────

type enquiryService struct {
	enquiryRepo repositories.EnquiryRepository
	logger      *slog.Logger
}

func NewEnquiryService(enquiryRepo repositories.EnquiryRepository, logger *slog.Logger) EnquiryService {
	return &enquiryService{enquiryRepo: enquiryRepo, logger: logger}
}

func (s *enquiryService) Create(req CreateEnquiryRequest, createdByID uint) (*models.Enquiry, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.Phone == "" {
		return nil, apperrors.ErrValidation("phone is required")
	}

	source := req.Source
	if source == "" {
		source = models.EnquirySourceWalkIn
	}

	e := &models.Enquiry{
		FacilityID:   req.FacilityID,
		Name:         req.Name,
		Email:        req.Email,
		Phone:        req.Phone,
		Source:       source,
		PlanInterest: req.PlanInterest,
		Status:       models.EnquiryStatusNew,
		Notes:        req.Notes,
		AssignedToID: req.AssignedToID,
		CreatedByID:  &createdByID,
	}

	if req.FollowUpDate != "" {
		t, err := time.Parse("2006-01-02", req.FollowUpDate)
		if err != nil {
			return nil, apperrors.ErrValidation("follow_up_date must be in YYYY-MM-DD format")
		}
		e.FollowUpDate = &t
	}

	if err := s.enquiryRepo.Create(e); err != nil {
		s.logger.Error("create enquiry failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return e, nil
}

func (s *enquiryService) GetByID(id uint) (*models.Enquiry, error) {
	e, err := s.enquiryRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if e == nil {
		return nil, apperrors.New(http.StatusNotFound, "ENQ_001", "Enquiry not found", "")
	}
	return e, nil
}

func (s *enquiryService) List(req utils.PageRequest, facilityID *uint, status string, search string) ([]*models.Enquiry, int64, error) {
	return s.enquiryRepo.List(req, facilityID, status, search)
}

func (s *enquiryService) Update(id uint, req UpdateEnquiryRequest) (*models.Enquiry, error) {
	e, err := s.enquiryRepo.FindByID(id)
	if err != nil || e == nil {
		return nil, apperrors.New(http.StatusNotFound, "ENQ_001", "Enquiry not found", "")
	}

	if req.Name != nil {
		e.Name = *req.Name
	}
	if req.Email != nil {
		e.Email = *req.Email
	}
	if req.Phone != nil {
		e.Phone = *req.Phone
	}
	if req.Source != nil {
		e.Source = *req.Source
	}
	if req.PlanInterest != nil {
		e.PlanInterest = *req.PlanInterest
	}
	if req.Status != nil {
		e.Status = *req.Status
	}
	if req.Notes != nil {
		e.Notes = *req.Notes
	}
	if req.AssignedToID != nil {
		e.AssignedToID = req.AssignedToID
	}
	if req.ConvertedMemberID != nil {
		e.ConvertedMemberID = req.ConvertedMemberID
	}
	if req.FollowUpDate != nil {
		if *req.FollowUpDate == "clear" {
			e.FollowUpDate = nil
		} else {
			t, err := time.Parse("2006-01-02", *req.FollowUpDate)
			if err != nil {
				return nil, apperrors.ErrValidation("follow_up_date must be in YYYY-MM-DD format")
			}
			e.FollowUpDate = &t
		}
	}

	if err := s.enquiryRepo.Update(e); err != nil {
		s.logger.Error("update enquiry failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	// Reload with associations
	return s.enquiryRepo.FindByID(id)
}

func (s *enquiryService) Delete(id uint) error {
	if err := s.enquiryRepo.Delete(id); err != nil {
		s.logger.Error("delete enquiry failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}
