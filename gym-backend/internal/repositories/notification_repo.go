package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type NotificationRepository interface {
	Create(n *models.Notification) error
	FindByID(id uint) (*models.Notification, error)
	ListByUser(userID uint, req utils.PageRequest) ([]*models.Notification, int64, error)
	MarkRead(id uint, userID uint) error
	MarkAllRead(userID uint) error
	UnreadCount(userID uint) (int64, error)
	// ExistsForResource returns true if a notification of the given type was
	// already sent to userID for the specified resource (dedup guard).
	ExistsForResource(userID uint, notifType string, resourceType string, resourceID uint) (bool, error)

	// Preferences
	FindPreference(userID uint) (*models.NotificationPreference, error)
	UpsertPreference(pref *models.NotificationPreference) error
}

type notificationRepository struct {
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) Create(n *models.Notification) error {
	return r.db.Create(n).Error
}

func (r *notificationRepository) FindByID(id uint) (*models.Notification, error) {
	var n models.Notification
	err := r.db.Where("id = ?", id).First(&n).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &n, nil
}

func (r *notificationRepository) ListByUser(userID uint, req utils.PageRequest) ([]*models.Notification, int64, error) {
	query := r.db.Model(&models.Notification{}).Where("user_id = ?", userID)

	if t, ok := req.Filters["type"]; ok && t != "" {
		query = query.Where("type = ?", t)
	}
	if ch, ok := req.Filters["channel"]; ok && ch != "" {
		query = query.Where("channel = ?", ch)
	}
	if unread, ok := req.Filters["unread"]; ok && unread == "true" {
		query = query.Where("is_read = false")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var notifs []*models.Notification
	if err := req.Apply(query).Order("created_at DESC").Find(&notifs).Error; err != nil {
		return nil, 0, err
	}
	return notifs, total, nil
}

func (r *notificationRepository) MarkRead(id uint, userID uint) error {
	return r.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": gorm.Expr("NOW()"),
		}).Error
}

func (r *notificationRepository) MarkAllRead(userID uint) error {
	return r.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Updates(map[string]interface{}{
			"is_read": true,
			"read_at": gorm.Expr("NOW()"),
		}).Error
}

func (r *notificationRepository) UnreadCount(userID uint) (int64, error) {
	var count int64
	err := r.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = false", userID).
		Count(&count).Error
	return count, err
}

func (r *notificationRepository) ExistsForResource(userID uint, notifType, resourceType string, resourceID uint) (bool, error) {
	var count int64
	err := r.db.Model(&models.Notification{}).
		Where("user_id = ? AND type = ? AND resource_type = ? AND resource_id = ?",
			userID, notifType, resourceType, resourceID).
		Count(&count).Error
	return count > 0, err
}

func (r *notificationRepository) FindPreference(userID uint) (*models.NotificationPreference, error) {
	var pref models.NotificationPreference
	err := r.db.Where("user_id = ?", userID).First(&pref).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Return defaults.
			return &models.NotificationPreference{
				UserID:           userID,
				EmailEnabled:     true,
				PushEnabled:      true,
				SMSEnabled:       false,
				SubExpiryAlerts:  true,
				PaymentAlerts:    true,
				ClassAlerts:      true,
				ClassReminders:   true,
				MembershipAlerts: true,
			}, nil
		}
		return nil, err
	}
	return &pref, nil
}

func (r *notificationRepository) UpsertPreference(pref *models.NotificationPreference) error {
	return r.db.Save(pref).Error
}
