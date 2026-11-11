package workers_test

import (
	"context"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gym-backend/internal/models"
	"gym-backend/internal/testhelpers"
	"gym-backend/internal/workers"
)

var silentLogger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

// cancelledCtx returns an already-cancelled context so Start() exits immediately.
func cancelledCtx() context.Context {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	return ctx
}

// ─── ClassWorker ─────────────────────────────────────────────────────────────

func TestClassWorker_Run_CallsCompleteEndedClasses(t *testing.T) {
	classRepo := testhelpers.NewMockClassRepo()

	// Seed two ended classes.
	classRepo.Classes[1] = &models.Class{ID: 1, Status: models.ClassStatusScheduled, EndTime: time.Now().Add(-1 * time.Hour)}
	classRepo.Classes[2] = &models.Class{ID: 2, Status: models.ClassStatusOngoing, EndTime: time.Now().Add(-2 * time.Hour)}

	w := workers.NewClassWorker(classRepo, silentLogger)
	w.Start(cancelledCtx())

	// run() is called once on startup before the ticker/ctx check.
	assert.Equal(t, int64(2), classRepo.CompletedCount)
}

func TestClassWorker_Run_NoEndedClasses(t *testing.T) {
	classRepo := testhelpers.NewMockClassRepo()

	// Only future classes.
	classRepo.Classes[1] = &models.Class{ID: 1, Status: models.ClassStatusScheduled, EndTime: time.Now().Add(2 * time.Hour)}

	w := workers.NewClassWorker(classRepo, silentLogger)
	w.Start(cancelledCtx())

	assert.Equal(t, int64(0), classRepo.CompletedCount)
}

func TestClassWorker_Run_RepoError_DoesNotPanic(t *testing.T) {
	classRepo := testhelpers.NewMockClassRepo()
	classRepo.CompleteErr = assert.AnError

	w := workers.NewClassWorker(classRepo, silentLogger)
	// Should not panic even when the repo returns an error.
	require.NotPanics(t, func() {
		w.Start(cancelledCtx())
	})
}

// ─── RenewalWorker ───────────────────────────────────────────────────────────

func newRenewalWorker(t *testing.T) (
	*workers.RenewalWorker,
	*testhelpers.MockSubRepo,
	*testhelpers.MockMemberRepo,
	*testhelpers.MockAuditRepo,
) {
	t.Helper()
	subRepo    := testhelpers.NewMockSubRepo()
	memberRepo := testhelpers.NewMockMemberRepo()
	auditRepo  := &testhelpers.MockAuditRepo{}
	w := workers.NewRenewalWorker(subRepo, memberRepo, auditRepo, silentLogger)
	return w, subRepo, memberRepo, auditRepo
}

func TestRenewalWorker_AutoRenew_ExtendsSubscription(t *testing.T) {
	w, subRepo, _, _ := newRenewalWorker(t)

	now := time.Now()
	endDate := now.Add(2 * 24 * time.Hour) // expires in 2 days → within 3-day horizon

	planID := uint(1)
	sub := &models.Subscription{
		ID:        1,
		MemberID:  1,
		PlanID:    planID,
		Status:    models.SubStatusActive,
		AutoRenew: true,
		EndDate:   endDate,
		Plan: models.Plan{
			ID:                planID,
			BillingPeriodDays: 30,
		},
	}
	subRepo.Subs[1] = sub

	w.Start(cancelledCtx())

	// EndDate should have been extended by BillingPeriodDays.
	updated := subRepo.Subs[1]
	assert.True(t, updated.EndDate.After(endDate), "end date should be extended")
	assert.Equal(t, models.SubStatusActive, updated.Status)
}

func TestRenewalWorker_NoAutoRenew_ExpiredSub_MarksMemberExpired(t *testing.T) {
	w, subRepo, memberRepo, _ := newRenewalWorker(t)

	// Sub already past its end_date, auto_renew=false.
	pastEnd := time.Now().Add(-1 * time.Hour)
	sub := &models.Subscription{
		ID:        1,
		MemberID:  1,
		Status:    models.SubStatusActive,
		AutoRenew: false,
		EndDate:   pastEnd,
		Plan:      models.Plan{BillingPeriodDays: 30},
	}
	subRepo.Subs[1] = sub

	planID := uint(1)
	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, &planID)

	w.Start(cancelledCtx())

	// Status should be expired.
	assert.Equal(t, models.SubStatusExpired, subRepo.Subs[1].Status)
	// Member should be marked expired.
	assert.Equal(t, models.MemberStatusExpired, memberRepo.Members[1].MembershipStatus)
}

func TestRenewalWorker_NoExpiringSubs_DoesNothing(t *testing.T) {
	w, subRepo, _, _ := newRenewalWorker(t)

	// No subscriptions seeded.
	w.Start(cancelledCtx())

	assert.Empty(t, subRepo.Subs)
}

