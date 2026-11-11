package services

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── DTOs ─────────────────────────────────────────────────────────────────────

type UpsertTaxProfileRequest struct {
	LegalName          string `json:"legal_name"`
	GSTIN              string `json:"gstin"`
	Address            string `json:"address"`
	InvoicePrefix      string `json:"invoice_prefix"`
	ReceiptPrefix      string `json:"receipt_prefix"`
	CreditNotePrefix   string `json:"credit_note_prefix"`
	FinancialYearStart string `json:"financial_year_start"`
	TaxInclusive       bool   `json:"tax_inclusive"`
}

type CreateTaxRateRequest struct {
	Name      string  `json:"name"`
	Rate      float64 `json:"rate"`
	CGSTRate  float64 `json:"cgst_rate"`
	SGSTRate  float64 `json:"sgst_rate"`
	IGSTRate  float64 `json:"igst_rate"`
	IsDefault bool    `json:"is_default"`
}

type InvoiceLineRequest struct {
	Description    string  `json:"description"`
	Quantity       float64 `json:"quantity"`
	UnitPrice      float64 `json:"unit_price"`
	DiscountAmount float64 `json:"discount_amount"`
	TaxRateID      *uint   `json:"tax_rate_id"`
}

type CreateInvoiceRequest struct {
	MemberID       uint                 `json:"member_id"`
	FacilityID     uint                 `json:"facility_id"`
	PaymentID      *uint                `json:"payment_id"`
	SubscriptionID *uint                `json:"subscription_id"`
	Lines          []InvoiceLineRequest `json:"lines"`
	Notes          string               `json:"notes"`
	BuyerGSTIN     string               `json:"buyer_gstin"`
	BuyerAddress   string               `json:"buyer_address"`
}

type CreateReceiptRequest struct {
	MemberID      uint    `json:"member_id"`
	FacilityID    uint    `json:"facility_id"`
	PaymentID     uint    `json:"payment_id"`
	InvoiceID     *uint   `json:"invoice_id"`
	AmountReceived float64 `json:"amount_received"`
	PaymentMethod string  `json:"payment_method"`
	PaidAt        string  `json:"paid_at"`
	Notes         string  `json:"notes"`
}

type CreateCreditNoteRequest struct {
	MemberID          uint    `json:"member_id"`
	FacilityID        uint    `json:"facility_id"`
	OriginalInvoiceID *uint   `json:"original_invoice_id"`
	PaymentID         *uint   `json:"payment_id"`
	Reason            string  `json:"reason"`
	Amount            float64 `json:"amount"`
	TaxAmount         float64 `json:"tax_amount"`
}

// ─── Service Interface ────────────────────────────────────────────────────────

type BillingService interface {
	// Tax profile
	GetTaxProfile(facilityID uint) (*models.TaxProfile, error)
	UpsertTaxProfile(facilityID uint, req UpsertTaxProfileRequest, actorID uint) (*models.TaxProfile, error)

	// Tax rates
	ListTaxRates() ([]*models.TaxRate, error)
	CreateTaxRate(req CreateTaxRateRequest) (*models.TaxRate, error)
	UpdateTaxRate(id uint, req CreateTaxRateRequest) (*models.TaxRate, error)

	// Invoices
	CreateInvoice(req CreateInvoiceRequest, actorID uint) (*models.Invoice, error)
	GetInvoice(id uint) (*models.Invoice, error)
	ListInvoices(facilityID uint, page, limit int) ([]*models.Invoice, int64, error)
	ListInvoicesByMember(memberID uint, page, limit int) ([]*models.Invoice, int64, error)
	CancelInvoice(id uint, reason string, actorID uint) error

	// Receipts
	CreateReceipt(req CreateReceiptRequest, actorID uint) (*models.Receipt, error)
	GetReceipt(id uint) (*models.Receipt, error)
	ListReceipts(facilityID uint, page, limit int) ([]*models.Receipt, int64, error)
	ListReceiptsByMember(memberID uint, page, limit int) ([]*models.Receipt, int64, error)

	// Credit notes
	CreateCreditNote(req CreateCreditNoteRequest, actorID uint) (*models.CreditNote, error)
	GetCreditNote(id uint) (*models.CreditNote, error)
	ListCreditNotesByMember(memberID uint, page, limit int) ([]*models.CreditNote, int64, error)
}

// ─── Implementation ───────────────────────────────────────────────────────────

