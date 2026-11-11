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

// ─── DTOs — Category ─────────────────────────────────────────────────────────

type CreateExpenseCategoryRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Icon        string `json:"icon"`
}

type UpdateExpenseCategoryRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Icon        string `json:"icon"`
	IsActive    *bool  `json:"is_active"`
}

// ─── DTOs — Expense ───────────────────────────────────────────────────────────

type CreateExpenseRequest struct {
	FacilityID    uint    `json:"facility_id"`
	CategoryID    *uint   `json:"category_id"`
	Title         string  `json:"title"`
	Amount        float64 `json:"amount"`
	ExpenseDate   string  `json:"expense_date"`   // YYYY-MM-DD
	PaymentMethod string  `json:"payment_method"` // cash|card|transfer|other
	Vendor        string  `json:"vendor"`
	ReceiptURL    string  `json:"receipt_url"`
	Notes         string  `json:"notes"`
}

type UpdateExpenseRequest struct {
	CategoryID    *uint    `json:"category_id"`
	Title         string   `json:"title"`
	Amount        *float64 `json:"amount"`
	ExpenseDate   string   `json:"expense_date"`
	PaymentMethod string   `json:"payment_method"`
	Vendor        string   `json:"vendor"`
	ReceiptURL    string   `json:"receipt_url"`
	Notes         string   `json:"notes"`
	Status        string   `json:"status"`
}

// ─── Service interfaces ───────────────────────────────────────────────────────

type ExpenseCategoryService interface {
	Create(req CreateExpenseCategoryRequest, createdByID uint) (*models.ExpenseCategory, error)
	GetByID(id uint) (*models.ExpenseCategory, error)
	List(activeOnly bool) ([]*models.ExpenseCategory, error)
	Update(id uint, req UpdateExpenseCategoryRequest) (*models.ExpenseCategory, error)
	Delete(id uint) error
}

type ExpenseService interface {
	Create(req CreateExpenseRequest, createdByID uint) (*models.Expense, error)
	GetByID(id uint) (*models.Expense, error)
	List(req utils.PageRequest, facilityID *uint, categoryID *uint, status string, dateFrom string, dateTo string) ([]*models.Expense, int64, error)
	Update(id uint, req UpdateExpenseRequest) (*models.Expense, error)
	Delete(id uint) error
}

// ─── Category implementation ──────────────────────────────────────────────────

type expenseCategoryService struct {
	repo   repositories.ExpenseCategoryRepository
	logger *slog.Logger
}

func NewExpenseCategoryService(repo repositories.ExpenseCategoryRepository, logger *slog.Logger) ExpenseCategoryService {
	return &expenseCategoryService{repo: repo, logger: logger}
}

