package services

import (
	"log/slog"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

type CreateVendorRequest struct {
	Name         string  `json:"name"`
	ContactName  string  `json:"contact_name"`
	Phone        string  `json:"phone"`
	Email        string  `json:"email"`
	Address      string  `json:"address"`
	City         string  `json:"city"`
	State        string  `json:"state"`
	Pincode      string  `json:"pincode"`
	GSTNumber    string  `json:"gst_number"`
	PANNumber    string  `json:"pan_number"`
	Category     string  `json:"category"`
	PaymentTerms string  `json:"payment_terms"`
	CreditLimit  float64 `json:"credit_limit"`
	BankName     string  `json:"bank_name"`
	BankAccount  string  `json:"bank_account"`
	BankIFSC     string  `json:"bank_ifsc"`
	Status       string  `json:"status"`
	Notes        string  `json:"notes"`
}

type UpdateVendorRequest struct {
	Name         string   `json:"name"`
	ContactName  string   `json:"contact_name"`
	Phone        string   `json:"phone"`
	Email        string   `json:"email"`
	Address      string   `json:"address"`
	City         string   `json:"city"`
	State        string   `json:"state"`
	Pincode      string   `json:"pincode"`
	GSTNumber    string   `json:"gst_number"`
	PANNumber    string   `json:"pan_number"`
	Category     string   `json:"category"`
	PaymentTerms string   `json:"payment_terms"`
	CreditLimit  *float64 `json:"credit_limit"`
	BankName     string   `json:"bank_name"`
	BankAccount  string   `json:"bank_account"`
	BankIFSC     string   `json:"bank_ifsc"`
	Status       string   `json:"status"`
	Notes        string   `json:"notes"`
}

type VendorService interface {
	Create(req CreateVendorRequest) (*models.Vendor, error)
	GetByID(id uint) (*models.Vendor, error)
	List(status, category, search string, page, perPage int) ([]*models.Vendor, int64, error)
	Update(id uint, req UpdateVendorRequest) (*models.Vendor, error)
	Delete(id uint) error
}

type vendorService struct {
	repo   repositories.VendorRepository
	logger *slog.Logger
}

func NewVendorService(repo repositories.VendorRepository, logger *slog.Logger) VendorService {
	return &vendorService{repo: repo, logger: logger}
}

func (s *vendorService) Create(req CreateVendorRequest) (*models.Vendor, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.Phone == "" {
		return nil, apperrors.ErrValidation("phone is required")
	}
	if req.Category == "" {
		return nil, apperrors.ErrValidation("category is required")
	}

	status := req.Status
	if status == "" {
		status = "active"
	}

	v := &models.Vendor{
		Name:         req.Name,
		ContactName:  req.ContactName,
		Phone:        req.Phone,
		Email:        req.Email,
		Address:      req.Address,
		City:         req.City,
		State:        req.State,
		Pincode:      req.Pincode,
		GSTNumber:    req.GSTNumber,
		PANNumber:    req.PANNumber,
		Category:     req.Category,
		PaymentTerms: req.PaymentTerms,
		CreditLimit:  req.CreditLimit,
		BankName:     req.BankName,
		BankAccount:  req.BankAccount,
		BankIFSC:     req.BankIFSC,
		Status:       status,
		Notes:        req.Notes,
	}

	if err := s.repo.Create(v); err != nil {
		s.logger.Error("create vendor failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return v, nil
}

func (s *vendorService) GetByID(id uint) (*models.Vendor, error) {
	v, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if v == nil {
		return nil, apperrors.New(404, "VENDOR_NOT_FOUND", "vendor not found", "")
	}
	return v, nil
}

func (s *vendorService) List(status, category, search string, page, perPage int) ([]*models.Vendor, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 500 {
		perPage = 25
	}
	list, total, err := s.repo.List(status, category, search, page, perPage)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	return list, total, nil
}

func (s *vendorService) Update(id uint, req UpdateVendorRequest) (*models.Vendor, error) {
	v, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if v == nil {
		return nil, apperrors.New(404, "VENDOR_NOT_FOUND", "vendor not found", "")
	}

	if req.Name != "" {
		v.Name = req.Name
	}
	if req.ContactName != "" {
		v.ContactName = req.ContactName
	}
	if req.Phone != "" {
		v.Phone = req.Phone
	}
	if req.Email != "" {
		v.Email = req.Email
	}
	if req.Address != "" {
		v.Address = req.Address
	}
	if req.City != "" {
		v.City = req.City
	}
	if req.State != "" {
		v.State = req.State
	}
	if req.Pincode != "" {
		v.Pincode = req.Pincode
	}
	if req.GSTNumber != "" {
		v.GSTNumber = req.GSTNumber
	}
	if req.PANNumber != "" {
		v.PANNumber = req.PANNumber
	}
	if req.Category != "" {
		v.Category = req.Category
	}
	if req.PaymentTerms != "" {
		v.PaymentTerms = req.PaymentTerms
	}
	if req.CreditLimit != nil {
		v.CreditLimit = *req.CreditLimit
	}
	if req.BankName != "" {
		v.BankName = req.BankName
	}
	if req.BankAccount != "" {
		v.BankAccount = req.BankAccount
	}
	if req.BankIFSC != "" {
		v.BankIFSC = req.BankIFSC
	}
	if req.Status != "" {
		v.Status = req.Status
	}
	if req.Notes != "" {
		v.Notes = req.Notes
	}

	if err := s.repo.Update(v); err != nil {
		s.logger.Error("update vendor failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return v, nil
}

func (s *vendorService) Delete(id uint) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete vendor failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}
