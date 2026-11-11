package services

import (
	"log/slog"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ─────────────────────────────────────────────────────────────────────

type CreateFacilityRequest struct {
	Name                 string  `json:"name"`
	Address              string  `json:"address"`
	City                 string  `json:"city"`
	State                string  `json:"state"`
	PostalCode           string  `json:"postal_code"`
	Country              string  `json:"country"`
	Phone                string  `json:"phone"`
	Email                string  `json:"email"`
	Latitude             float64 `json:"latitude"`
	Longitude            float64 `json:"longitude"`
	GeofenceRadiusMeters int     `json:"geofence_radius_meters"`
	MaxCapacity          int     `json:"max_capacity"`
	OpeningTime          string  `json:"opening_time"`
	ClosingTime          string  `json:"closing_time"`
}

type UpdateFacilityRequest struct {
	Name                 string  `json:"name"`
	Address              string  `json:"address"`
	City                 string  `json:"city"`
	State                string  `json:"state"`
	PostalCode           string  `json:"postal_code"`
	Country              string  `json:"country"`
	Phone                string  `json:"phone"`
	Email                string  `json:"email"`
	Latitude             *float64 `json:"latitude"`
	Longitude            *float64 `json:"longitude"`
	GeofenceRadiusMeters *int    `json:"geofence_radius_meters"`
	MaxCapacity          *int    `json:"max_capacity"`
	OpeningTime          string  `json:"opening_time"`
	ClosingTime          string  `json:"closing_time"`
}

// ─── Service ──────────────────────────────────────────────────────────────────

type FacilityService interface {
	Create(req CreateFacilityRequest) (*models.Facility, error)
	GetByID(id uint) (*models.Facility, error)
	List(req utils.PageRequest) ([]*models.Facility, int64, error)
	Update(id uint, req UpdateFacilityRequest) (*models.Facility, error)
}

type facilityService struct {
	facilityRepo repositories.FacilityRepository
	logger       *slog.Logger
}

func NewFacilityService(facilityRepo repositories.FacilityRepository, logger *slog.Logger) FacilityService {
	return &facilityService{facilityRepo: facilityRepo, logger: logger}
}

func (s *facilityService) Create(req CreateFacilityRequest) (*models.Facility, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}

	radius := req.GeofenceRadiusMeters
	if radius <= 0 {
		radius = 50
	}
	capacity := req.MaxCapacity
	if capacity <= 0 {
		capacity = 200
	}
	country := req.Country
	if country == "" {
		country = "India"
	}
	openingTime := req.OpeningTime
	if openingTime == "" {
		openingTime = "06:00:00"
	}
	closingTime := req.ClosingTime
	if closingTime == "" {
		closingTime = "22:00:00"
	}

	f := &models.Facility{
		Name:                 req.Name,
		Address:              req.Address,
		City:                 req.City,
		State:                req.State,
		PostalCode:           req.PostalCode,
		Country:              country,
		Phone:                req.Phone,
		Email:                req.Email,
		Latitude:             req.Latitude,
		Longitude:            req.Longitude,
		GeofenceRadiusMeters: radius,
		MaxCapacity:          capacity,
		OpeningTime:          openingTime,
		ClosingTime:          closingTime,
	}

	if err := s.facilityRepo.Create(f); err != nil {
		s.logger.Error("create facility failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return f, nil
}

func (s *facilityService) GetByID(id uint) (*models.Facility, error) {
	f, err := s.facilityRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if f == nil {
		return nil, apperrors.New(http.StatusNotFound, "FAC_001", "Facility not found", "")
	}
	return f, nil
}

func (s *facilityService) List(req utils.PageRequest) ([]*models.Facility, int64, error) {
	facilities, total, err := s.facilityRepo.List(req)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	return facilities, total, nil
}

func (s *facilityService) Update(id uint, req UpdateFacilityRequest) (*models.Facility, error) {
	f, err := s.facilityRepo.FindByID(id)
	if err != nil || f == nil {
		return nil, apperrors.New(http.StatusNotFound, "FAC_001", "Facility not found", "")
	}

	if req.Name != "" {
		f.Name = req.Name
	}
	if req.Address != "" {
		f.Address = req.Address
	}
	if req.City != "" {
		f.City = req.City
	}
	if req.State != "" {
		f.State = req.State
	}
	if req.PostalCode != "" {
		f.PostalCode = req.PostalCode
	}
	if req.Country != "" {
		f.Country = req.Country
	}
	if req.Phone != "" {
		f.Phone = req.Phone
	}
	if req.Email != "" {
		f.Email = req.Email
	}
	if req.Latitude != nil {
		f.Latitude = *req.Latitude
	}
	if req.Longitude != nil {
		f.Longitude = *req.Longitude
	}
	if req.GeofenceRadiusMeters != nil && *req.GeofenceRadiusMeters > 0 {
		f.GeofenceRadiusMeters = *req.GeofenceRadiusMeters
	}
	if req.MaxCapacity != nil && *req.MaxCapacity > 0 {
		f.MaxCapacity = *req.MaxCapacity
	}
	if req.OpeningTime != "" {
		f.OpeningTime = req.OpeningTime
	}
	if req.ClosingTime != "" {
		f.ClosingTime = req.ClosingTime
	}

	if err := s.facilityRepo.Update(f); err != nil {
		s.logger.Error("update facility failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return f, nil
}
