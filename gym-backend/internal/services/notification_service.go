package services

import (
	"fmt"
	"log/slog"
	"time"

	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type UpdatePreferenceRequest struct {
	EmailEnabled     *bool `json:"email_enabled"`
	PushEnabled      *bool `json:"push_enabled"`
	SMSEnabled       *bool `json:"sms_enabled"`
	SubExpiryAlerts  *bool `json:"sub_expiry_alerts"`
	PaymentAlerts    *bool `json:"payment_alerts"`
	ClassAlerts      *bool `json:"class_alerts"`
	ClassReminders   *bool `json:"class_reminders"`
	MembershipAlerts *bool `json:"membership_alerts"`
	BirthdayAlerts   *bool `json:"birthday_alerts"`
	PromoAlerts      *bool `json:"promo_alerts"`
}

// DispatchEvent carries everything needed to build and deliver a notification.
type DispatchEvent struct {
	UserID       uint
	Type         string
	Title        string
	Body         string
	Channel      string
	Data         models.JSONMap
	ResourceType string
	ResourceID   *uint
	Dedup        bool // if true, skip if already sent for this resource
}

// ─── Interface ────────────────────────────────────────────────────────────────

type NotificationService interface {
	// Dispatch creates an in-app notification and optionally sends an email.
	// Respects user preferences and dedup rules.
	Dispatch(ev DispatchEvent) error

	// DispatchBulk sends the same event to multiple users.
	DispatchBulk(userIDs []uint, ev DispatchEvent) error

	// User-facing read operations.
	List(userID uint, req utils.PageRequest) ([]*models.Notification, int64, error)
	UnreadCount(userID uint) (int64, error)
	MarkRead(notifID uint, userID uint) error
	MarkAllRead(userID uint) error

	// Preferences.
	GetPreferences(userID uint) (*models.NotificationPreference, error)
	UpdatePreferences(userID uint, req UpdatePreferenceRequest) (*models.NotificationPreference, error)
}

// ─── Implementation ───────────────────────────────────────────────────────────

type notificationService struct {
	notifRepo repositories.NotificationRepository
	emailSvc  EmailService
	logger    *slog.Logger
}

func NewNotificationService(
	notifRepo repositories.NotificationRepository,
	emailSvc EmailService,
	logger *slog.Logger,
) NotificationService {
	return &notificationService{
		notifRepo: notifRepo,
		emailSvc:  emailSvc,
		logger:    logger,
	}
}

func (s *notificationService) Dispatch(ev DispatchEvent) error {
	// Resolve channel default.
	channel := ev.Channel
	if channel == "" {
		channel = models.ChannelInApp
	}

	// Dedup guard: skip if we already sent this event for this resource.
	if ev.Dedup && ev.ResourceID != nil && ev.ResourceType != "" {
		exists, err := s.notifRepo.ExistsForResource(ev.UserID, ev.Type, ev.ResourceType, *ev.ResourceID)
		if err != nil {
			s.logger.Error("notification dedup check failed", "err", err)
		} else if exists {
			return nil // already sent, skip silently
		}
	}

	// Load preferences.
	pref, err := s.notifRepo.FindPreference(ev.UserID)
	if err != nil {
		s.logger.Warn("failed to load notification preferences, using defaults", "user_id", ev.UserID)
		pref = &models.NotificationPreference{
			EmailEnabled: true, SubExpiryAlerts: true, PaymentAlerts: true,
			ClassAlerts: true, ClassReminders: true, MembershipAlerts: true,
			BirthdayAlerts: true, PromoAlerts: true,
		}
	}

	// Check event category opt-in.
	if !s.isEventEnabled(pref, ev.Type) {
		return nil
	}

	now := time.Now()

	// Always create an in-app notification.
	notif := &models.Notification{
		UserID:       ev.UserID,
		Type:         ev.Type,
		Channel:      models.ChannelInApp,
		Title:        ev.Title,
		Body:         ev.Body,
		Data:         ev.Data,
		SentAt:       &now,
		ResourceType: ev.ResourceType,
		ResourceID:   ev.ResourceID,
	}
	if err := s.notifRepo.Create(notif); err != nil {
		s.logger.Error("create in-app notification failed", "err", err, "type", ev.Type)
		return err
	}

	// Optionally send email.
	if channel == models.ChannelEmail && pref.EmailEnabled {
		go s.sendEmail(ev)
	}

	return nil
}

func (s *notificationService) DispatchBulk(userIDs []uint, ev DispatchEvent) error {
	for _, uid := range userIDs {
		ev.UserID = uid
		if err := s.Dispatch(ev); err != nil {
			s.logger.Error("bulk dispatch failed for user", "user_id", uid, "err", err)
		}
	}
	return nil
}

func (s *notificationService) List(userID uint, req utils.PageRequest) ([]*models.Notification, int64, error) {
	return s.notifRepo.ListByUser(userID, req)
}

func (s *notificationService) UnreadCount(userID uint) (int64, error) {
	return s.notifRepo.UnreadCount(userID)
}

func (s *notificationService) MarkRead(notifID uint, userID uint) error {
	return s.notifRepo.MarkRead(notifID, userID)
}

func (s *notificationService) MarkAllRead(userID uint) error {
	return s.notifRepo.MarkAllRead(userID)
}

func (s *notificationService) GetPreferences(userID uint) (*models.NotificationPreference, error) {
	return s.notifRepo.FindPreference(userID)
}

func (s *notificationService) UpdatePreferences(userID uint, req UpdatePreferenceRequest) (*models.NotificationPreference, error) {
	pref, err := s.notifRepo.FindPreference(userID)
	if err != nil {
		return nil, err
	}
	pref.UserID = userID // ensure set for upsert

	if req.EmailEnabled != nil {
		pref.EmailEnabled = *req.EmailEnabled
	}
	if req.PushEnabled != nil {
		pref.PushEnabled = *req.PushEnabled
	}
	if req.SMSEnabled != nil {
		pref.SMSEnabled = *req.SMSEnabled
	}
	if req.SubExpiryAlerts != nil {
		pref.SubExpiryAlerts = *req.SubExpiryAlerts
	}
	if req.PaymentAlerts != nil {
		pref.PaymentAlerts = *req.PaymentAlerts
	}
	if req.ClassAlerts != nil {
		pref.ClassAlerts = *req.ClassAlerts
	}
	if req.ClassReminders != nil {
		pref.ClassReminders = *req.ClassReminders
	}
	if req.MembershipAlerts != nil {
		pref.MembershipAlerts = *req.MembershipAlerts
	}
	if req.BirthdayAlerts != nil {
		pref.BirthdayAlerts = *req.BirthdayAlerts
	}
	if req.PromoAlerts != nil {
		pref.PromoAlerts = *req.PromoAlerts
	}

	if err := s.notifRepo.UpsertPreference(pref); err != nil {
		return nil, err
	}
	return pref, nil
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

func (s *notificationService) isEventEnabled(pref *models.NotificationPreference, notifType string) bool {
	switch notifType {
	case models.NotifSubExpiry7d, models.NotifSubExpiry3d, models.NotifSubExpired, models.NotifSubRenewed:
		return pref.SubExpiryAlerts
	case models.NotifPaymentReceived, models.NotifPaymentRefunded:
		return pref.PaymentAlerts
	case models.NotifBookingConfirmed, models.NotifBookingWaitlisted, models.NotifBookingPromoted,
		models.NotifClassCancelled:
		return pref.ClassAlerts
	case models.NotifClassReminder:
		return pref.ClassReminders
	case models.NotifMemberFrozen, models.NotifMemberUnfrozen, models.NotifTrainerAssigned:
		return pref.MembershipAlerts
	case models.NotifBirthdayReminder:
		return pref.BirthdayAlerts
	case models.NotifPaymentDue:
		return pref.PaymentAlerts
	case models.NotifPromoAnnouncement:
		return pref.PromoAlerts
	case models.NotifWelcome:
		return true // always send welcome
	}
	return true
}

// sendEmail is a fire-and-forget email sender using the console email service.
// In production this would integrate with an SMTP/SendGrid/Mailgun provider.
func (s *notificationService) sendEmail(ev DispatchEvent) {
	s.logger.Info("📨 notification_email",
		"user_id", ev.UserID,
		"type", ev.Type,
		"title", ev.Title,
		"body", ev.Body,
	)
}

// ─── Convenience constructors for common events ───────────────────────────────

func SubExpiryEvent(userID uint, daysLeft int, subID uint) DispatchEvent {
	notifType := models.NotifSubExpiry7d
	if daysLeft <= 3 {
		notifType = models.NotifSubExpiry3d
	}
	if daysLeft <= 0 {
		notifType = models.NotifSubExpired
	}

	var title, body string
	switch {
	case daysLeft <= 0:
		title = "Membership Expired"
		body = "Your gym membership has expired. Renew now to continue your fitness journey."
	case daysLeft <= 3:
		title = fmt.Sprintf("Membership Expiring in %d Day(s)", daysLeft)
		body = fmt.Sprintf("Your membership expires in %d day(s). Renew soon to avoid interruption.", daysLeft)
	default:
		title = fmt.Sprintf("Membership Expiring in %d Days", daysLeft)
		body = fmt.Sprintf("Your membership expires in %d days. Consider renewing your plan.", daysLeft)
	}

	rid := subID
	return DispatchEvent{
		UserID:       userID,
		Type:         notifType,
		Title:        title,
		Body:         body,
		Channel:      models.ChannelEmail,
		Data:         models.JSONMap{"subscription_id": subID, "days_left": daysLeft},
		ResourceType: "subscription",
		ResourceID:   &rid,
		Dedup:        true,
	}
}

func PaymentReceivedEvent(userID uint, paymentID uint, amount float64, currency string) DispatchEvent {
	rid := paymentID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifPaymentReceived,
		Title:        "Payment Confirmed",
		Body:         fmt.Sprintf("Payment of %s %.2f has been received. Thank you!", currency, amount),
		Channel:      models.ChannelEmail,
		Data:         models.JSONMap{"payment_id": paymentID, "amount": amount, "currency": currency},
		ResourceType: "payment",
		ResourceID:   &rid,
		Dedup:        true,
	}
}

func PaymentRefundedEvent(userID uint, paymentID uint, amount float64, currency string) DispatchEvent {
	rid := paymentID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifPaymentRefunded,
		Title:        "Payment Refunded",
		Body:         fmt.Sprintf("A refund of %s %.2f has been processed.", currency, amount),
		Channel:      models.ChannelEmail,
		Data:         models.JSONMap{"payment_id": paymentID, "refund_amount": amount},
		ResourceType: "payment",
		ResourceID:   &rid,
		Dedup:        false,
	}
}

