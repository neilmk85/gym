package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── Commission Service ───────────────────────────────────────────────────────

type CommissionService interface {
	// Rules
	CreateRule(req CreateCommissionRuleRequest) (*models.CommissionRule, error)
	ListRulesByStaff(staffID uint) ([]*models.CommissionRule, error)
	UpdateRule(id uint, req UpdateCommissionRuleRequest) (*models.CommissionRule, error)
	DeleteRule(id uint) error

	// Entries
	RecordCommission(req RecordCommissionRequest) (*models.CommissionEntry, error)
	GetEntry(id uint) (*models.CommissionEntry, error)
	ListEntriesByStaff(staffID uint, page, limit int) ([]*models.CommissionEntry, int64, error)
	ApproveEntry(id uint) error
	CancelEntry(id uint) error

	// Payouts
	CreatePayout(staffID uint, periodStart, periodEnd string) (*models.CommissionPayout, error)
	MarkPayoutPaid(id uint) error
	ListPayoutsByStaff(staffID uint, page, limit int) ([]*models.CommissionPayout, int64, error)
}

type CreateCommissionRuleRequest struct {
	StaffID   uint    `json:"staff_id"`
	EventType string  `json:"event_type"`
	RuleType  string  `json:"rule_type"`
	Value     float64 `json:"value"`
}

type UpdateCommissionRuleRequest struct {
	RuleType *string  `json:"rule_type"`
	Value    *float64 `json:"value"`
	IsActive *bool    `json:"is_active"`
}

type RecordCommissionRequest struct {
	StaffID      uint   `json:"staff_id"`
	EventType    string `json:"event_type"`
	BaseAmtPaise int64  `json:"base_amt_paise"`
	RefModel     string `json:"ref_model"`
	RefID        uint   `json:"ref_id"`
	Notes        string `json:"notes"`
}

type commissionService struct {
	ruleRepo   repositories.CommissionRuleRepository
	entryRepo  repositories.CommissionEntryRepository
	payoutRepo repositories.CommissionPayoutRepository
	logger     *slog.Logger
}

func NewCommissionService(
	ruleRepo repositories.CommissionRuleRepository,
	entryRepo repositories.CommissionEntryRepository,
	payoutRepo repositories.CommissionPayoutRepository,
	logger *slog.Logger,
) CommissionService {
	return &commissionService{
		ruleRepo:   ruleRepo,
		entryRepo:  entryRepo,
		payoutRepo: payoutRepo,
		logger:     logger,
	}
}

