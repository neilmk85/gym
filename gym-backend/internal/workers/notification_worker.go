package workers

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

// NotificationWorker fires time-based notifications:
//   - Subscription expiry warnings at 7 days and 3 days before end
//   - Subscription expired on day-of
//   - Class reminders 1 hour before start
//   - Birthday wishes on member's birthday
//   - Payment-due reminder 3 days before auto-renewal
type NotificationWorker struct {
	subRepo     repositories.SubscriptionRepository
	memberRepo  repositories.MemberRepository
	classRepo   repositories.ClassRepository
	bookingRepo repositories.BookingRepository
	notifSvc    services.NotificationService
	logger      *slog.Logger
	interval    time.Duration
}

func NewNotificationWorker(
	subRepo repositories.SubscriptionRepository,
	memberRepo repositories.MemberRepository,
	classRepo repositories.ClassRepository,
	bookingRepo repositories.BookingRepository,
	notifSvc services.NotificationService,
	logger *slog.Logger,
) *NotificationWorker {
	return &NotificationWorker{
		subRepo:     subRepo,
		memberRepo:  memberRepo,
		classRepo:   classRepo,
		bookingRepo: bookingRepo,
		notifSvc:    notifSvc,
		logger:      logger,
		interval:    1 * time.Hour,
	}
}

func (w *NotificationWorker) Start(ctx context.Context) {
	w.logger.Info("notification worker started", "interval", w.interval)

	w.run()

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.run()
		case <-ctx.Done():
			w.logger.Info("notification worker stopped")
			return
		}
	}
}

func (w *NotificationWorker) run() {
	w.logger.Info("notification worker running")
	w.processSubExpiryWarnings()
	w.processClassReminders()
	w.processBirthdayReminders()
	w.processPaymentDueReminders()
}

// ─── Subscription expiry ─────────────────────────────────────────────────────

func (w *NotificationWorker) processSubExpiryWarnings() {
	now := time.Now()

	// 7-day bucket: end_date in [now+6d23h, now+7d1h]
	w.notifyExpiryBatch(now.Add(7*24*time.Hour-time.Hour), now.Add(7*24*time.Hour+time.Hour), 7)

	// 3-day bucket: end_date in [now+2d23h, now+3d1h]
	w.notifyExpiryBatch(now.Add(3*24*time.Hour-time.Hour), now.Add(3*24*time.Hour+time.Hour), 3)

	// Expired bucket: end_date in [now-2h, now]
	w.notifyExpiryBatch(now.Add(-2*time.Hour), now, 0)
}

func (w *NotificationWorker) notifyExpiryBatch(from, to time.Time, daysLeft int) {
	subs, err := w.subRepo.FindExpiringBefore(to)
	if err != nil {
		w.logger.Error("notif worker: find expiring subs failed", "err", err)
		return
	}

	for _, sub := range subs {
		if sub.EndDate.Before(from) {
			continue
		}
		member, err := w.memberRepo.FindByID(sub.MemberID)
		if err != nil || member == nil {
			continue
		}
		ev := services.SubExpiryEvent(member.UserID, daysLeft, sub.ID)
		if err := w.notifSvc.Dispatch(ev); err != nil {
			w.logger.Error("notif worker: dispatch expiry failed", "sub_id", sub.ID, "err", err)
		}
	}
}

// ─── Class reminders ─────────────────────────────────────────────────────────

func (w *NotificationWorker) processClassReminders() {
	now := time.Now()
	from := now.Add(55 * time.Minute)
	to := now.Add(65 * time.Minute)

	classes, err := w.classRepo.ListStartingBetween(from, to)
	if err != nil {
		w.logger.Error("notif worker: list classes for reminder failed", "err", err)
		return
	}

	for _, class := range classes {
		req := utils.PageRequest{Page: 1, PerPage: 500}
		bookings, _, err := w.bookingRepo.ListByClass(class.ID, req)
		if err != nil {
			continue
		}

		for _, booking := range bookings {
			if booking.Status != models.BookingStatusConfirmed || booking.MemberID == nil {
				continue
			}
			member, err := w.memberRepo.FindByID(*booking.MemberID)
			if err != nil || member == nil {
				continue
			}
			ev := services.ClassReminderEvent(member.UserID, class.ID, class.Name, class.StartTime)
			if err := w.notifSvc.Dispatch(ev); err != nil {
				w.logger.Error("notif worker: dispatch class reminder failed",
					"class_id", class.ID, "member_id", booking.MemberID, "err", err)
			}
		}
	}
}

// ─── Birthday reminders ───────────────────────────────────────────────────────

func (w *NotificationWorker) processBirthdayReminders() {
	members, err := w.memberRepo.FindMembersWithBirthdayToday()
	if err != nil {
		w.logger.Error("notif worker: find birthday members failed", "err", err)
		return
	}

	for _, member := range members {
		firstName := member.User.FirstName
		ev := services.BirthdayReminderEvent(member.UserID, firstName)
		if err := w.notifSvc.Dispatch(ev); err != nil {
			w.logger.Error("notif worker: dispatch birthday failed",
				"member_id", member.ID, "err", err)
		} else {
			w.logger.Info("notif worker: birthday sent", "member_id", member.ID, "name", firstName)
		}
	}
}

// ─── Payment due reminders ────────────────────────────────────────────────────

// processPaymentDueReminders fires a reminder 3 days before auto-renewal date.
// Uses a ±1h window around the 3-day mark to avoid duplicate sends across hourly ticks.
func (w *NotificationWorker) processPaymentDueReminders() {
	now := time.Now()
	from := now.Add(3*24*time.Hour - time.Hour)
	to := now.Add(3*24*time.Hour + time.Hour)

	subs, err := w.subRepo.FindAutoRenewDueSoon(from, to)
	if err != nil {
		w.logger.Error("notif worker: find auto-renew subs failed", "err", err)
		return
	}

	for _, sub := range subs {
		member, err := w.memberRepo.FindByID(sub.MemberID)
		if err != nil || member == nil {
			continue
		}

		planName := "your plan"
		if sub.Plan.Name != "" {
			planName = sub.Plan.Name
		}
		renewalDate := ""
		if sub.NextRenewalDate != nil {
			renewalDate = sub.NextRenewalDate.Format("2 Jan 2006")
		} else {
			renewalDate = fmt.Sprintf("in ~3 days")
		}

		ev := services.PaymentDueEvent(member.UserID, sub.ID, planName, sub.FinalAmount, renewalDate)
		if err := w.notifSvc.Dispatch(ev); err != nil {
			w.logger.Error("notif worker: dispatch payment-due failed",
				"sub_id", sub.ID, "err", err)
		}
	}
}