func BookingConfirmedEvent(userID uint, bookingID uint, className string, startTime time.Time) DispatchEvent {
	rid := bookingID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifBookingConfirmed,
		Title:        "Class Booking Confirmed",
		Body:         fmt.Sprintf("You're booked for %s on %s.", className, startTime.Format("Mon, Jan 2 at 3:04 PM")),
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"booking_id": bookingID, "class_name": className},
		ResourceType: "booking",
		ResourceID:   &rid,
		Dedup:        true,
	}
}

func BookingWaitlistedEvent(userID uint, bookingID uint, className string, position int) DispatchEvent {
	rid := bookingID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifBookingWaitlisted,
		Title:        "Added to Waitlist",
		Body:         fmt.Sprintf("You're #%d on the waitlist for %s. We'll notify you if a spot opens.", position, className),
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"booking_id": bookingID, "class_name": className, "position": position},
		ResourceType: "booking",
		ResourceID:   &rid,
		Dedup:        true,
	}
}

func BookingPromotedEvent(userID uint, bookingID uint, className string) DispatchEvent {
	rid := bookingID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifBookingPromoted,
		Title:        "Spot Confirmed!",
		Body:         fmt.Sprintf("A spot opened up — you're now confirmed for %s!", className),
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"booking_id": bookingID, "class_name": className},
		ResourceType: "booking",
		ResourceID:   &rid,
		Dedup:        false,
	}
}

