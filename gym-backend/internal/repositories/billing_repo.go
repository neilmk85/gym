package repositories

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"gym-backend/internal/models"
)

// ─── Tax Profile ─────────────────────────────────────────────────────────────

type TaxProfileRepository interface {
	FindByFacility(facilityID uint) (*models.TaxProfile, error)
	Upsert(p *models.TaxProfile) error
	NextInvoiceNumber(facilityID uint) (string, error)
	NextReceiptNumber(facilityID uint) (string, error)
	NextCreditNoteNumber(facilityID uint) (string, error)
	ListRates() ([]*models.TaxRate, error)
	FindRate(id uint) (*models.TaxRate, error)
	FindDefaultRate() (*models.TaxRate, error)
	CreateRate(r *models.TaxRate) error
	UpdateRate(r *models.TaxRate) error
}

type taxProfileRepository struct{ db *gorm.DB }

func NewTaxProfileRepository(db *gorm.DB) TaxProfileRepository {
	return &taxProfileRepository{db: db}
}

func (r *taxProfileRepository) FindByFacility(facilityID uint) (*models.TaxProfile, error) {
	var p models.TaxProfile
	err := r.db.Where("facility_id = ?", facilityID).First(&p).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &p, err
}

func (r *taxProfileRepository) Upsert(p *models.TaxProfile) error {
	return r.db.Save(p).Error
}

func (r *taxProfileRepository) nextNumber(facilityID uint, prefix, field string) (string, error) {
	var profile models.TaxProfile
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("facility_id = ?", facilityID).
		First(&profile).Error
	if err != nil {
		return "", err
	}

	year := time.Now().Year()
	var seq int
	switch field {
	case "invoice":
		profile.InvoiceSequence++
		seq = profile.InvoiceSequence
	case "receipt":
		profile.ReceiptSequence++
		seq = profile.ReceiptSequence
	case "credit_note":
		profile.CreditNoteSequence++
		seq = profile.CreditNoteSequence
	}

	if err := r.db.Save(&profile).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/%d/%04d", prefix, year, seq), nil
}

func (r *taxProfileRepository) NextInvoiceNumber(facilityID uint) (string, error) {
	var profile models.TaxProfile
	if err := r.db.Where("facility_id = ?", facilityID).First(&profile).Error; err != nil {
		return "", err
	}
	return r.nextNumber(facilityID, profile.InvoicePrefix, "invoice")
}

func (r *taxProfileRepository) NextReceiptNumber(facilityID uint) (string, error) {
	var profile models.TaxProfile
	if err := r.db.Where("facility_id = ?", facilityID).First(&profile).Error; err != nil {
		return "", err
	}
	return r.nextNumber(facilityID, profile.ReceiptPrefix, "receipt")
}

func (r *taxProfileRepository) NextCreditNoteNumber(facilityID uint) (string, error) {
	var profile models.TaxProfile
	if err := r.db.Where("facility_id = ?", facilityID).First(&profile).Error; err != nil {
		return "", err
	}
	return r.nextNumber(facilityID, profile.CreditNotePrefix, "credit_note")
}

func (r *taxProfileRepository) ListRates() ([]*models.TaxRate, error) {
	var rates []*models.TaxRate
	return rates, r.db.Where("is_active = true").Order("rate asc").Find(&rates).Error
}

func (r *taxProfileRepository) FindRate(id uint) (*models.TaxRate, error) {
	var rate models.TaxRate
	err := r.db.First(&rate, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &rate, err
}

func (r *taxProfileRepository) FindDefaultRate() (*models.TaxRate, error) {
	var rate models.TaxRate
	err := r.db.Where("is_default = true AND is_active = true").First(&rate).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &rate, err
}

func (r *taxProfileRepository) CreateRate(rate *models.TaxRate) error {
	return r.db.Create(rate).Error
}

func (r *taxProfileRepository) UpdateRate(rate *models.TaxRate) error {
	return r.db.Save(rate).Error
}

// ─── Invoice ─────────────────────────────────────────────────────────────────

type InvoiceRepository interface {
	Create(inv *models.Invoice, lines []models.InvoiceLine) error
	FindByID(id uint) (*models.Invoice, error)
	FindByNumber(number string) (*models.Invoice, error)
	ListByMember(memberID uint, page, limit int) ([]*models.Invoice, int64, error)
	List(facilityID uint, page, limit int) ([]*models.Invoice, int64, error)
	Cancel(id uint, reason string, actorID uint) error
}

type invoiceRepository struct{ db *gorm.DB }

func NewInvoiceRepository(db *gorm.DB) InvoiceRepository {
	return &invoiceRepository{db: db}
}

func (r *invoiceRepository) Create(inv *models.Invoice, lines []models.InvoiceLine) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(inv).Error; err != nil {
			return err
		}
		for i := range lines {
			lines[i].InvoiceID = inv.ID
		}
		if len(lines) > 0 {
			return tx.Create(&lines).Error
		}
		return nil
	})
}

