package services_test

import (
	"log/slog"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/services"
	"gym-backend/internal/testhelpers"
)

func newPromoSvc(t *testing.T) (services.PromoService, *testhelpers.MockPromoRepo, *testhelpers.MockPlanRepo) {
	t.Helper()
	promoRepo := testhelpers.NewMockPromoRepo()
	planRepo  := testhelpers.NewMockPlanRepo()
	logger    := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	svc := services.NewPromoService(promoRepo, planRepo, logger)
	planRepo.Plans[1] = testhelpers.BasicPlan(1) // plan with PriceAmount=999
	return svc, promoRepo, planRepo
}

// ─── ValidateForPlan ──────────────────────────────────────────────────────────

func TestPromoValidate_Success_Percentage(t *testing.T) {
	svc, promoRepo, _ := newPromoSvc(t)

	promoRepo.ByCode["SAVE10"] = &models.PromoCode{
		ID:            1,
		Code:          "SAVE10",
		DiscountType:  models.DiscountTypePercentage,
		DiscountValue: 10,
		IsActive:      true,
	}

	result, err := svc.ValidateForPlan("SAVE10", 1)

	require.NoError(t, err)
	assert.Equal(t, float64(999), result.OriginalPrice)
	assert.InDelta(t, 99.9, result.DiscountAmount, 0.01)
	assert.InDelta(t, 899.1, result.FinalPrice, 0.01)
}

func TestPromoValidate_Success_FixedAmount(t *testing.T) {
	svc, promoRepo, _ := newPromoSvc(t)

	promoRepo.ByCode["FIXED100"] = &models.PromoCode{
		ID:            2,
		Code:          "FIXED100",
		DiscountType:  models.DiscountTypeFixedAmount,
		DiscountValue: 100,
		IsActive:      true,
	}

	result, err := svc.ValidateForPlan("FIXED100", 1)

	require.NoError(t, err)
	assert.Equal(t, float64(100), result.DiscountAmount)
	assert.Equal(t, float64(899), result.FinalPrice)
}

func TestPromoValidate_MissingCode(t *testing.T) {
	svc, _, _ := newPromoSvc(t)

	_, err := svc.ValidateForPlan("", 1)

	require.Error(t, err)
}

func TestPromoValidate_MissingPlanID(t *testing.T) {
	svc, promoRepo, _ := newPromoSvc(t)

	promoRepo.ByCode["SAVE10"] = &models.PromoCode{
		ID:            1,
		Code:          "SAVE10",
		DiscountType:  models.DiscountTypePercentage,
		DiscountValue: 10,
		IsActive:      true,
	}

	_, err := svc.ValidateForPlan("SAVE10", 0)

	require.Error(t, err)
}

func TestPromoValidate_CodeNotFound(t *testing.T) {
	svc, _, _ := newPromoSvc(t)

	_, err := svc.ValidateForPlan("NOSUCHCODE", 1)

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "PRO_002", appErr.Code)
}

func TestPromoValidate_CodeInactive(t *testing.T) {
	svc, promoRepo, _ := newPromoSvc(t)

	promoRepo.ByCode["INACTIVE"] = &models.PromoCode{
		ID:            3,
		Code:          "INACTIVE",
		DiscountType:  models.DiscountTypePercentage,
		DiscountValue: 10,
		IsActive:      false,
	}

	_, err := svc.ValidateForPlan("INACTIVE", 1)

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "PRO_004", appErr.Code)
}

func TestPromoValidate_PlanNotFound(t *testing.T) {
	svc, promoRepo, _ := newPromoSvc(t)

	promoRepo.ByCode["SAVE10"] = &models.PromoCode{
		ID:            1,
		Code:          "SAVE10",
		DiscountType:  models.DiscountTypePercentage,
		DiscountValue: 10,
		IsActive:      true,
	}

	// plan_id=999 does not exist in planRepo.
	_, err := svc.ValidateForPlan("SAVE10", 999)

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "PLN_001", appErr.Code)
}

func TestPromoValidate_ExceedsMaxUses(t *testing.T) {
	svc, promoRepo, _ := newPromoSvc(t)

	maxUses := 5
	promoRepo.ByCode["MAXED"] = &models.PromoCode{
		ID:            4,
		Code:          "MAXED",
		DiscountType:  models.DiscountTypePercentage,
		DiscountValue: 10,
		IsActive:      true,
		MaxUses:       &maxUses,
		CurrentUses:   5,
	}

	_, err := svc.ValidateForPlan("MAXED", 1)

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "PRO_007", appErr.Code)
}
