package services

import (
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ─────────────────────────────────────────────────────────────────────

type CreatePromoCodeRequest struct {
	FacilityID       *uint    `json:"facility_id"`
	Code             string   `json:"code"`
	DiscountType     string   `json:"discount_type"`
	DiscountValue    float64  `json:"discount_value"`
	MaxUses          *int     `json:"max_uses"`
	MaxUsesPerMember int      `json:"max_uses_per_member"`
	ValidFrom        string   `json:"valid_from"`  // YYYY-MM-DD
	ValidUntil       string   `json:"valid_until"` // YYYY-MM-DD
	ApplicablePlans  []string `json:"applicable_plans"`
	ApplicableRoles  []string `json:"applicable_roles"`
}

type UpdatePromoCodeRequest struct {
	MaxUses          *int     `json:"max_uses"`
	MaxUsesPerMember *int     `json:"max_uses_per_member"`
	ValidFrom        string   `json:"valid_from"`
	ValidUntil       string   `json:"valid_until"`
	ApplicablePlans  []string `json:"applicable_plans"`
	IsActive         *bool    `json:"is_active"`
}

// ─── Service ──────────────────────────────────────────────────────────────────

// PromoValidationResult is returned by ValidateForPlan without side-effects.
type PromoValidationResult struct {
	PromoCodeID    uint    `json:"promo_code_id"`
	Code           string  `json:"code"`
	DiscountType   string  `json:"discount_type"`
	DiscountValue  float64 `json:"discount_value"`
	OriginalPrice  float64 `json:"original_price"`
	DiscountAmount float64 `json:"discount_amount"`
	FinalPrice     float64 `json:"final_price"`
}

type PromoService interface {
	Create(req CreatePromoCodeRequest, createdByUserID uint) (*models.PromoCode, error)
	GetByID(id uint) (*models.PromoCode, error)
	List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.PromoCode, int64, error)
	Update(id uint, req UpdatePromoCodeRequest) (*models.PromoCode, error)
	Deactivate(id uint, actorID uint) error
	ValidateForPlan(code string, planID uint) (*PromoValidationResult, error)
}

type promoService struct {
	promoRepo repositories.PromoCodeRepository
	planRepo  repositories.PlanRepository
	logger    *slog.Logger
}

func NewPromoService(
	promoRepo repositories.PromoCodeRepository,
	planRepo repositories.PlanRepository,
	logger *slog.Logger,
) PromoService {
	return &promoService{promoRepo: promoRepo, planRepo: planRepo, logger: logger}
}

func (s *promoService) Create(req CreatePromoCodeRequest, createdByUserID uint) (*models.PromoCode, error) {
	if req.Code == "" {
		return nil, apperrors.ErrValidation("code is required")
	}
	if !isValidDiscountType(req.DiscountType) {
		return nil, apperrors.ErrValidation("discount_type must be percentage, fixed_amount, free_month, or bogo")
	}
	if req.DiscountType == models.DiscountTypePercentage && (req.DiscountValue <= 0 || req.DiscountValue > 100) {
		return nil, apperrors.ErrValidation("percentage discount must be between 1 and 100")
	}
	if req.DiscountType == models.DiscountTypeFixedAmount && req.DiscountValue <= 0 {
		return nil, apperrors.ErrValidation("fixed_amount discount must be greater than 0")
	}

	// Ensure code is uppercase.
	req.Code = strings.ToUpper(strings.TrimSpace(req.Code))

	// Check uniqueness.
	existing, _ := s.promoRepo.FindByCode(req.Code)
	if existing != nil {
		return nil, apperrors.New(http.StatusConflict, "PRO_001", "Promo code already exists", "")
	}

	maxPerMember := req.MaxUsesPerMember
	if maxPerMember <= 0 {
		maxPerMember = 1
	}

	pc := &models.PromoCode{
		FacilityID:       req.FacilityID,
		Code:             req.Code,
		DiscountType:     req.DiscountType,
		DiscountValue:    req.DiscountValue,
		MaxUses:          req.MaxUses,
		MaxUsesPerMember: maxPerMember,
		ApplicablePlans:  models.StringSlice(req.ApplicablePlans),
		ApplicableRoles:  models.StringSlice(req.ApplicableRoles),
		IsActive:         true,
		CreatedByUserID:  createdByUserID,
	}

	if req.ValidFrom != "" {
		t, err := time.Parse("2006-01-02", req.ValidFrom)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid valid_from; use YYYY-MM-DD")
		}
		pc.ValidFrom = &t
	}
	if req.ValidUntil != "" {
		t, err := time.Parse("2006-01-02", req.ValidUntil)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid valid_until; use YYYY-MM-DD")
		}
		pc.ValidUntil = &t
	}
	if pc.ValidFrom != nil && pc.ValidUntil != nil && pc.ValidFrom.After(*pc.ValidUntil) {
		return nil, apperrors.ErrValidation("valid_from must be before valid_until")
	}

	if err := s.promoRepo.Create(pc); err != nil {
		s.logger.Error("create promo failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return pc, nil
}

func (s *promoService) GetByID(id uint) (*models.PromoCode, error) {
	pc, err := s.promoRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if pc == nil {
		return nil, apperrors.New(http.StatusNotFound, "PRO_002", "Promo code not found", "")
	}
	return pc, nil
}

func (s *promoService) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.PromoCode, int64, error) {
	codes, total, err := s.promoRepo.List(req, facilityID, activeOnly)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	return codes, total, nil
}

