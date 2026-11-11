package services_test

import (
	"log/slog"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/services"
	"gym-backend/internal/testhelpers"
)

// newSubSvc builds a SubscriptionService wired to fresh mocks and seeds
// a basic plan and active member.
func newSubSvc(t *testing.T) (
	services.SubscriptionService,
	*testhelpers.MockSubRepo,
	*testhelpers.MockMemberRepo,
	*testhelpers.MockPlanRepo,
	*testhelpers.MockPromoRepo,
) {
	t.Helper()
	subRepo    := testhelpers.NewMockSubRepo()
	memberRepo := testhelpers.NewMockMemberRepo()
	planRepo   := testhelpers.NewMockPlanRepo()
	promoRepo  := testhelpers.NewMockPromoRepo()
	auditRepo  := &testhelpers.MockAuditRepo{}
	logger     := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

	svc := services.NewSubscriptionService(subRepo, memberRepo, planRepo, promoRepo, auditRepo, logger)

	// Seed plan (ID=1).
	planRepo.Plans[1] = testhelpers.BasicPlan(1)

	// Seed active member (ID=1).
	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, nil)

	return svc, subRepo, memberRepo, planRepo, promoRepo
}

// ─── Create ───────────────────────────────────────────────────────────────────

func TestSubscription_Create_Success(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	sub, err := svc.Create(services.CreateSubscriptionRequest{
		MemberID: 1,
		PlanID:   1,
	}, 99, "127.0.0.1")

	require.NoError(t, err)
	assert.Equal(t, uint(1), sub.MemberID)
	assert.Equal(t, uint(1), sub.PlanID)
	assert.Equal(t, models.SubStatusActive, sub.Status)
	assert.Equal(t, 999.0, sub.FinalAmount)

	// End date should be 30 days from start.
	diff := sub.EndDate.Sub(sub.StartDate)
	assert.InDelta(t, float64(30*24*time.Hour), float64(diff), float64(time.Hour))

	// Must persist to repo.
	assert.Equal(t, 1, len(subRepo.Subs))
}

func TestSubscription_Create_MemberNotFound(t *testing.T) {
	svc, _, _, _, _ := newSubSvc(t)

	_, err := svc.Create(services.CreateSubscriptionRequest{
		MemberID: 999,
		PlanID:   1,
	}, 99, "")

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "MBR_001", appErr.Code)
}

func TestSubscription_Create_PlanNotFound(t *testing.T) {
	svc, _, _, _, _ := newSubSvc(t)

	_, err := svc.Create(services.CreateSubscriptionRequest{
		MemberID: 1,
		PlanID:   999,
	}, 99, "")

	require.Error(t, err)
}

func TestSubscription_Create_WithValidPromoCode(t *testing.T) {
	svc, _, _, _, promoRepo := newSubSvc(t)

	// Seed a 10% promo code.
	promoRepo.ByCode["SAVE10"] = &models.PromoCode{
		ID:            1,
		Code:          "SAVE10",
		DiscountType:  models.DiscountTypePercentage,
		DiscountValue: 10,
		IsActive:      true,
		MaxUsesPerMember: 1,
	}

	sub, err := svc.Create(services.CreateSubscriptionRequest{
		MemberID:  1,
		PlanID:    1,
		PromoCode: "SAVE10",
	}, 99, "")

	require.NoError(t, err)
	// 10% off 999 = 899.1
	assert.InDelta(t, 899.1, sub.FinalAmount, 0.01)
	assert.NotZero(t, sub.DiscountAmount)
}

func TestSubscription_Create_InvalidPromoCode(t *testing.T) {
	svc, _, _, _, _ := newSubSvc(t)

	_, err := svc.Create(services.CreateSubscriptionRequest{
		MemberID:  1,
		PlanID:    1,
		PromoCode: "NOSUCHCODE",
	}, 99, "")

	require.Error(t, err)
}

func TestSubscription_Create_MissingMemberID(t *testing.T) {
	svc, _, _, _, _ := newSubSvc(t)

	_, err := svc.Create(services.CreateSubscriptionRequest{PlanID: 1}, 99, "")
	require.Error(t, err)
}

// ─── Pause ────────────────────────────────────────────────────────────────────

func TestSubscription_Pause_Success(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	// Seed an active subscription.
	sub := &models.Subscription{
		ID:       1,
		MemberID: 1, PlanID: 1,
		Status:    models.SubStatusActive,
		StartDate: time.Now().AddDate(0, -1, 0),
		EndDate:   time.Now().AddDate(0, 1, 0),
		PauseCount: 0,
	}
	subRepo.Subs[1] = sub

	updated, err := svc.Pause(1, services.PauseSubscriptionRequest{Months: 1, Reason: "holiday"}, 99, "")

	require.NoError(t, err)
	assert.Equal(t, models.SubStatusPaused, updated.Status)
	assert.Equal(t, 1, updated.PauseCount)
	assert.NotNil(t, updated.PausedAt)
}

func TestSubscription_Pause_InvalidDuration(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	subRepo.Subs[1] = &models.Subscription{
		ID: 1, MemberID: 1, Status: models.SubStatusActive,
	}

	_, err := svc.Pause(1, services.PauseSubscriptionRequest{Months: 0}, 99, "")
	require.Error(t, err)

	_, err = svc.Pause(1, services.PauseSubscriptionRequest{Months: 4}, 99, "")
	require.Error(t, err)
}

