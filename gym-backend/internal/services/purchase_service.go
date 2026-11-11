package services

import (
	"fmt"
	"log/slog"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

type PurchaseItemRequest struct {
	ItemName       string  `json:"item_name"`
	Description    string  `json:"description"`
	Category       string  `json:"category"`
	Quantity       float64 `json:"quantity"`
	Unit           string  `json:"unit"`
	UnitPrice      float64 `json:"unit_price"`
	DiscountAmount float64 `json:"discount_amount"`
	TaxPercent     float64 `json:"tax_percent"`
	TotalPrice     float64 `json:"total_price"`
}

type CreatePurchaseRequest struct {
	VendorID           *uint                 `json:"vendor_id"`
	VendorName         string                `json:"vendor_name"`
	PurchaseDate       string                `json:"purchase_date"`
	ExpectedDelivery   string                `json:"expected_delivery"`
	ReceivedDate       string                `json:"received_date"`
	InvoiceNumber      string                `json:"invoice_number"`
	Items              []PurchaseItemRequest `json:"items"`
	Subtotal           float64               `json:"subtotal"`
	ItemDiscount       float64               `json:"item_discount"`
	AdditionalDiscount float64               `json:"additional_discount"`
	TaxPercent         float64               `json:"tax_percent"`
	TaxAmount          float64               `json:"tax_amount"`
	ShippingCharges    float64               `json:"shipping_charges"`
	TotalAmount        float64               `json:"total_amount"`
	AmountPaid         float64               `json:"amount_paid"`
	PaymentMethod      string                `json:"payment_method"`
	PaymentDate        string                `json:"payment_date"`
	PaymentReference   string                `json:"payment_reference"`
	PaymentStatus      string                `json:"payment_status"`
	Status             string                `json:"status"`
	ReceivedBy         string                `json:"received_by"`
	Notes              string                `json:"notes"`
}

type UpdatePurchaseRequest struct {
	VendorID           *uint                 `json:"vendor_id"`
	VendorName         string                `json:"vendor_name"`
	PurchaseDate       string                `json:"purchase_date"`
	ExpectedDelivery   string                `json:"expected_delivery"`
	ReceivedDate       string                `json:"received_date"`
	InvoiceNumber      string                `json:"invoice_number"`
	Items              []PurchaseItemRequest `json:"items"`
	Subtotal           *float64              `json:"subtotal"`
	ItemDiscount       *float64              `json:"item_discount"`
	AdditionalDiscount *float64              `json:"additional_discount"`
	TaxPercent         *float64              `json:"tax_percent"`
	TaxAmount          *float64              `json:"tax_amount"`
	ShippingCharges    *float64              `json:"shipping_charges"`
	TotalAmount        *float64              `json:"total_amount"`
	AmountPaid         *float64              `json:"amount_paid"`
	PaymentMethod      string                `json:"payment_method"`
	PaymentDate        string                `json:"payment_date"`
	PaymentReference   string                `json:"payment_reference"`
	PaymentStatus      string                `json:"payment_status"`
	Status             string                `json:"status"`
	ReceivedBy         string                `json:"received_by"`
	Notes              string                `json:"notes"`
}

type PurchaseService interface {
	Create(req CreatePurchaseRequest, createdByID uint) (*models.Purchase, error)
	GetByID(id uint) (*models.Purchase, error)
	List(status, paymentStatus string, vendorID *uint, page, perPage int) ([]*models.Purchase, int64, error)
	Update(id uint, req UpdatePurchaseRequest) (*models.Purchase, error)
	Delete(id uint) error
}

type purchaseService struct {
	repo   repositories.PurchaseRepository
	logger *slog.Logger
}

func NewPurchaseService(repo repositories.PurchaseRepository, logger *slog.Logger) PurchaseService {
	return &purchaseService{repo: repo, logger: logger}
}

func parseDateOptional(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

func (s *purchaseService) Create(req CreatePurchaseRequest, createdByID uint) (*models.Purchase, error) {
	if req.VendorName == "" {
		return nil, apperrors.ErrValidation("vendor_name is required")
	}

	seq := s.repo.MaxPurchaseSeq() + 1
	purchaseNum := fmt.Sprintf("PO-%03d", seq)

	purchaseDate := time.Now()
	if req.PurchaseDate != "" {
		if t, err := time.Parse("2006-01-02", req.PurchaseDate); err == nil {
			purchaseDate = t
		}
	}

	paymentStatus := req.PaymentStatus
	if paymentStatus == "" {
		paymentStatus = "pending"
	}
	status := req.Status
	if status == "" {
		status = "draft"
	}

	p := &models.Purchase{
		PurchaseNumber:     purchaseNum,
		VendorID:           req.VendorID,
		VendorName:         req.VendorName,
		PurchaseDate:       purchaseDate,
		ExpectedDelivery:   parseDateOptional(req.ExpectedDelivery),
		ReceivedDate:       parseDateOptional(req.ReceivedDate),
		InvoiceNumber:      req.InvoiceNumber,
		Subtotal:           req.Subtotal,
		ItemDiscount:       req.ItemDiscount,
		AdditionalDiscount: req.AdditionalDiscount,
		TaxPercent:         req.TaxPercent,
		TaxAmount:          req.TaxAmount,
		ShippingCharges:    req.ShippingCharges,
		TotalAmount:        req.TotalAmount,
		AmountPaid:         req.AmountPaid,
		PaymentMethod:      req.PaymentMethod,
		PaymentDate:        parseDateOptional(req.PaymentDate),
		PaymentReference:   req.PaymentReference,
		PaymentStatus:      paymentStatus,
		Status:             status,
		ReceivedBy:         req.ReceivedBy,
		Notes:              req.Notes,
		CreatedByID:        &createdByID,
	}

	for _, item := range req.Items {
		unit := item.Unit
		if unit == "" {
			unit = "pcs"
		}
		qty := item.Quantity
		if qty <= 0 {
			qty = 1
		}
		p.Items = append(p.Items, models.PurchaseItem{
			ItemName:       item.ItemName,
			Description:    item.Description,
			Category:       item.Category,
			Quantity:       qty,
			Unit:           unit,
			UnitPrice:      item.UnitPrice,
			DiscountAmount: item.DiscountAmount,
			TaxPercent:     item.TaxPercent,
			TotalPrice:     item.TotalPrice,
		})
	}

	if err := s.repo.Create(p); err != nil {
		s.logger.Error("create purchase failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return p, nil
}

func (s *purchaseService) GetByID(id uint) (*models.Purchase, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if p == nil {
		return nil, apperrors.New(404, "PURCHASE_NOT_FOUND", "purchase not found", "")
	}
	return p, nil
}

func (s *purchaseService) List(status, paymentStatus string, vendorID *uint, page, perPage int) ([]*models.Purchase, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 200 {
		perPage = 25
	}
	list, total, err := s.repo.List(status, paymentStatus, vendorID, page, perPage)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	return list, total, nil
}

func (s *purchaseService) Update(id uint, req UpdatePurchaseRequest) (*models.Purchase, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if p == nil {
		return nil, apperrors.New(404, "PURCHASE_NOT_FOUND", "purchase not found", "")
	}

	if req.VendorID != nil {
		p.VendorID = req.VendorID
	}
	if req.VendorName != "" {
		p.VendorName = req.VendorName
	}
	if req.PurchaseDate != "" {
		if t, err := time.Parse("2006-01-02", req.PurchaseDate); err == nil {
			p.PurchaseDate = t
		}
	}
	if req.ExpectedDelivery != "" {
		p.ExpectedDelivery = parseDateOptional(req.ExpectedDelivery)
	}
	if req.ReceivedDate != "" {
		p.ReceivedDate = parseDateOptional(req.ReceivedDate)
	}
	if req.InvoiceNumber != "" {
		p.InvoiceNumber = req.InvoiceNumber
	}
	if req.Subtotal != nil {
		p.Subtotal = *req.Subtotal
	}
	if req.ItemDiscount != nil {
		p.ItemDiscount = *req.ItemDiscount
	}
	if req.AdditionalDiscount != nil {
		p.AdditionalDiscount = *req.AdditionalDiscount
	}
	if req.TaxPercent != nil {
		p.TaxPercent = *req.TaxPercent
	}
	if req.TaxAmount != nil {
		p.TaxAmount = *req.TaxAmount
	}
	if req.ShippingCharges != nil {
		p.ShippingCharges = *req.ShippingCharges
	}
	if req.TotalAmount != nil {
		p.TotalAmount = *req.TotalAmount
	}
	if req.AmountPaid != nil {
		p.AmountPaid = *req.AmountPaid
	}
	if req.PaymentMethod != "" {
		p.PaymentMethod = req.PaymentMethod
	}
	if req.PaymentDate != "" {
		p.PaymentDate = parseDateOptional(req.PaymentDate)
	}
	if req.PaymentReference != "" {
		p.PaymentReference = req.PaymentReference
	}
	if req.PaymentStatus != "" {
		p.PaymentStatus = req.PaymentStatus
	}
	if req.Status != "" {
		p.Status = req.Status
	}
	if req.ReceivedBy != "" {
		p.ReceivedBy = req.ReceivedBy
	}
	if req.Notes != "" {
		p.Notes = req.Notes
	}

	if req.Items != nil {
		p.Items = nil
		for _, item := range req.Items {
			unit := item.Unit
			if unit == "" {
				unit = "pcs"
			}
			qty := item.Quantity
			if qty <= 0 {
				qty = 1
			}
			p.Items = append(p.Items, models.PurchaseItem{
				PurchaseID:     p.ID,
				ItemName:       item.ItemName,
				Description:    item.Description,
				Category:       item.Category,
				Quantity:       qty,
				Unit:           unit,
				UnitPrice:      item.UnitPrice,
				DiscountAmount: item.DiscountAmount,
				TaxPercent:     item.TaxPercent,
				TotalPrice:     item.TotalPrice,
			})
		}
	}

	if err := s.repo.Update(p); err != nil {
		s.logger.Error("update purchase failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return p, nil
}

func (s *purchaseService) Delete(id uint) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete purchase failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}