func (s *expenseCategoryService) Create(req CreateExpenseCategoryRequest, createdByID uint) (*models.ExpenseCategory, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}

	color := req.Color
	if color == "" {
		color = "#6366f1"
	}
	icon := req.Icon
	if icon == "" {
		icon = "receipt"
	}

	c := &models.ExpenseCategory{
		Name:        req.Name,
		Description: req.Description,
		Color:       color,
		Icon:        icon,
		IsActive:    true,
		CreatedByID: &createdByID,
	}

	if err := s.repo.Create(c); err != nil {
		s.logger.Error("create expense category failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return c, nil
}

func (s *expenseCategoryService) GetByID(id uint) (*models.ExpenseCategory, error) {
	c, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if c == nil {
		return nil, apperrors.New(http.StatusNotFound, "EXP_CAT_001", "Expense category not found", "")
	}
	return c, nil
}

func (s *expenseCategoryService) List(activeOnly bool) ([]*models.ExpenseCategory, error) {
	return s.repo.List(activeOnly)
}

func (s *expenseCategoryService) Update(id uint, req UpdateExpenseCategoryRequest) (*models.ExpenseCategory, error) {
	c, err := s.repo.FindByID(id)
	if err != nil || c == nil {
		return nil, apperrors.New(http.StatusNotFound, "EXP_CAT_001", "Expense category not found", "")
	}

	if req.Name != "" {
		c.Name = req.Name
	}
	if req.Description != "" {
		c.Description = req.Description
	}
	if req.Color != "" {
		c.Color = req.Color
	}
	if req.Icon != "" {
		c.Icon = req.Icon
	}
	if req.IsActive != nil {
		c.IsActive = *req.IsActive
	}

	if err := s.repo.Update(c); err != nil {
		s.logger.Error("update expense category failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return c, nil
}

func (s *expenseCategoryService) Delete(id uint) error {
	c, err := s.repo.FindByID(id)
	if err != nil || c == nil {
		return apperrors.New(http.StatusNotFound, "EXP_CAT_001", "Expense category not found", "")
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete expense category failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}

// ─── Expense implementation ───────────────────────────────────────────────────

type expenseService struct {
	repo   repositories.ExpenseRepository
	logger *slog.Logger
}

func NewExpenseService(repo repositories.ExpenseRepository, logger *slog.Logger) ExpenseService {
	return &expenseService{repo: repo, logger: logger}
}

var validPaymentMethods = map[string]bool{
	models.ExpensePaymentCash:     true,
	models.ExpensePaymentCard:     true,
	models.ExpensePaymentTransfer: true,
	models.ExpensePaymentOther:    true,
}

func (s *expenseService) Create(req CreateExpenseRequest, createdByID uint) (*models.Expense, error) {
	if req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("facility_id is required")
	}
	if req.Title == "" {
		return nil, apperrors.ErrValidation("title is required")
	}
	if req.Amount < 0 {
		return nil, apperrors.ErrValidation("amount cannot be negative")
	}
	if req.ExpenseDate == "" {
		return nil, apperrors.ErrValidation("expense_date is required")
	}

	expDate, err := time.Parse("2006-01-02", req.ExpenseDate)
	if err != nil {
		return nil, apperrors.ErrValidation("expense_date must be in YYYY-MM-DD format")
	}

	pm := req.PaymentMethod
	if pm == "" {
		pm = models.ExpensePaymentCash
	}
	if !validPaymentMethods[pm] {
		return nil, apperrors.ErrValidation("payment_method must be one of: cash, card, transfer, other")
	}

	e := &models.Expense{
		FacilityID:    req.FacilityID,
		CategoryID:    req.CategoryID,
		Title:         req.Title,
		Amount:        req.Amount,
		ExpenseDate:   expDate,
		PaymentMethod: pm,
		Vendor:        req.Vendor,
		ReceiptURL:    req.ReceiptURL,
		Notes:         req.Notes,
		Status:        models.ExpenseStatusPending,
		CreatedByID:   &createdByID,
	}

	if err := s.repo.Create(e); err != nil {
		s.logger.Error("create expense failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return e, nil
}

func (s *expenseService) GetByID(id uint) (*models.Expense, error) {
	e, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if e == nil {
		return nil, apperrors.New(http.StatusNotFound, "EXP_001", "Expense not found", "")
	}
	return e, nil
}

func (s *expenseService) List(req utils.PageRequest, facilityID *uint, categoryID *uint, status string, dateFrom string, dateTo string) ([]*models.Expense, int64, error) {
	return s.repo.List(req, facilityID, categoryID, status, dateFrom, dateTo)
}

func (s *expenseService) Update(id uint, req UpdateExpenseRequest) (*models.Expense, error) {
	e, err := s.repo.FindByID(id)
	if err != nil || e == nil {
		return nil, apperrors.New(http.StatusNotFound, "EXP_001", "Expense not found", "")
	}

	if req.Title != "" {
		e.Title = req.Title
	}
	if req.Amount != nil {
		if *req.Amount < 0 {
			return nil, apperrors.ErrValidation("amount cannot be negative")
		}
		e.Amount = *req.Amount
	}
	if req.ExpenseDate != "" {
		d, err := time.Parse("2006-01-02", req.ExpenseDate)
		if err != nil {
			return nil, apperrors.ErrValidation("expense_date must be in YYYY-MM-DD format")
		}
		e.ExpenseDate = d
	}
	if req.PaymentMethod != "" {
		if !validPaymentMethods[req.PaymentMethod] {
			return nil, apperrors.ErrValidation("invalid payment_method")
		}
		e.PaymentMethod = req.PaymentMethod
	}
	if req.Vendor != "" {
		e.Vendor = req.Vendor
	}
	if req.ReceiptURL != "" {
		e.ReceiptURL = req.ReceiptURL
	}
	if req.Notes != "" {
		e.Notes = req.Notes
	}
	if req.CategoryID != nil {
		e.CategoryID = req.CategoryID
	}
	if req.Status != "" {
		switch req.Status {
		case models.ExpenseStatusPending, models.ExpenseStatusApproved, models.ExpenseStatusRejected:
			// valid
		default:
			return nil, apperrors.ErrValidation("status must be one of: pending, approved, rejected")
		}
		e.Status = req.Status
	}

	if err := s.repo.Update(e); err != nil {
		s.logger.Error("update expense failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	// Reload with associations
	return s.repo.FindByID(id)
}

func (s *expenseService) Delete(id uint) error {
	e, err := s.repo.FindByID(id)
	if err != nil || e == nil {
		return apperrors.New(http.StatusNotFound, "EXP_001", "Expense not found", "")
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete expense failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}
