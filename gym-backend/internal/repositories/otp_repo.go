package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type OTPRepository interface {
	Create(otp *models.OTPCode) error
	FindLatestByUserAndPurpose(userID uint, purpose string) (*models.OTPCode, error)
	MarkUsed(id uint) error
	IncrementAttempts(id uint) error
	CountRecentByUserAndPurpose(userID uint, purpose string, since time.Time) (int64, error)
}

type otpRepository struct {
	db *gorm.DB
}

func NewOTPRepository(db *gorm.DB) OTPRepository {
	return &otpRepository{db: db}
}

func (r *otpRepository) Create(otp *models.OTPCode) error {
	return r.db.Create(otp).Error
}

func (r *otpRepository) FindLatestByUserAndPurpose(userID uint, purpose string) (*models.OTPCode, error) {
	var otp models.OTPCode
	err := r.db.
		Where("user_id = ? AND purpose = ? AND used_at IS NULL", userID, purpose).
		Order("created_at DESC").
		First(&otp).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &otp, nil
}

func (r *otpRepository) MarkUsed(id uint) error {
	now := time.Now()
	return r.db.Model(&models.OTPCode{}).
		Where("id = ?", id).
		Update("used_at", now).Error
}

func (r *otpRepository) IncrementAttempts(id uint) error {
	return r.db.Model(&models.OTPCode{}).
		Where("id = ?", id).
		UpdateColumn("attempts", gorm.Expr("attempts + 1")).Error
}

func (r *otpRepository) CountRecentByUserAndPurpose(userID uint, purpose string, since time.Time) (int64, error) {
	var count int64
	err := r.db.Model(&models.OTPCode{}).
		Where("user_id = ? AND purpose = ? AND created_at > ?", userID, purpose, since).
		Count(&count).Error
	return count, err
}