func (s *promoService) Update(id uint, req UpdatePromoCodeRequest) (*models.PromoCode, error) {
	pc, err := s.promoRepo.FindByID(id)
	if err != nil || pc == nil {
		return nil, apperrors.New(http.StatusNotFound, "PRO_002", "Promo code not found", "")
	}

	if req.MaxUses != nil {
		pc.MaxUses = req.MaxUses
	}
	if req.MaxUsesPerMember != nil && *req.MaxUsesPerMember > 0 {
		pc.MaxUsesPerMember = *req.MaxUsesPerMember
	}
	if req.ValidFrom != "" {
		t, err := time.Parse("2006-01-02", req.ValidFrom)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid valid_from; use YYYY-MM-DD")
		}
		pc.ValidFrom = &t
	}
	if req.ValidUntil != "" {
		t, err := time.Parse("2006-01-02", req.ValidUntil)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid valid_until; use YYYY-MM-DD")
		}
		pc.ValidUntil = &t
	}
	if req.ApplicablePlans != nil {
		pc.ApplicablePlans = models.StringSlice(req.ApplicablePlans)
	}
	if req.IsActive != nil {
		pc.IsActive = *req.IsActive
	}

	if err := s.promoRepo.Update(pc); err != nil {
		s.logger.Error("update promo failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return pc, nil
}

func (s *promoService) Deactivate(id uint, actorID uint) error {
	pc, err := s.promoRepo.FindByID(id)
	if err != nil || pc == nil {
		return apperrors.New(http.StatusNotFound, "PRO_002", "Promo code not found", "")
	}
	if !pc.IsActive {
		return apperrors.New(http.StatusConflict, "PRO_003", "Promo code is already inactive", "")
	}
	if err := s.promoRepo.Deactivate(id); err != nil {
		return apperrors.ErrInternal
	}
	return nil
}

func (s *promoService) ValidateForPlan(code string, planID uint) (*PromoValidationResult, error) {
	if code == "" {
		return nil, apperrors.ErrValidation("code is required")
	}
	if planID == 0 {
		return nil, apperrors.ErrValidation("plan_id is required")
	}

	pc, err := s.promoRepo.FindByCode(strings.ToUpper(strings.TrimSpace(code)))
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if pc == nil {
		return nil, apperrors.New(http.StatusNotFound, "PRO_002", "Promo code not found", "")
	}
	if !pc.IsActive {
		return nil, apperrors.New(http.StatusConflict, "PRO_004", "Promo code is not active", "")
	}

	now := time.Now()
	if pc.ValidFrom != nil && now.Before(*pc.ValidFrom) {
		return nil, apperrors.New(http.StatusConflict, "PRO_005", "Promo code is not yet valid", "")
	}
	if pc.ValidUntil != nil && now.After(pc.ValidUntil.Add(24*time.Hour-time.Second)) {
		return nil, apperrors.New(http.StatusConflict, "PRO_006", "Promo code has expired", "")
	}
	if pc.MaxUses != nil && pc.CurrentUses >= *pc.MaxUses {
		return nil, apperrors.New(http.StatusConflict, "PRO_007", "Promo code usage limit reached", "")
	}

	plan, err := s.planRepo.FindByID(planID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if plan == nil {
		return nil, apperrors.New(http.StatusNotFound, "PLN_001", "Plan not found", "")
	}

	// If the promo is restricted to specific plans, validate membership.
	if len(pc.ApplicablePlans) > 0 {
		planIDStr := fmt.Sprintf("%d", planID)
		found := false
		for _, id := range pc.ApplicablePlans {
			if id == planIDStr {
				found = true
				break
			}
		}
		if !found {
			return nil, apperrors.New(http.StatusConflict, "PRO_008", "Promo code is not applicable to this plan", "")
		}
	}

	originalPrice := plan.PriceAmount
	var discountAmount float64
	switch pc.DiscountType {
	case models.DiscountTypePercentage:
		discountAmount = originalPrice * pc.DiscountValue / 100
	case models.DiscountTypeFixedAmount:
		discountAmount = pc.DiscountValue
		if discountAmount > originalPrice {
			discountAmount = originalPrice
		}
	case models.DiscountTypeFreeMonth, models.DiscountTypeBOGO:
		discountAmount = originalPrice
	}

	return &PromoValidationResult{
		PromoCodeID:    pc.ID,
		Code:           pc.Code,
		DiscountType:   pc.DiscountType,
		DiscountValue:  pc.DiscountValue,
		OriginalPrice:  originalPrice,
		DiscountAmount: discountAmount,
		FinalPrice:     math.Max(0, originalPrice-discountAmount),
	}, nil
}

func isValidDiscountType(t string) bool {
	switch t {
	case models.DiscountTypePercentage, models.DiscountTypeFixedAmount,
		models.DiscountTypeFreeMonth, models.DiscountTypeBOGO:
		return true
	}
	return false
}