func ClassCancelledEvent(userID uint, classID uint, className string) DispatchEvent {
	rid := classID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifClassCancelled,
		Title:        "Class Cancelled",
		Body:         fmt.Sprintf("%s has been cancelled. We apologise for the inconvenience.", className),
		Channel:      models.ChannelEmail,
		Data:         models.JSONMap{"class_id": classID, "class_name": className},
		ResourceType: "class",
		ResourceID:   &rid,
		Dedup:        true,
	}
}

func ClassReminderEvent(userID uint, classID uint, className string, startTime time.Time) DispatchEvent {
	rid := classID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifClassReminder,
		Title:        "Class Starting Soon",
		Body:         fmt.Sprintf("%s starts at %s — see you there!", className, startTime.Format("3:04 PM")),
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"class_id": classID, "class_name": className},
		ResourceType: "class",
		ResourceID:   &rid,
		Dedup:        true,
	}
}

func MemberFrozenEvent(userID uint, memberID uint, months int) DispatchEvent {
	rid := memberID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifMemberFrozen,
		Title:        "Membership Frozen",
		Body:         fmt.Sprintf("Your membership has been frozen for %d month(s).", months),
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"member_id": memberID, "months": months},
		ResourceType: "member",
		ResourceID:   &rid,
		Dedup:        false,
	}
}

