package models

import "time"

const (
	PlanTypeBasic     = "basic"
	PlanTypeStandard  = "standard"
	PlanTypePremium   = "premium"
	PlanTypeCorporate = "corporate"
	PlanTypeTrial     = "trial"
)

type Plan struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID  uint   `gorm:"not null;index" json:"facility_id"`
	Name        string `gorm:"size:100;not null" json:"name"`
	Description string `gorm:"type:text" json:"description,omitempty"`
	Type           string `gorm:"type:enum('basic','standard','premium','corporate','trial');default:standard" json:"type"`
	MemberCategory string `gorm:"type:enum('individual','couple','group');default:individual" json:"member_category"`
	Gender         string `gorm:"type:enum('any','male','female');default:any" json:"gender"`
	MinMembers     int    `gorm:"default:1" json:"min_members"`
	MaxMembers     int    `gorm:"default:1" json:"max_members"`

	BillingPeriodDays int     `gorm:"not null;default:30" json:"billing_period_days"`
	PriceAmount          float64 `gorm:"type:decimal(10,2);not null" json:"price_amount"`
	Currency             string  `gorm:"size:3;default:INR" json:"currency"`
	MaxDiscountPercent   float64 `gorm:"type:decimal(5,2);default:0" json:"max_discount_percent"` // 0–100

	// Features
	MaxClassesPerMonth    *int `json:"max_classes_per_month,omitempty"`
	MaxPTSessionsPerMonth *int `json:"max_pt_sessions_per_month,omitempty"`
	GroupClassAccess      bool `gorm:"default:true" json:"group_class_access"`
	PTAccess              bool `gorm:"default:false" json:"pt_access"`
	LockerAccess          bool `gorm:"default:true" json:"locker_access"`
	FacilityAccess        bool `gorm:"default:true" json:"facility_access"`
	GymFloorAccess        bool `gorm:"default:true" json:"gym_floor_access"`
	CardioSectionAccess   bool `gorm:"default:true" json:"cardio_section_access"`

	AutoRenew              bool `gorm:"default:true" json:"auto_renew"`
	GracePeriodDays        int  `gorm:"default:3" json:"grace_period_days"`
	CancellationNoticeDays int  `gorm:"default:7" json:"cancellation_notice_days"`

	IsActive     bool `gorm:"default:true;index" json:"is_active"`
	DisplayOrder int  `gorm:"default:0" json:"display_order"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
