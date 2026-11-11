package models

import "time"

const (
	DiscountTypePercentage  = "percentage"
	DiscountTypeFixedAmount = "fixed_amount"
	DiscountTypeFreeMonth   = "free_month"
	DiscountTypeBOGO        = "bogo"
)

type PromoCode struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID *uint  `gorm:"index" json:"facility_id,omitempty"`
	Code       string `gorm:"size:50;uniqueIndex;not null" json:"code"`

	DiscountType  string  `gorm:"type:enum('percentage','fixed_amount','free_month','bogo');not null" json:"discount_type"`
	DiscountValue float64 `gorm:"type:decimal(10,2)" json:"discount_value"`

	MaxUses          *int `json:"max_uses,omitempty"`
	MaxUsesPerMember int  `gorm:"default:1" json:"max_uses_per_member"`
	CurrentUses      int  `gorm:"default:0" json:"current_uses"`

	ValidFrom  *time.Time `gorm:"type:date" json:"valid_from,omitempty"`
	ValidUntil *time.Time `gorm:"type:date" json:"valid_until,omitempty"`

	ApplicablePlans StringSlice `gorm:"type:text" json:"applicable_plans,omitempty"`
	ApplicableRoles StringSlice `gorm:"type:text" json:"applicable_roles,omitempty"`

	IsActive        bool `gorm:"default:true;index" json:"is_active"`
	CreatedByUserID uint `json:"created_by_user_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PromoCodeUsage struct {
	ID           uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	PromoCodeID  uint    `gorm:"not null;index" json:"promo_code_id"`
	MemberID     uint    `gorm:"not null" json:"member_id"`
	SubscriptionID *uint `json:"subscription_id,omitempty"`
	DiscountAmount float64 `gorm:"type:decimal(10,2)" json:"discount_amount"`
	UsedAt       time.Time `gorm:"autoCreateTime" json:"used_at"`
}