func MemberUnfrozenEvent(userID uint, memberID uint) DispatchEvent {
	rid := memberID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifMemberUnfrozen,
		Title:        "Membership Reactivated",
		Body:         "Your membership has been reactivated. Welcome back!",
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"member_id": memberID},
		ResourceType: "member",
		ResourceID:   &rid,
		Dedup:        false,
	}
}

func WelcomeEvent(userID uint, firstName string) DispatchEvent {
	return DispatchEvent{
		UserID:  userID,
		Type:    models.NotifWelcome,
		Title:   "Welcome to the Gym!",
		Body:    fmt.Sprintf("Hi %s, welcome! Your membership is now active. Let's get moving!", firstName),
		Channel: models.ChannelEmail,
		Data:    models.JSONMap{"user_id": userID},
		Dedup:   false,
	}
}

func BirthdayReminderEvent(userID uint, firstName string) DispatchEvent {
	return DispatchEvent{
		UserID:  userID,
		Type:    models.NotifBirthdayReminder,
		Title:   "🎂 Happy Birthday!",
		Body:    fmt.Sprintf("Wishing you a fantastic birthday, %s! Hope you treat yourself to a great workout today 💪", firstName),
		Channel: models.ChannelInApp,
		Data:    models.JSONMap{"user_id": userID},
		Dedup:   false,
	}
}

func PaymentDueEvent(userID uint, subID uint, planName string, amount float64, renewalDate string) DispatchEvent {
	rid := subID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifPaymentDue,
		Title:        "Upcoming Auto-Renewal",
		Body:         fmt.Sprintf("Your %s plan will auto-renew on %s for ₹%.2f. Ensure your payment method is up to date.", planName, renewalDate, amount),
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"subscription_id": subID, "plan_name": planName, "amount": amount, "renewal_date": renewalDate},
		ResourceType: "subscription",
		ResourceID:   &rid,
		Dedup:        true,
	}
}

func TrainerAssignedEvent(userID uint, memberID uint, trainerName string) DispatchEvent {
	rid := memberID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifTrainerAssigned,
		Title:        "Personal Trainer Assigned",
		Body:         fmt.Sprintf("%s has been assigned as your personal trainer. Get ready to level up your fitness journey!", trainerName),
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"member_id": memberID, "trainer_name": trainerName},
		ResourceType: "member",
		ResourceID:   &rid,
		Dedup:        false,
	}
}

func PromoAnnouncementEvent(userID uint, promoID uint, code string, description string) DispatchEvent {
	rid := promoID
	return DispatchEvent{
		UserID:       userID,
		Type:         models.NotifPromoAnnouncement,
		Title:        "🎉 Exclusive Offer Just for You!",
		Body:         fmt.Sprintf("Use code %s to enjoy: %s. Limited time — don't miss out!", code, description),
		Channel:      models.ChannelInApp,
		Data:         models.JSONMap{"promo_id": promoID, "code": code},
		ResourceType: "promo_code",
		ResourceID:   &rid,
		Dedup:        false,
	}
}
