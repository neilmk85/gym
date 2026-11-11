package models

import "time"

// Notification event types.
const (
	NotifSubExpiry7d       = "subscription_expiry_7d"
	NotifSubExpiry3d       = "subscription_expiry_3d"
	NotifSubExpired        = "subscription_expired"
	NotifSubRenewed        = "subscription_renewed"
	NotifPaymentReceived   = "payment_received"
	NotifPaymentRefunded   = "payment_refunded"
	NotifBookingConfirmed  = "class_booking_confirmed"
	NotifBookingWaitlisted = "class_booking_waitlisted"
	NotifBookingPromoted   = "class_booking_promoted"
	NotifClassReminder     = "class_reminder"
	NotifClassCancelled    = "class_cancelled"
	NotifMemberFrozen      = "member_frozen"
	NotifMemberUnfrozen    = "member_unfrozen"
	NotifWelcome           = "welcome"

	// New notification types
	NotifBirthdayReminder  = "birthday_reminder"
	NotifPaymentDue        = "payment_due_reminder"
	NotifTrainerAssigned   = "trainer_assigned"
	NotifPromoAnnouncement = "promo_announcement"
)

// Delivery channel.
const (
	ChannelInApp = "in_app"
	ChannelEmail = "email"
	ChannelSMS   = "sms"
	ChannelPush  = "push"
)

type Notification struct {
	ID      uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID  uint   `gorm:"not null;index" json:"user_id"`
	Type    string `gorm:"size:60;not null;index" json:"type"`
	Channel string `gorm:"type:enum('in_app','email','sms','push');default:in_app" json:"channel"`

	Title string  `gorm:"size:200;not null" json:"title"`
	Body  string  `gorm:"type:text;not null" json:"body"`
	Data  JSONMap `gorm:"type:text" json:"data,omitempty"` // contextual payload

	IsRead bool       `gorm:"default:false;index" json:"is_read"`
	ReadAt *time.Time `json:"read_at,omitempty"`
	SentAt *time.Time `json:"sent_at,omitempty"`

	// For dedup: reference resource so we don't send the same event twice.
	ResourceType string `gorm:"size:40" json:"resource_type,omitempty"`
	ResourceID   *uint  `json:"resource_id,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// NotificationPreference stores per-user channel and event opt-in/out settings.
type NotificationPreference struct {
	ID     uint `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID uint `gorm:"uniqueIndex;not null" json:"user_id"`

	// Global channel toggles.
	EmailEnabled bool `gorm:"default:true" json:"email_enabled"`
	PushEnabled  bool `gorm:"default:true" json:"push_enabled"`
	SMSEnabled   bool `gorm:"default:false" json:"sms_enabled"`

	// Per-event toggles.
	SubExpiryAlerts  bool `gorm:"default:true" json:"sub_expiry_alerts"`
	PaymentAlerts    bool `gorm:"default:true" json:"payment_alerts"`
	ClassAlerts      bool `gorm:"default:true" json:"class_alerts"`
	ClassReminders   bool `gorm:"default:true" json:"class_reminders"`
	MembershipAlerts bool `gorm:"default:true" json:"membership_alerts"`
	BirthdayAlerts   bool `gorm:"default:true" json:"birthday_alerts"`
	PromoAlerts      bool `gorm:"default:true" json:"promo_alerts"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
