package services_test

import (
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/services"
	"gym-backend/internal/testhelpers"
)

func newPaymentSvc(t *testing.T) (
	services.PaymentService,
	*testhelpers.MockPaymentRepo,
	*testhelpers.MockMemberRepo,
	*testhelpers.MockSubRepo,
	*testhelpers.MockNotifService,
) {
	t.Helper()
	paymentRepo := testhelpers.NewMockPaymentRepo()
	memberRepo  := testhelpers.NewMockMemberRepo()
	subRepo     := testhelpers.NewMockSubRepo()
	auditRepo   := &testhelpers.MockAuditRepo{}
	notifSvc    := &testhelpers.MockNotifService{}
	logger      := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

	svc := services.NewPaymentService(paymentRepo, memberRepo, subRepo, auditRepo, notifSvc, logger)

	// Seed member (ID=1) and active subscription (ID=1).
	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, nil)
	subID := uint(1)
	subRepo.Subs[1] = &models.Subscription{
		ID:       1,
		MemberID: 1,
		Status:   models.SubStatusActive,
		EndDate:  time.Now().AddDate(0, 1, 0),
	}
	subRepo.ActiveByMember[1] = subRepo.Subs[1]
	memberRepo.Members[1].CurrentSubscriptionID = &subID

	return svc, paymentRepo, memberRepo, subRepo, notifSvc
}

// ─── Record ───────────────────────────────────────────────────────────────────

func TestPayment_Record_Success(t *testing.T) {
	svc, paymentRepo, _, subRepo, notifSvc := newPaymentSvc(t)

	subID := uint(1)
	p, err := svc.Record(services.RecordPaymentRequest{
		MemberID:       1,
		SubscriptionID: &subID,
		Amount:         999,
		PaymentMethod:  models.PaymentMethodCash,
		PaidAt:         time.Now().Format(time.RFC3339),
	}, 99, "127.0.0.1")

	require.NoError(t, err)
	assert.Equal(t, 999.0, p.Amount)
	assert.Equal(t, models.PaymentStatusCompleted, p.Status)
	assert.Equal(t, models.PaymentMethodCash, p.PaymentMethod)

	// Must be persisted.
	assert.Equal(t, 1, len(paymentRepo.Payments))

	// Subscription LastPaymentID must be updated.
	assert.Equal(t, p.ID, *subRepo.Subs[1].LastPaymentID)

	// Notification dispatched asynchronously — give goroutine time to run.
	time.Sleep(10 * time.Millisecond)
	assert.Len(t, notifSvc.Dispatched, 1)
}

func TestPayment_Record_MemberNotFound(t *testing.T) {
	svc, _, _, _, _ := newPaymentSvc(t)

	_, err := svc.Record(services.RecordPaymentRequest{
		MemberID:      999,
		Amount:        500,
		PaymentMethod: models.PaymentMethodCash,
		PaidAt:        time.Now().Format(time.RFC3339),
	}, 99, "")

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "MBR_001", appErr.Code)
}

func TestPayment_Record_InvalidAmount(t *testing.T) {
	svc, _, _, _, _ := newPaymentSvc(t)

	_, err := svc.Record(services.RecordPaymentRequest{
		MemberID:      1,
		Amount:        0,
		PaymentMethod: models.PaymentMethodCash,
		PaidAt:        time.Now().Format(time.RFC3339),
	}, 99, "")

	require.Error(t, err)
}

func TestPayment_Record_InvalidPaidAt(t *testing.T) {
	svc, _, _, _, _ := newPaymentSvc(t)

	_, err := svc.Record(services.RecordPaymentRequest{
		MemberID:      1,
		Amount:        500,
		PaymentMethod: models.PaymentMethodCash,
		PaidAt:        "not-a-date",
	}, 99, "")

	require.Error(t, err)
}

func TestPayment_Record_SubscriptionOwnerMismatch(t *testing.T) {
	svc, _, _, subRepo, _ := newPaymentSvc(t)

	// Sub ID=2 belongs to member 2, not member 1.
	subRepo.Subs[2] = &models.Subscription{ID: 2, MemberID: 2, Status: models.SubStatusActive}
	otherSubID := uint(2)

	_, err := svc.Record(services.RecordPaymentRequest{
		MemberID:       1,
		SubscriptionID: &otherSubID,
		Amount:         500,
		PaymentMethod:  models.PaymentMethodCash,
		PaidAt:         time.Now().Format(time.RFC3339),
	}, 99, "")

	require.Error(t, err)
}

// ─── Refund ───────────────────────────────────────────────────────────────────

func TestPayment_Refund_Full(t *testing.T) {
	svc, paymentRepo, _, _, notifSvc := newPaymentSvc(t)

	// Seed a completed payment.
	paymentRepo.Payments[1] = &models.Payment{
		ID:       1,
		MemberID: 1,
		Amount:   999,
		Status:   models.PaymentStatusCompleted,
		PaidAt:   time.Now().AddDate(0, 0, -1),
	}

	p, err := svc.Refund(1, services.RefundPaymentRequest{
		Amount: 999,
		Reason: "customer request",
	}, 99, "")

	require.NoError(t, err)
	assert.Equal(t, models.PaymentStatusRefunded, p.Status)
	assert.Equal(t, 999.0, p.RefundAmount)
	assert.NotNil(t, p.RefundedAt)
	assert.Equal(t, "customer request", p.RefundReason)

	// Notification dispatched asynchronously — give goroutine time to run.
	time.Sleep(10 * time.Millisecond)
	assert.Len(t, notifSvc.Dispatched, 1)
}

func TestPayment_Refund_Partial(t *testing.T) {
	svc, paymentRepo, _, _, _ := newPaymentSvc(t)

	paymentRepo.Payments[1] = &models.Payment{
		ID:       1,
		MemberID: 1,
		Amount:   999,
		Status:   models.PaymentStatusCompleted,
	}

	p, err := svc.Refund(1, services.RefundPaymentRequest{Amount: 500, Reason: "partial"}, 99, "")
	require.NoError(t, err)
	assert.Equal(t, 500.0, p.RefundAmount)
	assert.Equal(t, models.PaymentStatusRefunded, p.Status)
}

func TestPayment_Refund_ExceedsOriginalAmount(t *testing.T) {
	svc, paymentRepo, _, _, _ := newPaymentSvc(t)

	paymentRepo.Payments[1] = &models.Payment{
		ID: 1, MemberID: 1, Amount: 500, Status: models.PaymentStatusCompleted,
	}

	// Service silently caps refund to original amount rather than erroring.
	p, err := svc.Refund(1, services.RefundPaymentRequest{Amount: 600, Reason: "too much"}, 99, "")
	require.NoError(t, err)
	assert.Equal(t, 500.0, p.RefundAmount) // capped to original amount
}

func TestPayment_Refund_AlreadyRefunded(t *testing.T) {
	svc, paymentRepo, _, _, _ := newPaymentSvc(t)

	paymentRepo.Payments[1] = &models.Payment{
		ID: 1, MemberID: 1, Amount: 999, Status: models.PaymentStatusRefunded,
	}

	_, err := svc.Refund(1, services.RefundPaymentRequest{Amount: 500, Reason: "again"}, 99, "")
	require.Error(t, err)
}

func TestPayment_Refund_NotFound(t *testing.T) {
	svc, _, _, _, _ := newPaymentSvc(t)

	_, err := svc.Refund(999, services.RefundPaymentRequest{Amount: 100, Reason: "x"}, 99, "")
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "PAY_001", appErr.Code)
}