func TestSubscription_Pause_MaxPausesReached(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	subRepo.Subs[1] = &models.Subscription{
		ID: 1, MemberID: 1, Status: models.SubStatusActive,
		PauseCount: 2, // already hit the max
	}

	_, err := svc.Pause(1, services.PauseSubscriptionRequest{Months: 1}, 99, "")
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Contains(t, strings.ToLower(appErr.Message), "pause")
}

func TestSubscription_Pause_NotActive(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	subRepo.Subs[1] = &models.Subscription{
		ID: 1, MemberID: 1, Status: models.SubStatusCancelled,
	}

	_, err := svc.Pause(1, services.PauseSubscriptionRequest{Months: 1}, 99, "")
	require.Error(t, err)
}

// ─── Resume ───────────────────────────────────────────────────────────────────

func TestSubscription_Resume_Success(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	now := time.Now()
	sub := &models.Subscription{
		ID:         1,
		MemberID:   1,
		Status:     models.SubStatusPaused,
		PausedAt:   &now,
		PausedUntil: func() *time.Time { t := now.AddDate(0, 1, 0); return &t }(),
		EndDate:    now.AddDate(0, 2, 0),
	}
	subRepo.Subs[1] = sub

	updated, err := svc.Resume(1, 99, "")
	require.NoError(t, err)
	assert.Equal(t, models.SubStatusActive, updated.Status)
	assert.Nil(t, updated.PausedAt)
}

func TestSubscription_Resume_NotPaused(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	subRepo.Subs[1] = &models.Subscription{
		ID: 1, Status: models.SubStatusActive,
	}

	_, err := svc.Resume(1, 99, "")
	require.Error(t, err)
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

func TestSubscription_Cancel_Success(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	subRepo.Subs[1] = &models.Subscription{
		ID: 1, MemberID: 1, Status: models.SubStatusActive,
	}

	updated, err := svc.Cancel(1, services.CancelSubscriptionRequest{Reason: "moving away"}, 99, "")
	require.NoError(t, err)
	assert.Equal(t, models.SubStatusCancelled, updated.Status)
	assert.NotNil(t, updated.CancelledAt)
	assert.Equal(t, "moving away", updated.CancellationReason)
}

func TestSubscription_Cancel_AlreadyCancelled(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	subRepo.Subs[1] = &models.Subscription{
		ID: 1, Status: models.SubStatusCancelled,
	}

	_, err := svc.Cancel(1, services.CancelSubscriptionRequest{}, 99, "")
	require.Error(t, err)
}

// ─── Upgrade (proration) ──────────────────────────────────────────────────────

func TestSubscription_Upgrade_ProrationCredit(t *testing.T) {
	svc, subRepo, _, planRepo, _ := newSubSvc(t)

	// Premium plan (ID=2): ₹1499 / 30 days.
	planRepo.Plans[2] = &models.Plan{
		ID:               2,
		Name:             "Premium",
		PriceAmount:      1499,
		BillingPeriodDays: 30,
		IsActive:         true,
		GroupClassAccess: true,
	}

	// Active sub on basic plan with 15 days remaining.
	startDate := time.Now().Truncate(24 * time.Hour).AddDate(0, 0, -15)
	endDate   := startDate.AddDate(0, 0, 30) // 15 days left
	subRepo.Subs[1] = &models.Subscription{
		ID:          1,
		MemberID:    1,
		PlanID:      1,
		Status:      models.SubStatusActive,
		StartDate:   startDate,
		EndDate:     endDate,
		FinalAmount: 999,
		Plan:        *testhelpers.BasicPlan(1),
	}

	newSub, err := svc.Upgrade(1, services.UpgradeSubscriptionRequest{NewPlanID: 2}, 99, "")
	require.NoError(t, err)
	assert.Equal(t, uint(2), newSub.PlanID)

	// Daily rate of old plan = 999/30 = 33.3
	// Credit = 33.3 * 15 = 499.5
	// New amount = 1499 - 499.5 = 999.5 (±1 day tolerance due to timing)
	assert.InDelta(t, 999.5, newSub.FinalAmount, 35.0) // 35 = ~1 day variance tolerance
	assert.Greater(t, newSub.FinalAmount, 0.0)          // Never negative
}

func TestSubscription_Upgrade_SamePlan(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	subRepo.Subs[1] = &models.Subscription{
		ID:     1,
		PlanID: 1,
		Status: models.SubStatusActive,
		Plan:   *testhelpers.BasicPlan(1),
	}

	_, err := svc.Upgrade(1, services.UpgradeSubscriptionRequest{NewPlanID: 1}, 99, "")
	require.Error(t, err)
}

// ─── SetAutoRenew ─────────────────────────────────────────────────────────────

func TestSubscription_SetAutoRenew(t *testing.T) {
	svc, subRepo, _, _, _ := newSubSvc(t)

	subRepo.Subs[1] = &models.Subscription{
		ID: 1, MemberID: 1, Status: models.SubStatusActive, AutoRenew: true,
	}

	updated, err := svc.SetAutoRenew(1, false, 99, "")
	require.NoError(t, err)
	assert.False(t, updated.AutoRenew)
}