type billingService struct {
	taxProfileRepo  repositories.TaxProfileRepository
	invoiceRepo     repositories.InvoiceRepository
	receiptRepo     repositories.ReceiptRepository
	creditNoteRepo  repositories.CreditNoteRepository
	memberRepo      repositories.MemberRepository
	paymentRepo     repositories.PaymentRepository
	logger          *slog.Logger
}

func NewBillingService(
	taxProfileRepo repositories.TaxProfileRepository,
	invoiceRepo repositories.InvoiceRepository,
	receiptRepo repositories.ReceiptRepository,
	creditNoteRepo repositories.CreditNoteRepository,
	memberRepo repositories.MemberRepository,
	paymentRepo repositories.PaymentRepository,
	logger *slog.Logger,
) BillingService {
	return &billingService{
		taxProfileRepo: taxProfileRepo,
		invoiceRepo:    invoiceRepo,
		receiptRepo:    receiptRepo,
		creditNoteRepo: creditNoteRepo,
		memberRepo:     memberRepo,
		paymentRepo:    paymentRepo,
		logger:         logger,
	}
}

// ── Tax Profile ───────────────────────────────────────────────────────────────

func (s *billingService) GetTaxProfile(facilityID uint) (*models.TaxProfile, error) {
	p, err := s.taxProfileRepo.FindByFacility(facilityID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if p == nil {
		return nil, apperrors.New(http.StatusNotFound, "TAX_001", "Tax profile not configured", "")
	}
	return p, nil
}

func (s *billingService) UpsertTaxProfile(facilityID uint, req UpsertTaxProfileRequest, actorID uint) (*models.TaxProfile, error) {
	if req.LegalName == "" {
		return nil, apperrors.ErrValidation("legal_name is required")
	}
	existing, _ := s.taxProfileRepo.FindByFacility(facilityID)
	if existing == nil {
		existing = &models.TaxProfile{FacilityID: facilityID}
	}
	existing.LegalName = req.LegalName
	existing.GSTIN = req.GSTIN
	existing.Address = req.Address
	if req.InvoicePrefix != "" {
		existing.InvoicePrefix = req.InvoicePrefix
	}
	if req.ReceiptPrefix != "" {
		existing.ReceiptPrefix = req.ReceiptPrefix
	}
	if req.CreditNotePrefix != "" {
		existing.CreditNotePrefix = req.CreditNotePrefix
	}
	if req.FinancialYearStart != "" {
		existing.FinancialYearStart = req.FinancialYearStart
	}
	existing.TaxInclusive = req.TaxInclusive
	existing.IsActive = true

	if err := s.taxProfileRepo.Upsert(existing); err != nil {
		return nil, apperrors.ErrInternal
	}
	return existing, nil
}

// ── Tax Rates ─────────────────────────────────────────────────────────────────

func (s *billingService) ListTaxRates() ([]*models.TaxRate, error) {
	return s.taxProfileRepo.ListRates()
}

func (s *billingService) CreateTaxRate(req CreateTaxRateRequest) (*models.TaxRate, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.Rate < 0 {
		return nil, apperrors.ErrValidation("rate must be >= 0")
	}
	rate := &models.TaxRate{
		Name:      req.Name,
		Rate:      req.Rate,
		CGSTRate:  req.CGSTRate,
		SGSTRate:  req.SGSTRate,
		IGSTRate:  req.IGSTRate,
		IsDefault: req.IsDefault,
		IsActive:  true,
	}
	if err := s.taxProfileRepo.CreateRate(rate); err != nil {
		return nil, apperrors.ErrInternal
	}
	return rate, nil
}

func (s *billingService) UpdateTaxRate(id uint, req CreateTaxRateRequest) (*models.TaxRate, error) {
	rate, err := s.taxProfileRepo.FindRate(id)
	if err != nil || rate == nil {
		return nil, apperrors.New(http.StatusNotFound, "TAX_002", "Tax rate not found", "")
	}
	rate.Name = req.Name
	rate.Rate = req.Rate
	rate.CGSTRate = req.CGSTRate
	rate.SGSTRate = req.SGSTRate
	rate.IGSTRate = req.IGSTRate
	rate.IsDefault = req.IsDefault
	if err := s.taxProfileRepo.UpdateRate(rate); err != nil {
		return nil, apperrors.ErrInternal
	}
	return rate, nil
}

// ── Invoices ──────────────────────────────────────────────────────────────────

func (s *billingService) CreateInvoice(req CreateInvoiceRequest, actorID uint) (*models.Invoice, error) {
	if req.MemberID == 0 || req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("member_id and facility_id are required")
	}
	if len(req.Lines) == 0 {
		return nil, apperrors.ErrValidation("at least one invoice line is required")
	}

	member, err := s.memberRepo.FindByID(req.MemberID)
	if err != nil || member == nil {
		return nil, apperrors.ErrMemberNotFound
	}

	taxProfile, err := s.taxProfileRepo.FindByFacility(req.FacilityID)
	if err != nil || taxProfile == nil {
		return nil, apperrors.New(http.StatusUnprocessableEntity, "TAX_001", "Tax profile not configured for this facility", "")
	}

	invNumber, err := s.taxProfileRepo.NextInvoiceNumber(req.FacilityID)
	if err != nil {
		s.logger.Error("invoice number generation failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	// Build lines and calculate totals
	var lines []models.InvoiceLine
	var subtotal, totalDiscount, totalTax float64

	for i, l := range req.Lines {
		if l.Description == "" {
			return nil, apperrors.ErrValidation(fmt.Sprintf("line %d: description is required", i+1))
		}
		qty := l.Quantity
		if qty <= 0 {
			qty = 1
		}

		lineBase := qty * l.UnitPrice
		lineDiscount := l.DiscountAmount
		taxable := lineBase - lineDiscount
		if taxable < 0 {
			taxable = 0
		}

		var cgst, sgst, igst, taxAmt, rateSnapshot float64
		if l.TaxRateID != nil {
			rate, _ := s.taxProfileRepo.FindRate(*l.TaxRateID)
			if rate != nil {
				rateSnapshot = rate.Rate
				cgst = taxable * (rate.CGSTRate / 100)
				sgst = taxable * (rate.SGSTRate / 100)
				igst = taxable * (rate.IGSTRate / 100)
				taxAmt = cgst + sgst + igst
			}
		}

		line := models.InvoiceLine{
			Description:     l.Description,
			Quantity:        qty,
			UnitPrice:       l.UnitPrice,
			DiscountAmount:  lineDiscount,
			TaxableAmount:   taxable,
			TaxRateID:       l.TaxRateID,
			TaxRateSnapshot: rateSnapshot,
			CGSTAmount:      roundCents(cgst),
			SGSTAmount:      roundCents(sgst),
			IGSTAmount:      roundCents(igst),
			TaxAmount:       roundCents(taxAmt),
			LineTotal:       roundCents(taxable + taxAmt),
			SortOrder:       i,
		}
		lines = append(lines, line)
		subtotal += lineBase
		totalDiscount += lineDiscount
		totalTax += taxAmt
	}

	taxableAmount := subtotal - totalDiscount
	total := taxableAmount + totalTax

	inv := &models.Invoice{
		InvoiceNumber:  invNumber,
		FacilityID:     req.FacilityID,
		MemberID:       req.MemberID,
		PaymentID:      req.PaymentID,
		SubscriptionID: req.SubscriptionID,
		Status:         models.InvoiceStatusIssued,
		IssueDate:      time.Now(),
		SellerName:     taxProfile.LegalName,
		SellerGSTIN:    taxProfile.GSTIN,
		SellerAddress:  taxProfile.Address,
		BuyerName:      member.User.FirstName + " " + member.User.LastName,
		BuyerPhone:     member.User.Phone,
		BuyerEmail:     member.User.Email,
		BuyerGSTIN:     req.BuyerGSTIN,
		BuyerAddress:   req.BuyerAddress,
		Subtotal:        roundCents(subtotal),
		DiscountAmount:  roundCents(totalDiscount),
		TaxableAmount:   roundCents(taxableAmount),
		TaxAmount:       roundCents(totalTax),
		Total:           roundCents(total),
		Currency:        "INR",
		Notes:           req.Notes,
		IssuedByID:      actorID,
	}

	if err := s.invoiceRepo.Create(inv, lines); err != nil {
		s.logger.Error("invoice create failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	created, _ := s.invoiceRepo.FindByID(inv.ID)
	if created != nil {
		return created, nil
	}
	return inv, nil
}

func (s *billingService) GetInvoice(id uint) (*models.Invoice, error) {
	inv, err := s.invoiceRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if inv == nil {
		return nil, apperrors.New(http.StatusNotFound, "INV_001", "Invoice not found", "")
	}
	return inv, nil
}

func (s *billingService) ListInvoices(facilityID uint, page, limit int) ([]*models.Invoice, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.invoiceRepo.List(facilityID, page, limit)
}

func (s *billingService) ListInvoicesByMember(memberID uint, page, limit int) ([]*models.Invoice, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.invoiceRepo.ListByMember(memberID, page, limit)
}

func (s *billingService) CancelInvoice(id uint, reason string, actorID uint) error {
	inv, err := s.invoiceRepo.FindByID(id)
	if err != nil || inv == nil {
		return apperrors.New(http.StatusNotFound, "INV_001", "Invoice not found", "")
	}
	if inv.Status == models.InvoiceStatusCancelled {
		return apperrors.New(http.StatusConflict, "INV_002", "Invoice already cancelled", "")
	}
	if reason == "" {
		return apperrors.ErrValidation("reason is required to cancel an invoice")
	}
	return s.invoiceRepo.Cancel(id, reason, actorID)
}

// ── Receipts ──────────────────────────────────────────────────────────────────

func (s *billingService) CreateReceipt(req CreateReceiptRequest, actorID uint) (*models.Receipt, error) {
	if req.MemberID == 0 || req.PaymentID == 0 || req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("member_id, facility_id, and payment_id are required")
	}
	if req.AmountReceived <= 0 {
		return nil, apperrors.ErrValidation("amount_received must be > 0")
	}

	rcptNumber, err := s.taxProfileRepo.NextReceiptNumber(req.FacilityID)
	if err != nil {
		return nil, apperrors.New(http.StatusUnprocessableEntity, "TAX_001", "Tax profile not configured for this facility", "")
	}

	paidAt := time.Now()
	if req.PaidAt != "" {
		if t, err := time.Parse("2006-01-02T15:04:05Z07:00", req.PaidAt); err == nil {
			paidAt = t
		}
	}

	rec := &models.Receipt{
		ReceiptNumber:  rcptNumber,
		InvoiceID:      req.InvoiceID,
		PaymentID:      req.PaymentID,
		MemberID:       req.MemberID,
		FacilityID:     req.FacilityID,
		AmountReceived: req.AmountReceived,
		Currency:       "INR",
		PaymentMethod:  req.PaymentMethod,
		PaidAt:         paidAt,
		Notes:          req.Notes,
		IssuedByID:     actorID,
	}

	if err := s.receiptRepo.Create(rec); err != nil {
		return nil, apperrors.ErrInternal
	}
	return rec, nil
}

func (s *billingService) GetReceipt(id uint) (*models.Receipt, error) {
	rec, err := s.receiptRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if rec == nil {
		return nil, apperrors.New(http.StatusNotFound, "RCP_001", "Receipt not found", "")
	}
	return rec, nil
}

func (s *billingService) ListReceipts(facilityID uint, page, limit int) ([]*models.Receipt, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.receiptRepo.List(facilityID, page, limit)
}

func (s *billingService) ListReceiptsByMember(memberID uint, page, limit int) ([]*models.Receipt, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.receiptRepo.ListByMember(memberID, page, limit)
}

// ── Credit Notes ──────────────────────────────────────────────────────────────

func (s *billingService) CreateCreditNote(req CreateCreditNoteRequest, actorID uint) (*models.CreditNote, error) {
	if req.MemberID == 0 || req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("member_id and facility_id are required")
	}
	if req.Amount <= 0 {
		return nil, apperrors.ErrValidation("amount must be > 0")
	}
	if req.Reason == "" {
		return nil, apperrors.ErrValidation("reason is required")
	}

	cnNumber, err := s.taxProfileRepo.NextCreditNoteNumber(req.FacilityID)
	if err != nil {
		return nil, apperrors.New(http.StatusUnprocessableEntity, "TAX_001", "Tax profile not configured for this facility", "")
	}

	cn := &models.CreditNote{
		CreditNoteNumber:  cnNumber,
		OriginalInvoiceID: req.OriginalInvoiceID,
		PaymentID:         req.PaymentID,
		MemberID:          req.MemberID,
		FacilityID:        req.FacilityID,
		Reason:            req.Reason,
		Amount:            req.Amount,
		TaxAmount:         req.TaxAmount,
		Currency:          "INR",
		Status:            models.CreditNoteStatusIssued,
		IssuedByID:        actorID,
		IssuedAt:          time.Now(),
	}

	if err := s.creditNoteRepo.Create(cn); err != nil {
		return nil, apperrors.ErrInternal
	}
	return cn, nil
}

func (s *billingService) GetCreditNote(id uint) (*models.CreditNote, error) {
	cn, err := s.creditNoteRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if cn == nil {
		return nil, apperrors.New(http.StatusNotFound, "CN_001", "Credit note not found", "")
	}
	return cn, nil
}

func (s *billingService) ListCreditNotesByMember(memberID uint, page, limit int) ([]*models.CreditNote, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.creditNoteRepo.ListByMember(memberID, page, limit)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func roundCents(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}