func (r *invoiceRepository) FindByID(id uint) (*models.Invoice, error) {
	var inv models.Invoice
	err := r.db.Preload("Lines").Preload("Member.User").First(&inv, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &inv, err
}

func (r *invoiceRepository) FindByNumber(number string) (*models.Invoice, error) {
	var inv models.Invoice
	err := r.db.Preload("Lines").Where("invoice_number = ?", number).First(&inv).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &inv, err
}

func (r *invoiceRepository) ListByMember(memberID uint, page, limit int) ([]*models.Invoice, int64, error) {
	var invoices []*models.Invoice
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.Invoice{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Preload("Lines").Order("created_at desc").Offset(offset).Limit(limit).Find(&invoices).Error
	return invoices, total, err
}

func (r *invoiceRepository) List(facilityID uint, page, limit int) ([]*models.Invoice, int64, error) {
	var invoices []*models.Invoice
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.Invoice{}).Where("facility_id = ?", facilityID)
	q.Count(&total)
	err := q.Preload("Member.User").Order("created_at desc").Offset(offset).Limit(limit).Find(&invoices).Error
	return invoices, total, err
}

func (r *invoiceRepository) Cancel(id uint, reason string, actorID uint) error {
	now := time.Now()
	return r.db.Model(&models.Invoice{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":        models.InvoiceStatusCancelled,
		"cancel_reason": reason,
		"cancelled_at":  now,
	}).Error
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

type ReceiptRepository interface {
	Create(r *models.Receipt) error
	FindByID(id uint) (*models.Receipt, error)
	ListByMember(memberID uint, page, limit int) ([]*models.Receipt, int64, error)
	List(facilityID uint, page, limit int) ([]*models.Receipt, int64, error)
}

type receiptRepository struct{ db *gorm.DB }

func NewReceiptRepository(db *gorm.DB) ReceiptRepository {
	return &receiptRepository{db: db}
}

func (r *receiptRepository) Create(rec *models.Receipt) error {
	return r.db.Create(rec).Error
}

func (r *receiptRepository) FindByID(id uint) (*models.Receipt, error) {
	var rec models.Receipt
	err := r.db.Preload("Member.User").Preload("Payment").First(&rec, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &rec, err
}

func (r *receiptRepository) ListByMember(memberID uint, page, limit int) ([]*models.Receipt, int64, error) {
	var recs []*models.Receipt
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.Receipt{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Order("created_at desc").Offset(offset).Limit(limit).Find(&recs).Error
	return recs, total, err
}

func (r *receiptRepository) List(facilityID uint, page, limit int) ([]*models.Receipt, int64, error) {
	var recs []*models.Receipt
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.Receipt{}).Where("facility_id = ?", facilityID)
	q.Count(&total)
	err := q.Preload("Member.User").Order("created_at desc").Offset(offset).Limit(limit).Find(&recs).Error
	return recs, total, err
}

// ─── Credit Note ─────────────────────────────────────────────────────────────

type CreditNoteRepository interface {
	Create(cn *models.CreditNote) error
	FindByID(id uint) (*models.CreditNote, error)
	ListByMember(memberID uint, page, limit int) ([]*models.CreditNote, int64, error)
}

type creditNoteRepository struct{ db *gorm.DB }

func NewCreditNoteRepository(db *gorm.DB) CreditNoteRepository {
	return &creditNoteRepository{db: db}
}

func (r *creditNoteRepository) Create(cn *models.CreditNote) error {
	return r.db.Create(cn).Error
}

func (r *creditNoteRepository) FindByID(id uint) (*models.CreditNote, error) {
	var cn models.CreditNote
	err := r.db.Preload("Member.User").First(&cn, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &cn, err
}

func (r *creditNoteRepository) ListByMember(memberID uint, page, limit int) ([]*models.CreditNote, int64, error) {
	var cns []*models.CreditNote
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.CreditNote{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Order("created_at desc").Offset(offset).Limit(limit).Find(&cns).Error
	return cns, total, err
}

// ─── Entitlement Ledger ───────────────────────────────────────────────────────

type EntitlementLedgerRepository interface {
	Create(e *models.EntitlementLedger) error
	ListByMember(memberID uint, page, limit int) ([]*models.EntitlementLedger, int64, error)
	ListBySubscription(subID uint) ([]*models.EntitlementLedger, error)
}

type entitlementLedgerRepository struct{ db *gorm.DB }

func NewEntitlementLedgerRepository(db *gorm.DB) EntitlementLedgerRepository {
	return &entitlementLedgerRepository{db: db}
}

func (r *entitlementLedgerRepository) Create(e *models.EntitlementLedger) error {
	return r.db.Create(e).Error
}

func (r *entitlementLedgerRepository) ListByMember(memberID uint, page, limit int) ([]*models.EntitlementLedger, int64, error) {
	var entries []*models.EntitlementLedger
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.EntitlementLedger{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Order("created_at desc").Offset(offset).Limit(limit).Find(&entries).Error
	return entries, total, err
}

func (r *entitlementLedgerRepository) ListBySubscription(subID uint) ([]*models.EntitlementLedger, error) {
	var entries []*models.EntitlementLedger
	err := r.db.Where("subscription_id = ?", subID).Order("created_at desc").Find(&entries).Error
	return entries, err
}
