package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ExpiredScanStat groups expired scan attempts by member for the Super Admin view.
type ExpiredScanStat struct {
	MemberID     *uint      `json:"member_id"`
	MemberName   string     `json:"member_name"`
	DeviceUserID string     `json:"device_user_id"`
	Attempts     int64      `json:"attempts"`
	FirstAt      time.Time  `json:"first_attempt_at"`
	LastAt       time.Time  `json:"last_attempt_at"`
	DaySpan      int        `json:"day_span"` // number of distinct days they tried
}

type GymSettingRepository interface {
	Get(key string) (string, error)
	Set(key, value string) error
}

type ExpiredScanRepository interface {
	Log(attempt *models.ExpiredScanAttempt) error
	Stats() ([]*ExpiredScanStat, error)
}

// ── GymSetting ────────────────────────────────────────────────────────────────

type gymSettingRepository struct{ db *gorm.DB }

func NewGymSettingRepository(db *gorm.DB) GymSettingRepository {
	return &gymSettingRepository{db: db}
}

func (r *gymSettingRepository) Get(key string) (string, error) {
	var s models.GymSetting
	err := r.db.Where("key = ?", key).First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	return s.Value, err
}

func (r *gymSettingRepository) Set(key, value string) error {
	return r.db.Where(models.GymSetting{Key: key}).
		Assign(models.GymSetting{Value: value, UpdatedAt: time.Now()}).
		FirstOrCreate(&models.GymSetting{}).Error
}

// ── ExpiredScan ───────────────────────────────────────────────────────────────

type expiredScanRepository struct{ db *gorm.DB }

func NewExpiredScanRepository(db *gorm.DB) ExpiredScanRepository {
	return &expiredScanRepository{db: db}
}

func (r *expiredScanRepository) Log(attempt *models.ExpiredScanAttempt) error {
	return r.db.Create(attempt).Error
}

func (r *expiredScanRepository) Stats() ([]*ExpiredScanStat, error) {
	rows, err := r.db.Raw(`
		SELECT
			member_id,
			member_name,
			device_user_id,
			COUNT(*) AS attempts,
			MIN(scanned_at) AS first_at,
			MAX(scanned_at) AS last_at,
			COUNT(DISTINCT DATE(scanned_at)) AS day_span
		FROM expired_scan_attempts
		GROUP BY member_id, member_name, device_user_id
		ORDER BY last_at DESC
	`).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*ExpiredScanStat
	for rows.Next() {
		var s ExpiredScanStat
		if err := rows.Scan(&s.MemberID, &s.MemberName, &s.DeviceUserID,
			&s.Attempts, &s.FirstAt, &s.LastAt, &s.DaySpan); err != nil {
			return nil, err
		}
		stats = append(stats, &s)
	}
	return stats, nil
}