func (s *commissionService) CreateRule(req CreateCommissionRuleRequest) (*models.CommissionRule, error) {
	if req.StaffID == 0 || req.EventType == "" {
		return nil, apperrors.ErrValidation("staff_id and event_type are required")
	}
	if req.RuleType != models.CommissionRuleTypePct && req.RuleType != models.CommissionRuleTypeFixed {
		return nil, apperrors.ErrValidation("rule_type must be percentage or fixed")
	}
	rule := &models.CommissionRule{
		StaffID:   req.StaffID,
		EventType: req.EventType,
		RuleType:  req.RuleType,
		Value:     req.Value,
		IsActive:  true,
	}
	if err := s.ruleRepo.Create(rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *commissionService) ListRulesByStaff(staffID uint) ([]*models.CommissionRule, error) {
	return s.ruleRepo.ListByStaff(staffID)
}

func (s *commissionService) UpdateRule(id uint, req UpdateCommissionRuleRequest) (*models.CommissionRule, error) {
	rule, err := s.ruleRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if rule == nil {
		return nil, apperrors.New(http.StatusNotFound, "COMM_001", "commission rule not found", "")
	}
	if req.RuleType != nil {
		rule.RuleType = *req.RuleType
	}
	if req.Value != nil {
		rule.Value = *req.Value
	}
	if req.IsActive != nil {
		rule.IsActive = *req.IsActive
	}
	if err := s.ruleRepo.Update(rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *commissionService) DeleteRule(id uint) error {
	return s.ruleRepo.Delete(id)
}

func (s *commissionService) RecordCommission(req RecordCommissionRequest) (*models.CommissionEntry, error) {
	if req.StaffID == 0 || req.EventType == "" {
		return nil, apperrors.ErrValidation("staff_id and event_type are required")
	}

	var commPaise int64
	var ruleID *uint

	rule, err := s.ruleRepo.FindActiveByStaffAndEvent(req.StaffID, req.EventType)
	if err != nil {
		return nil, err
	}
	if rule != nil {
		ruleID = &rule.ID
		if rule.RuleType == models.CommissionRuleTypePct {
			commPaise = int64(float64(req.BaseAmtPaise) * rule.Value / 100.0)
		} else {
			commPaise = int64(rule.Value)
		}
	}

	entry := &models.CommissionEntry{
		StaffID:     req.StaffID,
		RuleID:      ruleID,
		EventType:   req.EventType,
		RefModel:    req.RefModel,
		RefID:       req.RefID,
		BaseAmtPaise: req.BaseAmtPaise,
		CommPaise:   commPaise,
		Status:      models.CommissionStatusPending,
		Notes:       req.Notes,
	}
	if err := s.entryRepo.Create(entry); err != nil {
		return nil, err
	}
	return entry, nil
}

func (s *commissionService) GetEntry(id uint) (*models.CommissionEntry, error) {
	e, err := s.entryRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if e == nil {
		return nil, apperrors.New(http.StatusNotFound, "COMM_002", "commission entry not found", "")
	}
	return e, nil
}

func (s *commissionService) ListEntriesByStaff(staffID uint, page, limit int) ([]*models.CommissionEntry, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.entryRepo.ListByStaff(staffID, page, limit)
}

func (s *commissionService) ApproveEntry(id uint) error {
	e, err := s.entryRepo.FindByID(id)
	if err != nil {
		return err
	}
	if e == nil {
		return apperrors.New(http.StatusNotFound, "COMM_002", "commission entry not found", "")
	}
	now := time.Now()
	e.Status = models.CommissionStatusApproved
	e.ApprovedAt = &now
	return s.entryRepo.Update(e)
}

func (s *commissionService) CancelEntry(id uint) error {
	e, err := s.entryRepo.FindByID(id)
	if err != nil {
		return err
	}
	if e == nil {
		return apperrors.New(http.StatusNotFound, "COMM_002", "commission entry not found", "")
	}
	e.Status = models.CommissionStatusCancelled
	return s.entryRepo.Update(e)
}

func (s *commissionService) CreatePayout(staffID uint, periodStart, periodEnd string) (*models.CommissionPayout, error) {
	start, err := time.Parse("2006-01-02", periodStart)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid period_start, use YYYY-MM-DD")
	}
	end, err := time.Parse("2006-01-02", periodEnd)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid period_end, use YYYY-MM-DD")
	}
	entries, err := s.entryRepo.ListPendingByStaff(staffID)
	if err != nil {
		return nil, err
	}
	var total int64
	for _, e := range entries {
		if e.Status == models.CommissionStatusApproved {
			total += e.CommPaise
		}
	}
	payout := &models.CommissionPayout{
		StaffID:     staffID,
		PeriodStart: start,
		PeriodEnd:   end,
		TotalPaise:  total,
		Status:      "pending",
	}
	if err := s.payoutRepo.Create(payout); err != nil {
		return nil, err
	}
	return payout, nil
}

func (s *commissionService) MarkPayoutPaid(id uint) error {
	p, err := s.payoutRepo.FindByID(id)
	if err != nil {
		return err
	}
	if p == nil {
		return apperrors.New(http.StatusNotFound, "COMM_003", "payout not found", "")
	}
	now := time.Now()
	p.Status = "paid"
	p.PaidAt = &now
	return s.payoutRepo.Update(p)
}

func (s *commissionService) ListPayoutsByStaff(staffID uint, page, limit int) ([]*models.CommissionPayout, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.payoutRepo.ListByStaff(staffID, page, limit)
}
