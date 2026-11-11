package services

import (
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── Locker Service ───────────────────────────────────────────────────────────

type LockerService interface {
	CreateLocker(req CreateLockerRequest) (*models.Locker, error)
	ListLockers(status string) ([]*models.Locker, error)
	GetLocker(id uint) (*models.Locker, error)
	UpdateLocker(id uint, req UpdateLockerRequest) (*models.Locker, error)
	DeleteLocker(id uint) error

	AllocateLocker(req AllocateLockerRequest) (*models.LockerAllotment, error)
	ListActiveAllotments() ([]*models.LockerAllotment, error)
	ListAllotmentsByMember(memberID uint) ([]*models.LockerAllotment, error)
	GetAllotment(id uint) (*models.LockerAllotment, error)
	MarkFeePaid(id uint) (*models.LockerAllotment, error)
	ReleaseLocker(id uint) (*models.LockerAllotment, error)
}

type CreateLockerRequest struct {
	Number   string `json:"number"`
	Location string `json:"location"`
	Notes    string `json:"notes"`
}

type UpdateLockerRequest struct {
	Number   string `json:"number"`
	Location string `json:"location"`
	Status   string `json:"status"`
	Notes    string `json:"notes"`
}

type AllocateLockerRequest struct {
	LockerID  uint    `json:"locker_id"`
	MemberID  uint    `json:"member_id"`
	StartDate string  `json:"start_date"` // YYYY-MM-DD
	EndDate   string  `json:"end_date"`   // YYYY-MM-DD
	FeeAmount float64 `json:"fee_amount"`
	Notes     string  `json:"notes"`
}

type lockerService struct {
	lockerRepo     repositories.LockerRepository
	allotmentRepo  repositories.LockerAllotmentRepository
}

func NewLockerService(lr repositories.LockerRepository, ar repositories.LockerAllotmentRepository) LockerService {
	return &lockerService{lockerRepo: lr, allotmentRepo: ar}
}

func (s *lockerService) CreateLocker(req CreateLockerRequest) (*models.Locker, error) {
	if req.Number == "" {
		return nil, apperrors.ErrValidation("locker number is required")
	}
	l := &models.Locker{
		Number:   req.Number,
		Location: req.Location,
		Status:   models.LockerStatusAvailable,
		Notes:    req.Notes,
	}
	if err := s.lockerRepo.Create(l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *lockerService) ListLockers(status string) ([]*models.Locker, error) {
	return s.lockerRepo.List(status)
}

func (s *lockerService) GetLocker(id uint) (*models.Locker, error) {
	l, err := s.lockerRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if l == nil {
		return nil, apperrors.New(http.StatusNotFound, "LKR_001", "locker not found", "")
	}
	return l, nil
}

func (s *lockerService) UpdateLocker(id uint, req UpdateLockerRequest) (*models.Locker, error) {
	l, err := s.GetLocker(id)
	if err != nil {
		return nil, err
	}
	if req.Number != "" {
		l.Number = req.Number
	}
	if req.Location != "" {
		l.Location = req.Location
	}
	if req.Status != "" {
		l.Status = req.Status
	}
	l.Notes = req.Notes
	if err := s.lockerRepo.Update(l); err != nil {
		return nil, err
	}
	return l, nil
}

func (s *lockerService) DeleteLocker(id uint) error {
	active, err := s.allotmentRepo.HasActiveAllotment(id)
	if err != nil {
		return err
	}
	if active {
		return apperrors.ErrValidation("cannot delete a locker with an active allotment")
	}
	return s.lockerRepo.Delete(id)
}

func (s *lockerService) AllocateLocker(req AllocateLockerRequest) (*models.LockerAllotment, error) {
	if req.LockerID == 0 {
		return nil, apperrors.ErrValidation("locker_id is required")
	}
	if req.MemberID == 0 {
		return nil, apperrors.ErrValidation("member_id is required")
	}
	if req.StartDate == "" || req.EndDate == "" {
		return nil, apperrors.ErrValidation("start_date and end_date are required")
	}
	if req.FeeAmount < 0 {
		return nil, apperrors.ErrValidation("fee_amount cannot be negative")
	}

	start, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid start_date, use YYYY-MM-DD")
	}
	end, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid end_date, use YYYY-MM-DD")
	}
	if !end.After(start) {
		return nil, apperrors.ErrValidation("end_date must be after start_date")
	}

	// Check locker exists
	locker, err := s.GetLocker(req.LockerID)
	if err != nil {
		return nil, err
	}
	if locker.Status == models.LockerStatusMaintenance {
		return nil, apperrors.ErrValidation("locker is under maintenance")
	}

	// Check not already allotted
	active, err := s.allotmentRepo.HasActiveAllotment(req.LockerID)
	if err != nil {
		return nil, err
	}
	if active {
		return nil, apperrors.ErrValidation("locker is already allotted to another member")
	}

	a := &models.LockerAllotment{
		LockerID:  req.LockerID,
		MemberID:  req.MemberID,
		StartDate: start,
		EndDate:   end,
		FeeAmount: req.FeeAmount,
		Status:    models.AllotmentStatusActive,
		Notes:     req.Notes,
	}
	if err := s.allotmentRepo.Create(a); err != nil {
		return nil, err
	}

	// Mark locker occupied
	locker.Status = models.LockerStatusOccupied
	_ = s.lockerRepo.Update(locker)

	return a, nil
}

func (s *lockerService) ListActiveAllotments() ([]*models.LockerAllotment, error) {
	// Auto-expire overdue ones first
	_ = s.allotmentRepo.ExpireOverdue()
	return s.allotmentRepo.ListActive()
}

func (s *lockerService) ListAllotmentsByMember(memberID uint) ([]*models.LockerAllotment, error) {
	return s.allotmentRepo.ListByMember(memberID)
}

func (s *lockerService) GetAllotment(id uint) (*models.LockerAllotment, error) {
	a, err := s.allotmentRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, apperrors.New(http.StatusNotFound, "LKR_002", "allotment not found", "")
	}
	return a, nil
}

func (s *lockerService) MarkFeePaid(id uint) (*models.LockerAllotment, error) {
	a, err := s.GetAllotment(id)
	if err != nil {
		return nil, err
	}
	a.FeePaid = true
	if err := s.allotmentRepo.Update(a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *lockerService) ReleaseLocker(id uint) (*models.LockerAllotment, error) {
	a, err := s.GetAllotment(id)
	if err != nil {
		return nil, err
	}
	if a.Status != models.AllotmentStatusActive {
		return nil, apperrors.ErrValidation("allotment is not active")
	}
	now := time.Now()
	a.Status = models.AllotmentStatusReleased
	a.ReleasedAt = &now
	if err := s.allotmentRepo.Update(a); err != nil {
		return nil, err
	}

	// Free up the locker
	locker, err := s.lockerRepo.FindByID(a.LockerID)
	if err == nil && locker != nil {
		locker.Status = models.LockerStatusAvailable
		_ = s.lockerRepo.Update(locker)
	}
	return a, nil
}