func TestRenewalWorker_RepoError_DoesNotPanic(t *testing.T) {
	w, subRepo, _, _ := newRenewalWorker(t)
	subRepo.FindExpiringErr = assert.AnError

	require.NotPanics(t, func() {
		w.Start(cancelledCtx())
	})
}

// ─── NotificationWorker ──────────────────────────────────────────────────────

func newNotifWorker(t *testing.T) (
	*workers.NotificationWorker,
	*testhelpers.MockSubRepo,
	*testhelpers.MockMemberRepo,
	*testhelpers.MockClassRepo,
	*testhelpers.MockBookingRepo,
	*testhelpers.MockNotifService,
) {
	t.Helper()
	subRepo     := testhelpers.NewMockSubRepo()
	memberRepo  := testhelpers.NewMockMemberRepo()
	classRepo   := testhelpers.NewMockClassRepo()
	bookingRepo := testhelpers.NewMockBookingRepo()
	notifSvc    := &testhelpers.MockNotifService{}
	w := workers.NewNotificationWorker(subRepo, memberRepo, classRepo, bookingRepo, notifSvc, silentLogger)
	return w, subRepo, memberRepo, classRepo, bookingRepo, notifSvc
}

func TestNotifWorker_ExpiryWarning_7Days_DispatchesNotification(t *testing.T) {
	w, subRepo, memberRepo, _, _, notifSvc := newNotifWorker(t)

	// Sub expires in exactly 7 days.
	planID := uint(1)
	endDate := time.Now().Add(7 * 24 * time.Hour)
	subRepo.Subs[1] = &models.Subscription{
		ID:       1,
		MemberID: 1,
		Status:   models.SubStatusActive,
		EndDate:  endDate,
	}
	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, &planID)

	w.Start(cancelledCtx())

	// At least one expiry-warning notification should have been dispatched (7-day bucket).
	found := false
	for _, d := range notifSvc.Dispatched {
		if d.Type == models.NotifSubExpiry7d {
			found = true
		}
	}
	assert.True(t, found, "expected subscription expiry 7-day warning notification")
}

func TestNotifWorker_ClassReminder_Dispatches_ForConfirmedBookings(t *testing.T) {
	w, _, memberRepo, classRepo, bookingRepo, notifSvc := newNotifWorker(t)

	// Class starts in 60 minutes — inside the [55m, 65m] reminder window.
	classRepo.Classes[1] = &models.Class{
		ID:         1,
		Name:       "Yoga",
		FacilityID: 1,
		Status:     models.ClassStatusScheduled,
		IsActive:   true,
		StartTime:  time.Now().Add(60 * time.Minute),
	}

	planID := uint(1)
	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, &planID)
	bookingRepo.Bookings[1] = &models.ClassBooking{
		ID:       1,
		ClassID:  1,
		MemberID: 1,
		Status:   models.BookingStatusConfirmed,
	}

	w.Start(cancelledCtx())

	found := false
	for _, d := range notifSvc.Dispatched {
		if d.Type == models.NotifClassReminder {
			found = true
		}
	}
	assert.True(t, found, "expected class reminder notification")
}

func TestNotifWorker_ClassReminder_SkipsWaitlistedBookings(t *testing.T) {
	w, _, memberRepo, classRepo, bookingRepo, notifSvc := newNotifWorker(t)

	classRepo.Classes[1] = &models.Class{
		ID:         1,
		Name:       "Yoga",
		FacilityID: 1,
		Status:     models.ClassStatusScheduled,
		IsActive:   true,
		StartTime:  time.Now().Add(60 * time.Minute),
	}

	planID := uint(1)
	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, &planID)
	bookingRepo.Bookings[1] = &models.ClassBooking{
		ID:       1,
		ClassID:  1,
		MemberID: 1,
		Status:   models.BookingStatusWaitlisted, // not confirmed
	}

	w.Start(cancelledCtx())

	for _, d := range notifSvc.Dispatched {
		assert.NotEqual(t, models.NotifClassReminder, d.Type, "waitlisted member should not get reminder")
	}
}

func TestNotifWorker_ClassReminder_OutsideWindow_NoNotification(t *testing.T) {
	w, _, _, classRepo, _, notifSvc := newNotifWorker(t)

	// Class starts in 3 hours — outside the reminder window.
	classRepo.Classes[1] = &models.Class{
		ID:         1,
		FacilityID: 1,
		Status:     models.ClassStatusScheduled,
		IsActive:   true,
		StartTime:  time.Now().Add(3 * time.Hour),
	}

	w.Start(cancelledCtx())

	for _, d := range notifSvc.Dispatched {
		assert.NotEqual(t, models.NotifClassReminder, d.Type)
	}
}

func TestNotifWorker_NoSubs_NoClasses_DoesNotPanic(t *testing.T) {
	w, _, _, _, _, _ := newNotifWorker(t)

	require.NotPanics(t, func() {
		w.Start(cancelledCtx())
	})
}
