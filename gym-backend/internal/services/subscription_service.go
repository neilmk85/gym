package services

import (
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type FreezeSubscriptionRequest struct {
	StartDate string `json:"start_date"` // YYYY-MM-DD
	EndDate   string `json:"end_date"`   // YYYY-MM-DD
	Reason    string `json:"reason"`
}

type UpgradeQuoteResponse struct {
	QuoteID        uint    `json:"quote_id"`
	SubscriptionID uint    `json:"subscription_id"`
	MemberID       uint    `json:"member_id"`
	FromPlanID     uint    `json:"from_plan_id"`
	ToPlanID       uint    `json:"to_plan_id"`
	DaysRemaining  int     `json:"days_remaining"`
	ProratedCredit float64 `json:"prorated_credit"`
	NewPlanCharge  float64 `json:"new_plan_charge"`
	AmountDue      float64 `json:"amount_due"`
	Currency       string  `json:"currency"`
	ExpiresAt      string  `json:"expires_at"`
}

type CreateSubscriptionRequest struct {
	MemberID             uint    `json:"member_id"`
	PlanID               uint    `json:"plan_id"`
	StartDate            string  `json:"start_date"` // YYYY-MM-DD, defaults to today
	PromoCode            string  `json:"promo_code"`
	AutoRenew            *bool   `json:"auto_renew"`
	ManualDiscountAmount float64 `json:"manual_discount_amount"` // must not exceed plan.MaxDiscountAmount
	// Couple / Group
	PartnerMemberID *uint `json:"partner_member_id"`
	GroupSubID      *uint `json:"group_sub_id"`
	GroupLeaderSub  bool  `json:"group_leader_sub"`
}

type PauseSubscriptionRequest struct {
	Days      int    `json:"days"`       // 1-365
	Months    int    `json:"months"`     // legacy field, ignored if Days > 0
	StartDate string `json:"start_date"` // YYYY-MM-DD; defaults to today if empty
	Reason    string `json:"reason"`
}

type CancelSubscriptionRequest struct {
	Reason   string `json:"reason"`
	Feedback string `json:"feedback"`
}

type UpgradeSubscriptionRequest struct {
	NewPlanID uint `json:"new_plan_id"`
}

type ExtendSubscriptionRequest struct {
	ExtraMonths int    `json:"extra_months"`
	ExtraDays   int    `json:"extra_days"`
	Reason      string `json:"reason"`
}

type TransferSubscriptionRequest struct {
	TargetMemberID    uint   `json:"target_member_id"`
	MonthsToTransfer  int    `json:"months_to_transfer"`
	TransferStartDate string `json:"transfer_start_date"` // YYYY-MM-DD
	TransferEndDate   string `json:"transfer_end_date"`   // YYYY-MM-DD
	Reason            string `json:"reason"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type SubscriptionService interface {
	Create(req CreateSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error)
	GetByID(id uint) (*models.Subscription, error)
	GetActiveByMember(memberID uint) (*models.Subscription, error)
	ListByMember(memberID uint, req utils.PageRequest) ([]*models.Subscription, int64, error)
	List(req utils.PageRequest) ([]*models.Subscription, int64, error)
	Pause(subID uint, req PauseSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error)
	Resume(subID uint, actorID uint, ipAddress string) (*models.Subscription, error)
	Cancel(subID uint, req CancelSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error)
	Upgrade(subID uint, req UpgradeSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error)
	Extend(subID uint, req ExtendSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error)
	SetAutoRenew(subID uint, autoRenew bool, actorID uint, ipAddress string) (*models.Subscription, error)

	// Freeze flow
	FreezeSubscription(subID uint, req FreezeSubscriptionRequest, actorID uint) (*models.SubscriptionFreeze, error)
	UnfreezeSubscription(freezeID uint, actorID uint) (*models.SubscriptionFreeze, error)
	ListFreezesBySubscription(subID uint) ([]*models.SubscriptionFreeze, error)

	// Upgrade quote flow (2-step)
	GetUpgradeQuote(subID uint, newPlanID uint, actorID uint) (*UpgradeQuoteResponse, error)
	ConfirmUpgradeWithQuote(quoteID uint, actorID uint, ipAddress string) (*models.Subscription, error)

	// Entitlement ledger
	GetEntitlementLedger(subID uint) ([]*models.EntitlementLedger, error)

	// Renew & Transfer
	Renew(subID uint, actorID uint) (*models.Subscription, error)
	Transfer(subID uint, req TransferSubscriptionRequest, actorID uint) (*models.Subscription, *models.Subscription, error)
	ListTransfers(req utils.PageRequest) ([]*repositories.TransferRow, int64, error)
}

type subscriptionService struct {
	subRepo      repositories.SubscriptionRepository
	memberRepo   repositories.MemberRepository
	planRepo     repositories.PlanRepository
	promoRepo    repositories.PromoCodeRepository
	auditRepo    repositories.AuditLogRepository
	freezeRepo   repositories.FreezeRepository
	ledgerRepo   repositories.EntitlementLedgerRepository
	transferRepo repositories.TransferRepository
	logger       *slog.Logger
}

func NewSubscriptionService(
	subRepo repositories.SubscriptionRepository,
	memberRepo repositories.MemberRepository,
	planRepo repositories.PlanRepository,
	promoRepo repositories.PromoCodeRepository,
	auditRepo repositories.AuditLogRepository,
	logger *slog.Logger,
) SubscriptionService {
	return &subscriptionService{
		subRepo:    subRepo,
		memberRepo: memberRepo,
		planRepo:   planRepo,
		promoRepo:  promoRepo,
		auditRepo:  auditRepo,
		logger:     logger,
	}
}

func NewSubscriptionServiceFull(
	subRepo repositories.SubscriptionRepository,
	memberRepo repositories.MemberRepository,
	planRepo repositories.PlanRepository,
	promoRepo repositories.PromoCodeRepository,
	auditRepo repositories.AuditLogRepository,
	freezeRepo repositories.FreezeRepository,
	ledgerRepo repositories.EntitlementLedgerRepository,
	transferRepo repositories.TransferRepository,
	logger *slog.Logger,
) SubscriptionService {
	return &subscriptionService{
		subRepo:      subRepo,
		memberRepo:   memberRepo,
		planRepo:     planRepo,
		promoRepo:    promoRepo,
		auditRepo:    auditRepo,
		freezeRepo:   freezeRepo,
		ledgerRepo:   ledgerRepo,
		transferRepo: transferRepo,
		logger:       logger,
	}
}

func (s *subscriptionService) Create(req CreateSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error) {
	if req.MemberID == 0 {
		return nil, apperrors.ErrValidation("member_id is required")
	}
	if req.PlanID == 0 {
		return nil, apperrors.ErrValidation("plan_id is required")
	}

	// Validate member exists.
	member, err := s.memberRepo.FindByID(req.MemberID)
	if err != nil || member == nil {
		return nil, apperrors.ErrMemberNotFound
	}

	// Validate plan exists and is active.
	plan, err := s.planRepo.FindByID(req.PlanID)
	if err != nil || plan == nil {
		return nil, apperrors.New(http.StatusNotFound, "PLN_001", "Plan not found", "")
	}
	if !plan.IsActive {
		return nil, apperrors.New(http.StatusConflict, "PLN_002", "Plan is not active", "")
	}

	// Check no active subscription exists.
	existing, err := s.subRepo.FindActiveByMember(req.MemberID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if existing != nil {
		return nil, apperrors.New(http.StatusConflict, "SUB_001", "Member already has an active subscription", "")
	}

	// Parse start date.
	startDate := time.Now().Truncate(24 * time.Hour)
	if req.StartDate != "" {
		parsed, err := time.Parse("2006-01-02", req.StartDate)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid start_date format, use YYYY-MM-DD")
		}
		startDate = parsed
	}
	endDate := startDate.AddDate(0, 0, plan.BillingPeriodDays)

	autoRenew := plan.AutoRenew
	if req.AutoRenew != nil {
		autoRenew = *req.AutoRenew
	}

	// Validate manual discount against plan percentage cap.
	if req.ManualDiscountAmount < 0 {
		return nil, apperrors.ErrValidation("discount cannot be negative")
	}
	if plan.MaxDiscountPercent > 0 {
		maxAllowed := plan.PriceAmount * plan.MaxDiscountPercent / 100
		if req.ManualDiscountAmount > maxAllowed {
			return nil, apperrors.ErrValidation(
				fmt.Sprintf("discount %.2f exceeds the maximum allowed discount of %.2f (%.0f%% of plan price) for this plan",
					req.ManualDiscountAmount, maxAllowed, plan.MaxDiscountPercent),
			)
		}
	} else if plan.MaxDiscountPercent == 0 && req.ManualDiscountAmount > 0 {
		return nil, apperrors.ErrValidation("no discount is allowed on this plan")
	}

	// Apply promo code if provided.
	originalAmount := plan.PriceAmount
	discountAmount := req.ManualDiscountAmount
	var promoCodeID *uint

	if req.PromoCode != "" {
		promo, promoDiscount, err := s.applyPromoCode(req.PromoCode, req.MemberID, plan, originalAmount)
		if err != nil {
			return nil, err
		}
		discountAmount += promoDiscount
		promoCodeID = &promo.ID
	}

	finalAmount := originalAmount - discountAmount
	if finalAmount < 0 {
		finalAmount = 0
	}

	var nextRenewal *time.Time
	if autoRenew {
		nr := endDate
		nextRenewal = &nr
	}

	sub := &models.Subscription{
		MemberID:        req.MemberID,
		PlanID:          req.PlanID,
		StartDate:       startDate,
		EndDate:         endDate,
		Status:          models.SubStatusActive,
		OriginalAmount:  originalAmount,
		DiscountAmount:  discountAmount,
		PromoCodeID:     promoCodeID,
		FinalAmount:     finalAmount,
		Currency:        plan.Currency,
		AutoRenew:       autoRenew,
		NextRenewalDate: nextRenewal,
		PartnerMemberID: req.PartnerMemberID,
		GroupSubID:      req.GroupSubID,
		GroupLeaderSub:  req.GroupLeaderSub,
	}

	if err := s.subRepo.Create(sub); err != nil {
		s.logger.Error("create subscription failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	// Record promo usage and update current plan on member.
	if promoCodeID != nil {
		_ = s.promoRepo.RecordUsage(&models.PromoCodeUsage{
			PromoCodeID:    *promoCodeID,
			MemberID:       req.MemberID,
			SubscriptionID: &sub.ID,
			DiscountAmount: discountAmount,
		})
		_ = s.promoRepo.IncrementUses(*promoCodeID)
	}

	planIDCopy := req.PlanID
	_ = s.memberRepo.UpdateCurrentSubscription(req.MemberID, &planIDCopy, &sub.ID)
	_ = s.memberRepo.UpdateStatus(req.MemberID, models.MemberStatusActive)

	s.auditSub(actorID, "subscription.create", sub.ID, nil, nil, ipAddress)

	// Reload with associations.
	created, err := s.subRepo.FindByID(sub.ID)
	if err != nil {
		return sub, nil
	}
	return created, nil
}

func (s *subscriptionService) GetByID(id uint) (*models.Subscription, error) {
	sub, err := s.subRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}
	return sub, nil
}

func (s *subscriptionService) GetActiveByMember(memberID uint) (*models.Subscription, error) {
	sub, err := s.subRepo.FindActiveByMember(memberID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_003", "No active subscription found", "")
	}
	return sub, nil
}

func (s *subscriptionService) ListByMember(memberID uint, req utils.PageRequest) ([]*models.Subscription, int64, error) {
	return s.subRepo.ListByMember(memberID, req)
}

func (s *subscriptionService) List(req utils.PageRequest) ([]*models.Subscription, int64, error) {
	return s.subRepo.List(req)
}

func (s *subscriptionService) Pause(subID uint, req PauseSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error) {
	// Prefer days; fall back to months (legacy) converted to days.
	days := req.Days
	if days <= 0 && req.Months > 0 {
		days = req.Months * 30
	}
	if days < 1 || days > 365 {
		return nil, apperrors.ErrValidation("pause duration must be between 1 and 365 days")
	}

	sub, err := s.subRepo.FindByID(subID)
	if err != nil || sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}
	if sub.Status != models.SubStatusActive {
		return nil, apperrors.New(http.StatusConflict, "SUB_004", "Cannot pause", "Subscription is not active")
	}
	if sub.PauseCount >= 2 {
		return nil, apperrors.New(http.StatusConflict, "SUB_005", "Pause limit reached", "Maximum 2 pauses per subscription")
	}

	now := time.Now()

	// Determine pause start date (defaults to today).
	pauseStart := now
	if req.StartDate != "" {
		if parsed, err := time.Parse("2006-01-02", req.StartDate); err == nil {
			pauseStart = parsed
		}
	}
	pausedUntil := pauseStart.AddDate(0, 0, days)

	// Extend end date by pause duration.
	sub.EndDate = sub.EndDate.AddDate(0, 0, days)
	sub.Status = models.SubStatusPaused
	sub.PausedAt = &pauseStart
	sub.PausedUntil = &pausedUntil
	sub.PauseReason = req.Reason
	sub.PauseCount++
	if sub.NextRenewalDate != nil {
		extended := sub.NextRenewalDate.AddDate(0, 0, days)
		sub.NextRenewalDate = &extended
	}

	if err := s.subRepo.Update(sub); err != nil {
		return nil, apperrors.ErrInternal
	}

	_ = s.memberRepo.UpdateStatus(sub.MemberID, models.MemberStatusPaused)
	s.auditSub(actorID, "subscription.pause", subID, nil, nil, ipAddress)

	return sub, nil
}

func (s *subscriptionService) Resume(subID uint, actorID uint, ipAddress string) (*models.Subscription, error) {
	sub, err := s.subRepo.FindByID(subID)
	if err != nil || sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}
	if sub.Status != models.SubStatusPaused {
		return nil, apperrors.New(http.StatusConflict, "SUB_006", "Cannot resume", "Subscription is not paused")
	}

	sub.Status = models.SubStatusActive
	sub.PausedAt = nil
	sub.PausedUntil = nil
	sub.PauseReason = ""

	if err := s.subRepo.Update(sub); err != nil {
		return nil, apperrors.ErrInternal
	}

	_ = s.memberRepo.UpdateStatus(sub.MemberID, models.MemberStatusActive)
	s.auditSub(actorID, "subscription.resume", subID, nil, nil, ipAddress)

	return sub, nil
}

func (s *subscriptionService) Cancel(subID uint, req CancelSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error) {
	sub, err := s.subRepo.FindByID(subID)
	if err != nil || sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}
	if sub.Status == models.SubStatusCancelled {
		return nil, apperrors.New(http.StatusConflict, "SUB_007", "Already cancelled", "")
	}

	now := time.Now()
	sub.Status = models.SubStatusCancelled
	sub.CancelledAt = &now
	sub.CancellationReason = req.Reason
	sub.CancellationFeedback = req.Feedback
	sub.AutoRenew = false
	sub.NextRenewalDate = nil

	if err := s.subRepo.Update(sub); err != nil {
		return nil, apperrors.ErrInternal
	}

	_ = s.memberRepo.UpdateCurrentSubscription(sub.MemberID, nil, nil)
	_ = s.memberRepo.UpdateStatus(sub.MemberID, models.MemberStatusCancelled)

	s.auditSub(actorID, "subscription.cancel", subID, models.JSONMap{"reason": req.Reason}, nil, ipAddress)

	return sub, nil
}

func (s *subscriptionService) Upgrade(subID uint, req UpgradeSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error) {
	if req.NewPlanID == 0 {
		return nil, apperrors.ErrValidation("new_plan_id is required")
	}

	sub, err := s.subRepo.FindByID(subID)
	if err != nil || sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}
	if sub.Status != models.SubStatusActive {
		return nil, apperrors.New(http.StatusConflict, "SUB_008", "Cannot upgrade", "Subscription is not active")
	}
	if sub.PlanID == req.NewPlanID {
		return nil, apperrors.ErrValidation("new_plan_id must differ from current plan")
	}

	newPlan, err := s.planRepo.FindByID(req.NewPlanID)
	if err != nil || newPlan == nil {
		return nil, apperrors.New(http.StatusNotFound, "PLN_001", "Plan not found", "")
	}
	if !newPlan.IsActive {
		return nil, apperrors.New(http.StatusConflict, "PLN_002", "Plan is not active", "")
	}

	// Proration: calculate remaining days and compute credit.
	now := time.Now()
	remainingDays := int(sub.EndDate.Sub(now).Hours() / 24)
	if remainingDays < 0 {
		remainingDays = 0
	}

	oldPlan, err := s.planRepo.FindByID(sub.PlanID)
	if err != nil || oldPlan == nil {
		return nil, apperrors.ErrInternal
	}

	dailyOldRate := sub.FinalAmount / float64(oldPlan.BillingPeriodDays)
	credit := dailyOldRate * float64(remainingDays)

	newAmount := newPlan.PriceAmount - credit
	if newAmount < 0 {
		newAmount = 0
	}

	// Cancel current subscription and create new one.
	sub.Status = models.SubStatusCancelled
	cancelledAt := now
	sub.CancelledAt = &cancelledAt
	sub.CancellationReason = "upgraded to plan " + newPlan.Name
	sub.AutoRenew = false
	sub.NextRenewalDate = nil
	if err := s.subRepo.Update(sub); err != nil {
		return nil, apperrors.ErrInternal
	}

	endDate := now.Truncate(24 * time.Hour).AddDate(0, 0, newPlan.BillingPeriodDays)
	var nextRenewal *time.Time
	if newPlan.AutoRenew {
		nr := endDate
		nextRenewal = &nr
	}

	newSub := &models.Subscription{
		MemberID:       sub.MemberID,
		PlanID:         req.NewPlanID,
		StartDate:      now.Truncate(24 * time.Hour),
		EndDate:        endDate,
		Status:         models.SubStatusActive,
		OriginalAmount: newPlan.PriceAmount,
		DiscountAmount: newPlan.PriceAmount - newAmount,
		FinalAmount:    newAmount,
		Currency:       newPlan.Currency,
		AutoRenew:      newPlan.AutoRenew,
		NextRenewalDate: nextRenewal,
	}

	if err := s.subRepo.Create(newSub); err != nil {
		s.logger.Error("create upgraded subscription failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	upgradedPlanID := req.NewPlanID
	_ = s.memberRepo.UpdateCurrentSubscription(sub.MemberID, &upgradedPlanID, &newSub.ID)

	s.auditSub(actorID, "subscription.upgrade", subID,
		models.JSONMap{"old_plan_id": sub.PlanID},
		models.JSONMap{"new_plan_id": req.NewPlanID, "new_sub_id": newSub.ID},
		ipAddress)

	created, err := s.subRepo.FindByID(newSub.ID)
	if err != nil {
		return newSub, nil
	}
	return created, nil
}

func (s *subscriptionService) Extend(subID uint, req ExtendSubscriptionRequest, actorID uint, ipAddress string) (*models.Subscription, error) {
	if req.ExtraMonths <= 0 && req.ExtraDays <= 0 {
		return nil, apperrors.ErrValidation("extra_months or extra_days must be greater than 0")
	}

	sub, err := s.subRepo.FindByID(subID)
	if err != nil || sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}
	if sub.Status != models.SubStatusActive && sub.Status != models.SubStatusPaused {
		return nil, apperrors.New(http.StatusConflict, "SUB_009", "Cannot extend", "Subscription is not active or paused")
	}

	sub.EndDate = sub.EndDate.AddDate(0, req.ExtraMonths, req.ExtraDays)
	sub.FreeMonthsAdded += req.ExtraMonths
	sub.FreeDaysAdded += req.ExtraDays
	if sub.NextRenewalDate != nil {
		nr := sub.NextRenewalDate.AddDate(0, req.ExtraMonths, req.ExtraDays)
		sub.NextRenewalDate = &nr
	}

	if err := s.subRepo.Update(sub); err != nil {
		return nil, err
	}

	s.auditSub(actorID, "extend_subscription", subID, nil, models.JSONMap{"reason": req.Reason, "extra_months": req.ExtraMonths, "extra_days": req.ExtraDays}, ipAddress)

	updated, err := s.subRepo.FindByID(sub.ID)
	if err != nil {
		return sub, nil
	}
	return updated, nil
}

func (s *subscriptionService) SetAutoRenew(subID uint, autoRenew bool, actorID uint, ipAddress string) (*models.Subscription, error) {
	sub, err := s.subRepo.FindByID(subID)
	if err != nil || sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}

	sub.AutoRenew = autoRenew
	if !autoRenew {
		sub.NextRenewalDate = nil
	} else {
		nr := sub.EndDate
		sub.NextRenewalDate = &nr
	}

	if err := s.subRepo.Update(sub); err != nil {
		return nil, apperrors.ErrInternal
	}

	s.auditSub(actorID, "subscription.auto_renew", subID, nil,
		models.JSONMap{"auto_renew": autoRenew}, ipAddress)

	return sub, nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (s *subscriptionService) applyPromoCode(code string, memberID uint, plan *models.Plan, originalAmount float64) (*models.PromoCode, float64, error) {
	promo, err := s.promoRepo.FindByCode(code)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	if promo == nil {
		return nil, 0, apperrors.New(http.StatusNotFound, "PRO_001", "Promo code not found or inactive", "")
	}

	now := time.Now()
	if promo.ValidFrom != nil && now.Before(*promo.ValidFrom) {
		return nil, 0, apperrors.New(http.StatusConflict, "PRO_002", "Promo code not yet valid", "")
	}
	if promo.ValidUntil != nil && now.After(*promo.ValidUntil) {
		return nil, 0, apperrors.New(http.StatusConflict, "PRO_003", "Promo code has expired", "")
	}
	if promo.MaxUses != nil && promo.CurrentUses >= *promo.MaxUses {
		return nil, 0, apperrors.New(http.StatusConflict, "PRO_004", "Promo code usage limit reached", "")
	}

	// Per-member usage check.
	usageCount, err := s.promoRepo.CountUsageByMember(promo.ID, memberID)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	if int(usageCount) >= promo.MaxUsesPerMember {
		return nil, 0, apperrors.New(http.StatusConflict, "PRO_005", "Promo code already used by this member", "")
	}

	var discount float64
	switch promo.DiscountType {
	case models.DiscountTypePercentage:
		discount = originalAmount * (promo.DiscountValue / 100)
	case models.DiscountTypeFixedAmount:
		discount = promo.DiscountValue
	case models.DiscountTypeFreeMonth:
		discount = originalAmount // One free month = full price off
	case models.DiscountTypeBOGO:
		discount = originalAmount // Buy one get one = second period free
	}

	if discount > originalAmount {
		discount = originalAmount
	}

	return promo, discount, nil
}

func (s *subscriptionService) auditSub(userID uint, action string, resourceID uint, old, new models.JSONMap, ip string) {
	rid := resourceID
	_ = s.auditRepo.Create(&models.AuditLog{
		UserID:       userID,
		Action:       action,
		ResourceType: "subscription",
		ResourceID:   &rid,
		OldValues:    old,
		NewValues:    new,
		IPAddress:    ip,
	})
}

// ─── Freeze ───────────────────────────────────────────────────────────────────

func (s *subscriptionService) FreezeSubscription(subID uint, req FreezeSubscriptionRequest, actorID uint) (*models.SubscriptionFreeze, error) {
	if s.freezeRepo == nil {
		return nil, apperrors.ErrInternal
	}
	if req.StartDate == "" || req.EndDate == "" {
		return nil, apperrors.ErrValidation("start_date and end_date are required (YYYY-MM-DD)")
	}

	start, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid start_date")
	}
	end, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid end_date")
	}
	if !end.After(start) {
		return nil, apperrors.ErrValidation("end_date must be after start_date")
	}

	sub, err := s.subRepo.FindByID(subID)
	if err != nil || sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}
	if sub.Status != models.SubStatusActive {
		return nil, apperrors.New(http.StatusConflict, "SUB_010", "Cannot freeze a non-active subscription", "")
	}

	overlap, err := s.freezeRepo.HasOverlap(subID, req.StartDate, req.EndDate, 0)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if overlap {
		return nil, apperrors.New(http.StatusConflict, "FRZ_001", "Freeze period overlaps with an existing freeze", "")
	}

	extensionDays := int(end.Sub(start).Hours() / 24)

	freeze := &models.SubscriptionFreeze{
		SubscriptionID:   subID,
		MemberID:         sub.MemberID,
		StartDate:        start,
		EndDate:          end,
		Reason:           req.Reason,
		Status:           "active",
		ExtensionDays:    extensionDays,
		ExtensionApplied: false,
		CreatedByID:      actorID,
	}

	if err := s.freezeRepo.Create(freeze); err != nil {
		return nil, apperrors.ErrInternal
	}

	// Extend subscription end date
	oldEnd := sub.EndDate
	sub.EndDate = sub.EndDate.AddDate(0, 0, extensionDays)
	sub.FreezeCount++
	sub.TotalFrozenDays += extensionDays
	if sub.NextRenewalDate != nil {
		nr := sub.NextRenewalDate.AddDate(0, 0, extensionDays)
		sub.NextRenewalDate = &nr
	}
	if err := s.subRepo.Update(sub); err != nil {
		return nil, apperrors.ErrInternal
	}

	freeze.ExtensionApplied = true
	_ = s.freezeRepo.Update(freeze)

	// Record ledger event
	if s.ledgerRepo != nil {
		newEnd := sub.EndDate
		_ = s.ledgerRepo.Create(&models.EntitlementLedger{
			MemberID:       sub.MemberID,
			SubscriptionID: subID,
			EventType:      "frozen",
			Description:    "Subscription frozen: " + req.Reason,
			DaysAffected:   extensionDays,
			OldEndDate:     &oldEnd,
			NewEndDate:     &newEnd,
			ActorID:        actorID,
			ReferenceID:    &freeze.ID,
			ReferenceType:  "subscription_freeze",
		})
	}

	return freeze, nil
}

func (s *subscriptionService) UnfreezeSubscription(freezeID uint, actorID uint) (*models.SubscriptionFreeze, error) {
	if s.freezeRepo == nil {
		return nil, apperrors.ErrInternal
	}

	freeze, err := s.freezeRepo.FindByID(freezeID)
	if err != nil || freeze == nil {
		return nil, apperrors.New(http.StatusNotFound, "FRZ_002", "Freeze not found", "")
	}
	if freeze.Status == "completed" || freeze.Status == "cancelled" {
		return nil, apperrors.New(http.StatusConflict, "FRZ_003", "Freeze is already ended", "")
	}

	freeze.Status = "completed"
	now := time.Now()
	freeze.ApprovedAt = &now
	freeze.ApprovedByID = &actorID

	if err := s.freezeRepo.Update(freeze); err != nil {
		return nil, apperrors.ErrInternal
	}

	if s.ledgerRepo != nil {
		sub, _ := s.subRepo.FindByID(freeze.SubscriptionID)
		if sub != nil {
			endDate := sub.EndDate
			_ = s.ledgerRepo.Create(&models.EntitlementLedger{
				MemberID:       freeze.MemberID,
				SubscriptionID: freeze.SubscriptionID,
				EventType:      "unfrozen",
				Description:    "Subscription unfrozen",
				ActorID:        actorID,
				NewEndDate:     &endDate,
				ReferenceID:    &freezeID,
				ReferenceType:  "subscription_freeze",
			})
		}
	}

	return freeze, nil
}

func (s *subscriptionService) ListFreezesBySubscription(subID uint) ([]*models.SubscriptionFreeze, error) {
	if s.freezeRepo == nil {
		return nil, apperrors.ErrInternal
	}
	return s.freezeRepo.ListBySubscription(subID)
}

// ─── Upgrade Quote ────────────────────────────────────────────────────────────

func (s *subscriptionService) GetUpgradeQuote(subID uint, newPlanID uint, actorID uint) (*UpgradeQuoteResponse, error) {
	if newPlanID == 0 {
		return nil, apperrors.ErrValidation("new_plan_id is required")
	}

	sub, err := s.subRepo.FindByID(subID)
	if err != nil || sub == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
	}
	if sub.Status != models.SubStatusActive {
		return nil, apperrors.New(http.StatusConflict, "SUB_008", "Cannot upgrade a non-active subscription", "")
	}
	if sub.PlanID == newPlanID {
		return nil, apperrors.ErrValidation("new_plan_id must differ from current plan")
	}

	newPlan, err := s.planRepo.FindByID(newPlanID)
	if err != nil || newPlan == nil {
		return nil, apperrors.New(http.StatusNotFound, "PLN_001", "Plan not found", "")
	}
	if !newPlan.IsActive {
		return nil, apperrors.New(http.StatusConflict, "PLN_002", "Plan is not active", "")
	}

	oldPlan, err := s.planRepo.FindByID(sub.PlanID)
	if err != nil || oldPlan == nil {
		return nil, apperrors.ErrInternal
	}

	now := time.Now()
	daysRemaining := int(math.Max(0, sub.EndDate.Sub(now).Hours()/24))
	dailyRate := sub.FinalAmount / float64(oldPlan.BillingPeriodDays)
	proratedCredit := dailyRate * float64(daysRemaining)
	amountDue := newPlan.PriceAmount - proratedCredit
	if amountDue < 0 {
		amountDue = 0
	}

	expiresAt := now.Add(24 * time.Hour)

	quote := &models.UpgradeQuote{
		SubscriptionID: subID,
		MemberID:       sub.MemberID,
		FromPlanID:     sub.PlanID,
		ToPlanID:       newPlanID,
		DaysRemaining:  daysRemaining,
		ProratedCredit: roundF2(proratedCredit),
		NewPlanCharge:  newPlan.PriceAmount,
		AmountDue:      roundF2(amountDue),
		Currency:       sub.Currency,
		ExpiresAt:      expiresAt,
		Used:           false,
		CreatedByID:    actorID,
	}

	// Persist using the upgrade_quote model directly (no special repo needed)
	// Use gorm through subRepo's DB — but UpgradeQuote doesn't have its own repo yet.
	// We'll return the in-memory quote and also optionally save it.
	// For now return computed quote; ConfirmUpgrade accepts quoteID 0 meaning "use latest quote".

	return &UpgradeQuoteResponse{
		QuoteID:        quote.ID,
		SubscriptionID: quote.SubscriptionID,
		MemberID:       quote.MemberID,
		FromPlanID:     quote.FromPlanID,
		ToPlanID:       quote.ToPlanID,
		DaysRemaining:  quote.DaysRemaining,
		ProratedCredit: quote.ProratedCredit,
		NewPlanCharge:  quote.NewPlanCharge,
		AmountDue:      quote.AmountDue,
		Currency:       quote.Currency,
		ExpiresAt:      expiresAt.Format(time.RFC3339),
	}, nil
}

func (s *subscriptionService) ConfirmUpgradeWithQuote(quoteID uint, actorID uint, ipAddress string) (*models.Subscription, error) {
	// Delegate to existing Upgrade method (quote lookup not persisted yet)
	return nil, apperrors.New(http.StatusNotImplemented, "UPG_001", "Use POST /subscriptions/{id}/upgrade directly", "")
}

func (s *subscriptionService) GetEntitlementLedger(subID uint) ([]*models.EntitlementLedger, error) {
	if s.ledgerRepo == nil {
		return []*models.EntitlementLedger{}, nil
	}
	return s.ledgerRepo.ListBySubscription(subID)
}

func roundF2(v float64) float64 {
	return float64(int(v*100+0.5)) / 100
}

// Renew creates a new active subscription for the same member and plan.
func (s *subscriptionService) Renew(subID uint, actorID uint) (*models.Subscription, error) {
	src, err := s.subRepo.FindByID(subID)
	if err != nil || src == nil {
		return nil, apperrors.New(http.StatusNotFound, "SUB_404", "Subscription not found", "")
	}
	if src.Status != models.SubStatusExpired {
		return nil, apperrors.ErrValidation("only expired subscriptions can be renewed")
	}

	plan, err := s.planRepo.FindByID(src.PlanID)
	if err != nil || plan == nil {
		return nil, apperrors.New(http.StatusNotFound, "PLN_404", "Plan not found", "")
	}

	startDate := time.Now().Truncate(24 * time.Hour)
	endDate := startDate.AddDate(0, 0, plan.BillingPeriodDays)

	newSub := &models.Subscription{
		MemberID:       src.MemberID,
		PlanID:         src.PlanID,
		StartDate:      startDate,
		EndDate:        endDate,
		Status:         models.SubStatusActive,
		OriginalAmount: plan.PriceAmount,
		FinalAmount:    plan.PriceAmount,
		Currency:       plan.Currency,
		AutoRenew:      plan.AutoRenew,
	}
	if err := s.subRepo.Create(newSub); err != nil {
		return nil, apperrors.ErrInternal
	}
	return newSub, nil
}

// Transfer ends the source subscription and creates a new one for the target member.
func (s *subscriptionService) Transfer(subID uint, req TransferSubscriptionRequest, actorID uint) (*models.Subscription, *models.Subscription, error) {
	if req.TargetMemberID == 0 {
		return nil, nil, apperrors.ErrValidation("target_member_id is required")
	}
	if req.MonthsToTransfer < 1 {
		return nil, nil, apperrors.ErrValidation("months_to_transfer must be at least 1")
	}

	src, err := s.subRepo.FindByID(subID)
	if err != nil || src == nil {
		return nil, nil, apperrors.New(http.StatusNotFound, "SUB_404", "Subscription not found", "")
	}
	if src.Status != models.SubStatusActive {
		return nil, nil, apperrors.ErrValidation("only active subscriptions can be transferred")
	}
	if src.MemberID == req.TargetMemberID {
		return nil, nil, apperrors.ErrValidation("cannot transfer to the same member")
	}

	tgtMember, err := s.memberRepo.FindByID(req.TargetMemberID)
	if err != nil || tgtMember == nil {
		return nil, nil, apperrors.ErrMemberNotFound
	}

	tStart, err := time.Parse("2006-01-02", req.TransferStartDate)
	if err != nil {
		return nil, nil, apperrors.ErrValidation("invalid transfer_start_date, use YYYY-MM-DD")
	}
	tEnd, err := time.Parse("2006-01-02", req.TransferEndDate)
	if err != nil {
		return nil, nil, apperrors.ErrValidation("invalid transfer_end_date, use YYYY-MM-DD")
	}

	// End the source subscription at the transfer start date.
	src.EndDate = tStart.Add(-24 * time.Hour) // end the day before transfer starts
	if !src.EndDate.After(src.StartDate) {
		src.EndDate = src.StartDate
	}
	src.Status = models.SubStatusCancelled
	src.CancellationReason = fmt.Sprintf("transferred to member id %d", req.TargetMemberID)
	now := time.Now()
	src.CancelledAt = &now
	if err := s.subRepo.Update(src); err != nil {
		return nil, nil, apperrors.ErrInternal
	}

	// Create new subscription for the target member.
	plan, err := s.planRepo.FindByID(src.PlanID)
	if err != nil || plan == nil {
		return nil, nil, apperrors.New(http.StatusNotFound, "PLN_404", "Plan not found", "")
	}

	newSub := &models.Subscription{
		MemberID:       req.TargetMemberID,
		PlanID:         src.PlanID,
		StartDate:      tStart,
		EndDate:        tEnd,
		Status:         models.SubStatusActive,
		OriginalAmount: plan.PriceAmount,
		FinalAmount:    plan.PriceAmount,
		Currency:       plan.Currency,
		AutoRenew:      false,
	}
	if err := s.subRepo.Create(newSub); err != nil {
		return nil, nil, apperrors.ErrInternal
	}

	// Record the transfer.
	if s.transferRepo != nil {
		t := &models.SubscriptionTransfer{
			SourceSubscriptionID: subID,
			NewSubscriptionID:    &newSub.ID,
			SourceMemberID:       src.MemberID,
			TargetMemberID:       req.TargetMemberID,
			PlanID:               src.PlanID,
			MonthsTransferred:    req.MonthsToTransfer,
			TransferStartDate:    tStart,
			TransferEndDate:      tEnd,
			Reason:               req.Reason,
			TransferredByID:      actorID,
		}
		_ = s.transferRepo.Create(t)
	}

	return src, newSub, nil
}

// ListTransfers returns paginated transfer history.
func (s *subscriptionService) ListTransfers(req utils.PageRequest) ([]*repositories.TransferRow, int64, error) {
	if s.transferRepo == nil {
		return []*repositories.TransferRow{}, 0, nil
	}
	return s.transferRepo.List(req)
}
