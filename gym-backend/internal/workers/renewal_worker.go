package workers

import (
	"context"
	"log/slog"
	"time"

	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// RenewalWorker processes subscription renewals and expirations daily.
type RenewalWorker struct {
	subRepo    repositories.SubscriptionRepository
	memberRepo repositories.MemberRepository
	auditRepo  repositories.AuditLogRepository
	logger     *slog.Logger
	interval   time.Duration
}

func NewRenewalWorker(
	subRepo repositories.SubscriptionRepository,
	memberRepo repositories.MemberRepository,
	auditRepo repositories.AuditLogRepository,
	logger *slog.Logger,
) *RenewalWorker {
	return &RenewalWorker{
		subRepo:    subRepo,
		memberRepo: memberRepo,
		auditRepo:  auditRepo,
		logger:     logger,
		interval:   6 * time.Hour,
	}
}

// Start runs the worker loop until ctx is cancelled.
func (w *RenewalWorker) Start(ctx context.Context) {
	w.logger.Info("renewal worker started", "interval", w.interval)

	// Run once immediately on startup, then on the ticker.
	w.run()

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.run()
		case <-ctx.Done():
			w.logger.Info("renewal worker stopped")
			return
		}
	}
}

func (w *RenewalWorker) run() {
	w.logger.Info("renewal worker running")

	now := time.Now()
	horizon := now.AddDate(0, 0, 3) // look 3 days ahead

	subs, err := w.subRepo.FindExpiringBefore(horizon)
	if err != nil {
		w.logger.Error("renewal worker: find expiring subscriptions failed", "err", err)
		return
	}

	for _, sub := range subs {
		if sub.AutoRenew {
			w.renew(sub)
		} else {
			w.expire(sub)
		}
	}

	// Also expire already-past subscriptions that are still "active".
	if err := w.expirePastSubscriptions(now); err != nil {
		w.logger.Error("renewal worker: expire past subscriptions failed", "err", err)
	}

	// Auto-resume subscriptions whose pause period has ended.
	if err := w.resumePausedDue(now); err != nil {
		w.logger.Error("renewal worker: auto-resume paused subscriptions failed", "err", err)
	}
}

func (w *RenewalWorker) renew(sub *models.Subscription) {
	// Extend by the plan's billing period using the current end_date as new start.
	newStart := sub.EndDate
	newEnd := newStart.AddDate(0, 0, sub.Plan.BillingPeriodDays)

	sub.StartDate = newStart
	sub.EndDate = newEnd
	sub.Status = models.SubStatusActive

	nextRenewal := newEnd
	sub.NextRenewalDate = &nextRenewal

	// Reset pause counter on renewal.
	sub.PauseCount = 0
	sub.PausedAt = nil
	sub.PausedUntil = nil

	if err := w.subRepo.Update(sub); err != nil {
		w.logger.Error("renewal worker: renew subscription failed",
			"subscription_id", sub.ID, "err", err)
		return
	}

	w.logger.Info("subscription renewed",
		"subscription_id", sub.ID,
		"member_id", sub.MemberID,
		"new_end", newEnd.Format("2006-01-02"))

	w.audit(sub.MemberID, "subscription.auto_renewed", sub.ID,
		models.JSONMap{"old_end": sub.EndDate.Format("2006-01-02")},
		models.JSONMap{"new_end": newEnd.Format("2006-01-02")})
}

func (w *RenewalWorker) expire(sub *models.Subscription) {
	if time.Now().Before(sub.EndDate) {
		return // not expired yet
	}

	sub.Status = models.SubStatusExpired
	sub.NextRenewalDate = nil

	if err := w.subRepo.Update(sub); err != nil {
		w.logger.Error("renewal worker: expire subscription failed",
			"subscription_id", sub.ID, "err", err)
		return
	}

	_ = w.memberRepo.UpdateStatus(sub.MemberID, models.MemberStatusExpired)
	_ = w.memberRepo.UpdateCurrentSubscription(sub.MemberID, nil, nil)

	w.logger.Info("subscription expired",
		"subscription_id", sub.ID,
		"member_id", sub.MemberID)

	w.audit(sub.MemberID, "subscription.expired", sub.ID, nil,
		models.JSONMap{"end_date": sub.EndDate.Format("2006-01-02")})
}

func (w *RenewalWorker) expirePastSubscriptions(now time.Time) error {
	// Find active subscriptions past their end_date with auto_renew = false.
	subs, err := w.subRepo.FindExpiredActive(now)
	if err != nil {
		return err
	}
	for _, sub := range subs {
		w.expire(sub)
	}
	return nil
}

func (w *RenewalWorker) resumePausedDue(now time.Time) error {
	subs, err := w.subRepo.FindPausedDue(now)
	if err != nil {
		return err
	}
	for _, sub := range subs {
		sub.Status = models.SubStatusActive
		sub.PausedAt = nil
		sub.PausedUntil = nil
		if err := w.subRepo.Update(sub); err != nil {
			w.logger.Error("renewal worker: auto-resume failed", "subscription_id", sub.ID, "err", err)
			continue
		}
		_ = w.memberRepo.UpdateStatus(sub.MemberID, models.MemberStatusActive)
		w.audit(sub.MemberID, "subscription.auto_resumed", sub.ID, nil, nil)
		w.logger.Info("subscription auto-resumed", "subscription_id", sub.ID, "member_id", sub.MemberID)
	}
	return nil
}

func (w *RenewalWorker) audit(userID uint, action string, resourceID uint, old, new models.JSONMap) {
	rid := resourceID
	_ = w.auditRepo.Create(&models.AuditLog{
		UserID:       userID,
		Action:       action,
		ResourceType: "subscription",
		ResourceID:   &rid,
		OldValues:    old,
		NewValues:    new,
		IPAddress:    "worker",
	})
}
