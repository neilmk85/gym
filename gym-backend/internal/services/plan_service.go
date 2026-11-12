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

// ─── DTOs ────────────────────────────────────────────────────────────────────

type CreatePlanRequest struct {
	FacilityID             uint    `json:"facility_id"`
	Name                   string  `json:"name"`
	Description            string  `json:"description"`
	Type                   string  `json:"type"`
	MemberCategory         string  `json:"member_category"`
	Gender                 string  `json:"gender"`
	MinMembers             int     `json:"min_members"`
	MaxMembers             int     `json:"max_members"`
	ActivityType           string  `json:"activity_type"`
	IsOffer                bool    `json:"is_offer"`
	OfferLabel             string  `json:"offer_label"`
	OfferValidUntil        string  `json:"offer_valid_until"`
	OriginalPrice          float64 `json:"original_price"`
	BillingPeriodDays      int     `json:"billing_period_days"`
	PriceAmount            float64 `json:"price_amount"`
	Currency               string  `json:"currency"`
	MaxClassesPerMonth     *int    `json:"max_classes_per_month"`
	MaxPTSessionsPerMonth  *int    `json:"max_pt_sessions_per_month"`
	GroupClassAccess       bool    `json:"group_class_access"`
	PTAccess               bool    `json:"pt_access"`
	LockerAccess           bool    `json:"locker_access"`
	FacilityAccess         bool    `json:"facility_access"`
	AutoRenew              bool    `json:"auto_renew"`
	GracePeriodDays        int     `json:"grace_period_days"`
	CancellationNoticeDays int     `json:"cancellation_notice_days"`
	DisplayOrder           int     `json:"display_order"`
}

