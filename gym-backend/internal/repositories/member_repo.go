package repositories

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type MemberRepository interface {
	Create(member *models.Member) error
	FindByID(id uint) (*models.Member, error)
	FindByUserID(userID uint) (*models.Member, error)
	Update(member *models.Member) error
	List(req utils.PageRequest, facilityID *uint) ([]*models.Member, int64, error)
	UpdateStatus(memberID uint, status string) error
	UpdateCurrentSubscription(memberID uint, planID, subID *uint) error
	NextMemberCode(facilityID uint) (string, error)
	FindMembersWithBirthdayToday() ([]*models.Member, error)
	FindAllActive() ([]*models.Member, error)
	AssignTrainer(memberID uint, trainerID *uint) error
}

type memberRepository struct {
	db *gorm.DB
}

func NewMemberRepository(db *gorm.DB) MemberRepository {
	return &memberRepository{db: db}
}

func (r *memberRepository) Create(member *models.Member) error {
	return r.db.Create(member).Error
}

func (r *memberRepository) FindByID(id uint) (*models.Member, error) {
	var m models.Member
	err := r.db.Preload("User").Preload("Facility").
		Where("id = ?", id).First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

func (r *memberRepository) FindByUserID(userID uint) (*models.Member, error) {
	var m models.Member
	err := r.db.Preload("User").Preload("Facility").
		Where("user_id = ?", userID).First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

func (r *memberRepository) Update(member *models.Member) error {
	return r.db.Save(member).Error
}

func (r *memberRepository) List(req utils.PageRequest, facilityID *uint) ([]*models.Member, int64, error) {
	query := r.db.Model(&models.Member{}).Preload("User").Preload("CurrentSubscription.Plan")

	if facilityID != nil {
		query = query.Where("members.facility_id = ?", *facilityID)
	}
	if s, ok := req.Filters["status"]; ok && s != "" {
		query = query.Where("members.membership_status = ?", s)
	}
	if tid, ok := req.Filters["trainer_id"]; ok && tid != "" {
		query = query.Where("members.assigned_trainer_id = ?", tid)
	}
	if from, ok := req.Filters["joined_from"]; ok && from != "" {
		query = query.Where("members.joined_date >= ?", from)
	}
	if to, ok := req.Filters["joined_to"]; ok && to != "" {
		query = query.Where("members.joined_date <= ?", to)
	}
	if req.Search != "" {
		like := "%" + strings.ToLower(req.Search) + "%"
		query = query.Joins("JOIN users ON users.id = members.user_id").
			Where("LOWER(users.first_name) LIKE ? OR LOWER(users.last_name) LIKE ? OR LOWER(users.email) LIKE ? OR LOWER(members.member_code) LIKE ? OR users.phone LIKE ?",
				like, like, like, like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var members []*models.Member
	if err := req.Apply(query).Find(&members).Error; err != nil {
		return nil, 0, err
	}

	// For members with no current_subscription_id set, fall back to their
	// most recent active subscription so the list always shows plan + expiry.
	missingIDs := make([]uint, 0)
	for _, m := range members {
		if m.CurrentSubscription == nil {
			missingIDs = append(missingIDs, m.ID)
		}
	}
	if len(missingIDs) > 0 {
		var subs []*models.Subscription
		r.db.Preload("Plan").
			Where("member_id IN ? AND status IN ('active','paused')", missingIDs).
			Order("end_date DESC").
			Find(&subs)
		subMap := make(map[uint]*models.Subscription)
		for _, s := range subs {
			if _, exists := subMap[s.MemberID]; !exists {
				subMap[s.MemberID] = s
			}
		}
		for _, m := range members {
			if m.CurrentSubscription == nil {
				if sub, ok := subMap[m.ID]; ok {
					m.CurrentSubscription = sub
				}
			}
		}
	}

	return members, total, nil
}

func (r *memberRepository) UpdateStatus(memberID uint, status string) error {
	return r.db.Model(&models.Member{}).
		Where("id = ?", memberID).
		Update("membership_status", status).Error
}

func (r *memberRepository) UpdateCurrentSubscription(memberID uint, planID, subID *uint) error {
	return r.db.Model(&models.Member{}).
		Where("id = ?", memberID).
		Updates(map[string]interface{}{
			"current_plan_id":         planID,
			"current_subscription_id": subID,
		}).Error
}

func (r *memberRepository) NextMemberCode(facilityID uint) (string, error) {
	var count int64
	if err := r.db.Model(&models.Member{}).
		Where("facility_id = ?", facilityID).Count(&count).Error; err != nil {
		return "", err
	}
	return fmt.Sprintf("GYM-%d-%06d", facilityID, count+1), nil
}

// FindMembersWithBirthdayToday returns active members whose date_of_birth
// month and day match today's date (year-agnostic).
func (r *memberRepository) FindMembersWithBirthdayToday() ([]*models.Member, error) {
	now := utils.TodayUTC()
	month := now.Month()
	day := now.Day()

	var members []*models.Member
	err := r.db.
		Joins("JOIN users ON users.id = members.user_id").
		Where("members.membership_status = ?", models.MemberStatusActive).
		Where("users.date_of_birth IS NOT NULL").
		Where("MONTH(users.date_of_birth) = ? AND DAY(users.date_of_birth) = ?", int(month), day).
		Preload("User").
		Find(&members).Error
	return members, err
}

// FindAllActive returns all members with active status (for bulk notifications).
func (r *memberRepository) FindAllActive() ([]*models.Member, error) {
	var members []*models.Member
	err := r.db.Preload("User").
		Where("membership_status = ?", models.MemberStatusActive).
		Find(&members).Error
	return members, err
}

// AssignTrainer sets or clears the assigned trainer for a member.
func (r *memberRepository) AssignTrainer(memberID uint, trainerID *uint) error {
	return r.db.Model(&models.Member{}).
		Where("id = ?", memberID).
		Update("assigned_trainer_id", trainerID).Error
}
