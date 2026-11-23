package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type UserRepository interface {
	Create(user *models.User) error
	FindByID(id uint) (*models.User, error)
	FindByEmail(email string) (*models.User, error)
	Update(user *models.User) error
	IncrementFailedLogins(userID uint) error
	ResetFailedLogins(userID uint) error
	LockAccount(userID uint, until time.Time) error
	MarkEmailVerified(userID uint) error
	UpdatePassword(userID uint, hash string, history models.StringSlice) error
	SoftDelete(userID uint, reason string) error
	ListStaff(search, role, status string, page, perPage int) ([]*models.User, int64, error)
	UpdateFields(userID uint, fields map[string]interface{}) error
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *userRepository) FindByID(id uint) (*models.User, error) {
	var user models.User
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Where("email = ? AND deleted_at IS NULL", email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

func (r *userRepository) IncrementFailedLogins(userID uint) error {
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		UpdateColumn("failed_login_attempts", gorm.Expr("failed_login_attempts + 1")).
		Error
}

func (r *userRepository) ResetFailedLogins(userID uint) error {
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"failed_login_attempts": 0,
			"locked_until":          nil,
		}).Error
}

func (r *userRepository) LockAccount(userID uint, until time.Time) error {
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"status":       "locked",
			"locked_until": until,
		}).Error
}

func (r *userRepository) MarkEmailVerified(userID uint) error {
	now := time.Now()
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"email_verified":    true,
			"email_verified_at": now,
		}).Error
}

func (r *userRepository) UpdatePassword(userID uint, hash string, history models.StringSlice) error {
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"password_hash":    hash,
			"password_history": history,
		}).Error
}

func (r *userRepository) ListStaff(search, role, status string, page, perPage int) ([]*models.User, int64, error) {
	q := r.db.Model(&models.User{}).Where("deleted_at IS NULL AND role != 'member'")
	if search != "" {
		like := "%" + search + "%"
		q = q.Where("first_name LIKE ? OR last_name LIKE ? OR email LIKE ?", like, like, like)
	}
	if role != "" {
		q = q.Where("role = ?", role)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []*models.User
	offset := (page - 1) * perPage
	err := q.Order("created_at DESC").Offset(offset).Limit(perPage).Find(&users).Error
	return users, total, err
}

func (r *userRepository) UpdateFields(userID uint, fields map[string]interface{}) error {
	return r.db.Model(&models.User{}).Where("id = ?", userID).Updates(fields).Error
}

func (r *userRepository) SoftDelete(userID uint, reason string) error {
	now := time.Now()
	return r.db.Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]interface{}{
			"deleted_at":      now,
			"deletion_reason": &reason,
			"status":          "inactive",
		}).Error
}