type UpdatePlanRequest struct {
	Name                   string   `json:"name"`
	Description            string   `json:"description"`
	Type                   string   `json:"type"`
	MemberCategory         *string  `json:"member_category"`
	Gender                 *string  `json:"gender"`
	MinMembers             *int     `json:"min_members"`
	MaxMembers             *int     `json:"max_members"`
	ActivityType           *string  `json:"activity_type"`
	IsOffer                *bool    `json:"is_offer"`
	OfferLabel             *string  `json:"offer_label"`
	OfferValidUntil        *string  `json:"offer_valid_until"`
	OriginalPrice          *float64 `json:"original_price"`
	BillingPeriodDays      int      `json:"billing_period_days"`
	PriceAmount            *float64 `json:"price_amount"`
	Currency               string   `json:"currency"`
	MaxClassesPerMonth     *int     `json:"max_classes_per_month"`
	MaxPTSessionsPerMonth  *int     `json:"max_pt_sessions_per_month"`
	GroupClassAccess       *bool    `json:"group_class_access"`
	PTAccess               *bool    `json:"pt_access"`
	LockerAccess           *bool    `json:"locker_access"`
	FacilityAccess         *bool    `json:"facility_access"`
	AutoRenew              *bool    `json:"auto_renew"`
	GracePeriodDays        *int     `json:"grace_period_days"`
	CancellationNoticeDays *int     `json:"cancellation_notice_days"`
	DisplayOrder           *int     `json:"display_order"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type PlanService interface {
	Create(req CreatePlanRequest, actorID uint, ipAddress string) (*models.Plan, error)
	GetByID(id uint) (*models.Plan, error)
	List(req utils.PageRequest, facilityID *uint, activeOnly bool, gender, memberCategory string) ([]*models.Plan, int64, error)
	Update(id uint, req UpdatePlanRequest, actorID uint, ipAddress string) (*models.Plan, error)
	Deactivate(id uint, actorID uint, ipAddress string) error
	Activate(id uint, actorID uint, ipAddress string) error
}

type planService struct {
	planRepo  repositories.PlanRepository
	auditRepo repositories.AuditLogRepository
	logger    *slog.Logger
}

func NewPlanService(
	planRepo repositories.PlanRepository,
	auditRepo repositories.AuditLogRepository,
	logger *slog.Logger,
) PlanService {
	return &planService{
		planRepo:  planRepo,
		auditRepo: auditRepo,
		logger:    logger,
	}
}

func (s *planService) Create(req CreatePlanRequest, actorID uint, ipAddress string) (*models.Plan, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("facility_id is required")
	}
	if req.PriceAmount < 0 {
		return nil, apperrors.ErrValidation("price_amount cannot be negative")
	}
	if req.BillingPeriodDays <= 0 {
		req.BillingPeriodDays = 30
	}

	planType := req.Type
	if planType == "" {
		planType = models.PlanTypeStandard
	}
	if !isValidPlanType(planType) {
		return nil, apperrors.ErrValidation("invalid plan type")
	}

	currency := req.Currency
	if currency == "" {
		currency = "INR"
	}

	memberCategory := req.MemberCategory
	if memberCategory == "" {
		memberCategory = "individual"
	}
	gender := req.Gender
	if gender == "" {
		gender = "any"
	}
	activityType := req.ActivityType
	if activityType == "" {
		activityType = "all"
	}
	minMembers := req.MinMembers
	if minMembers <= 0 {
		minMembers = 1
	}
	maxMembers := req.MaxMembers
	if maxMembers <= 0 {
		switch memberCategory {
		case "couple":
			maxMembers = 2
		case "group":
			maxMembers = 10
		default:
			maxMembers = 1
		}
	}

	var offerValidUntil *time.Time
	if req.OfferValidUntil != "" {
		if t, err := time.Parse("2006-01-02", req.OfferValidUntil); err == nil {
			offerValidUntil = &t
		}
	}

	plan := &models.Plan{
		FacilityID:             req.FacilityID,
		Name:                   req.Name,
		Description:            req.Description,
		Type:                   planType,
		MemberCategory:         memberCategory,
		Gender:                 gender,
		MinMembers:             minMembers,
		MaxMembers:             maxMembers,
		ActivityType:           activityType,
		IsOffer:                req.IsOffer,
		OfferLabel:             req.OfferLabel,
		OfferValidUntil:        offerValidUntil,
		OriginalPrice:          req.OriginalPrice,
		BillingPeriodDays:      req.BillingPeriodDays,
		PriceAmount:            req.PriceAmount,
		Currency:               currency,
		MaxClassesPerMonth:     req.MaxClassesPerMonth,
		MaxPTSessionsPerMonth:  req.MaxPTSessionsPerMonth,
		GroupClassAccess:       req.GroupClassAccess,
		PTAccess:               req.PTAccess,
		LockerAccess:           req.LockerAccess,
		FacilityAccess:         req.FacilityAccess,
		AutoRenew:              req.AutoRenew,
		GracePeriodDays:        req.GracePeriodDays,
		CancellationNoticeDays: req.CancellationNoticeDays,
		IsActive:               true,
		DisplayOrder:           req.DisplayOrder,
	}
	if plan.GracePeriodDays == 0 {
		plan.GracePeriodDays = 3
	}
	if plan.CancellationNoticeDays == 0 {
		plan.CancellationNoticeDays = 7
	}

	if err := s.planRepo.Create(plan); err != nil {
		s.logger.Error("create plan failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	s.auditPlan(actorID, "plan.create", plan.ID, nil, nil, ipAddress)
	return plan, nil
}

func (s *planService) GetByID(id uint) (*models.Plan, error) {
	plan, err := s.planRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if plan == nil {
		return nil, apperrors.New(http.StatusNotFound, "PLN_001", "Plan not found", "")
	}
	return plan, nil
}

func (s *planService) List(req utils.PageRequest, facilityID *uint, activeOnly bool, gender, memberCategory string) ([]*models.Plan, int64, error) {
	return s.planRepo.List(req, facilityID, activeOnly, gender, memberCategory)
}

func (s *planService) Update(id uint, req UpdatePlanRequest, actorID uint, ipAddress string) (*models.Plan, error) {
	plan, err := s.planRepo.FindByID(id)
	if err != nil || plan == nil {
		return nil, apperrors.New(http.StatusNotFound, "PLN_001", "Plan not found", "")
	}

	if req.Name != "" {
		plan.Name = req.Name
	}
	if req.Description != "" {
		plan.Description = req.Description
	}
	if req.Type != "" {
		if !isValidPlanType(req.Type) {
			return nil, apperrors.ErrValidation("invalid plan type")
		}
		plan.Type = req.Type
	}
	if req.BillingPeriodDays > 0 {
		plan.BillingPeriodDays = req.BillingPeriodDays
	}
	if req.PriceAmount != nil {
		plan.PriceAmount = *req.PriceAmount
	}
	if req.Currency != "" {
		plan.Currency = req.Currency
	}
	if req.MaxClassesPerMonth != nil {
		plan.MaxClassesPerMonth = req.MaxClassesPerMonth
	}
	if req.MaxPTSessionsPerMonth != nil {
		plan.MaxPTSessionsPerMonth = req.MaxPTSessionsPerMonth
	}
	if req.GroupClassAccess != nil {
		plan.GroupClassAccess = *req.GroupClassAccess
	}
	if req.PTAccess != nil {
		plan.PTAccess = *req.PTAccess
	}
	if req.LockerAccess != nil {
		plan.LockerAccess = *req.LockerAccess
	}
	if req.FacilityAccess != nil {
		plan.FacilityAccess = *req.FacilityAccess
	}
	if req.AutoRenew != nil {
		plan.AutoRenew = *req.AutoRenew
	}
	if req.GracePeriodDays != nil {
		plan.GracePeriodDays = *req.GracePeriodDays
	}
	if req.CancellationNoticeDays != nil {
		plan.CancellationNoticeDays = *req.CancellationNoticeDays
	}
	if req.DisplayOrder != nil {
		plan.DisplayOrder = *req.DisplayOrder
	}
	if req.MemberCategory != nil {
		plan.MemberCategory = *req.MemberCategory
	}
	if req.Gender != nil {
		plan.Gender = *req.Gender
	}
	if req.MinMembers != nil {
		plan.MinMembers = *req.MinMembers
	}
	if req.MaxMembers != nil {
		plan.MaxMembers = *req.MaxMembers
	}
	if req.ActivityType != nil {
		plan.ActivityType = *req.ActivityType
	}
	if req.IsOffer != nil {
		plan.IsOffer = *req.IsOffer
	}
	if req.OfferLabel != nil {
		plan.OfferLabel = *req.OfferLabel
	}
	if req.OfferValidUntil != nil {
		if *req.OfferValidUntil == "" {
			plan.OfferValidUntil = nil
		} else if t, err := time.Parse("2006-01-02", *req.OfferValidUntil); err == nil {
			plan.OfferValidUntil = &t
		}
	}
	if req.OriginalPrice != nil {
		plan.OriginalPrice = *req.OriginalPrice
	}

	if err := s.planRepo.Update(plan); err != nil {
		return nil, apperrors.ErrInternal
	}

	s.auditPlan(actorID, "plan.update", plan.ID, nil, nil, ipAddress)
	return plan, nil
}

func (s *planService) Deactivate(id uint, actorID uint, ipAddress string) error {
	plan, err := s.planRepo.FindByID(id)
	if err != nil || plan == nil {
		return apperrors.New(http.StatusNotFound, "PLN_001", "Plan not found", "")
	}
	if err := s.planRepo.Deactivate(id); err != nil {
		return apperrors.ErrInternal
	}
	s.auditPlan(actorID, "plan.deactivate", id, nil, nil, ipAddress)
	return nil
}

func (s *planService) Activate(id uint, actorID uint, ipAddress string) error {
	plan, err := s.planRepo.FindByID(id)
	if err != nil || plan == nil {
		return apperrors.New(http.StatusNotFound, "PLN_001", "Plan not found", "")
	}
	if err := s.planRepo.Activate(id); err != nil {
		return apperrors.ErrInternal
	}
	s.auditPlan(actorID, "plan.activate", id, nil, nil, ipAddress)
	return nil
}

func isValidPlanType(t string) bool {
	switch t {
	case models.PlanTypeBasic, models.PlanTypeStandard, models.PlanTypePremium,
		models.PlanTypeCorporate, models.PlanTypeTrial:
		return true
	}
	return false
}

func (s *planService) auditPlan(userID uint, action string, resourceID uint, old, new models.JSONMap, ip string) {
	rid := resourceID
	_ = s.auditRepo.Create(&models.AuditLog{
		UserID:       userID,
		Action:       action,
		ResourceType: "plan",
		ResourceID:   &rid,
		OldValues:    old,
		NewValues:    new,
		IPAddress:    ip,
	})
}
