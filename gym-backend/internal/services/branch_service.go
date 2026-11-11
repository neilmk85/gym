package services

import (
	"log/slog"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

type BranchService interface {
	CreateBranch(req CreateBranchRequest) (*models.Branch, error)
	GetBranch(id uint) (*models.Branch, error)
	ListBranches() ([]*models.Branch, error)
	UpdateBranch(id uint, req UpdateBranchRequest) (*models.Branch, error)
	DeleteBranch(id uint) error
}

type CreateBranchRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	City    string `json:"city"`
	State   string `json:"state"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
}

type UpdateBranchRequest struct {
	Name    *string `json:"name"`
	Address *string `json:"address"`
	City    *string `json:"city"`
	State   *string `json:"state"`
	Phone   *string `json:"phone"`
	Email   *string `json:"email"`
}

type branchService struct {
	repo   repositories.BranchRepository
	logger *slog.Logger
}

func NewBranchService(repo repositories.BranchRepository, logger *slog.Logger) BranchService {
	return &branchService{repo: repo, logger: logger}
}

func (s *branchService) CreateBranch(req CreateBranchRequest) (*models.Branch, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("branch name is required")
	}
	b := &models.Branch{
		Name:     req.Name,
		Address:  req.Address,
		City:     req.City,
		State:    req.State,
		Phone:    req.Phone,
		Email:    req.Email,
		IsActive: true,
	}
	if err := s.repo.Create(b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *branchService) GetBranch(id uint) (*models.Branch, error) {
	b, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if b == nil {
		return nil, apperrors.New(http.StatusNotFound, "BRANCH_001", "branch not found", "")
	}
	return b, nil
}

func (s *branchService) ListBranches() ([]*models.Branch, error) {
	return s.repo.List()
}

func (s *branchService) UpdateBranch(id uint, req UpdateBranchRequest) (*models.Branch, error) {
	b, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if b == nil {
		return nil, apperrors.New(http.StatusNotFound, "BRANCH_001", "branch not found", "")
	}
	if req.Name != nil {
		b.Name = *req.Name
	}
	if req.Address != nil {
		b.Address = *req.Address
	}
	if req.City != nil {
		b.City = *req.City
	}
	if req.State != nil {
		b.State = *req.State
	}
	if req.Phone != nil {
		b.Phone = *req.Phone
	}
	if req.Email != nil {
		b.Email = *req.Email
	}
	if err := s.repo.Update(b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *branchService) DeleteBranch(id uint) error {
	return s.repo.Delete(id)
}
