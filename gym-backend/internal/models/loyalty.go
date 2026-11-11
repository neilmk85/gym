package models

import "time"

const (
	ReferralStatusPending   = "pending"
	ReferralStatusConverted = "converted"
	ReferralStatusExpired   = "expired"

	LoyaltyTxTypeEarned   = "earned"
	LoyaltyTxTypeRedeemed = "redeemed"
	LoyaltyTxTypeExpired  = "expired"
	LoyaltyTxTypeAdjusted = "adjusted"
)

// ReferralCode is a unique code each member can share.
type ReferralCode struct {
	ID       uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID uint   `gorm:"not null;uniqueIndex" json:"member_id"`
	Code     string `gorm:"size:20;not null;uniqueIndex" json:"code"`
	IsActive bool   `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`

	Member Member `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}

// Referral tracks a referral event: who referred whom.
type Referral struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ReferrerID      uint      `gorm:"not null;index" json:"referrer_id"` // referring member
	RefereeMemberID *uint     `gorm:"index" json:"referee_member_id,omitempty"` // set when converted
	ReferralCodeID  uint      `gorm:"not null;index" json:"referral_code_id"`
	Status          string    `gorm:"type:enum('pending','converted','expired');default:pending;index" json:"status"`
	RefereeEmail    string    `gorm:"size:200" json:"referee_email,omitempty"` // captured before conversion
	ConvertedAt     *time.Time `json:"converted_at,omitempty"`
	RewardPoints    int       `gorm:"default:0" json:"reward_points"` // points awarded on conversion
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	Referrer Member `gorm:"foreignKey:ReferrerID" json:"referrer,omitempty"`
}

// LoyaltyAccount holds the running point balance for a member.
type LoyaltyAccount struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID      uint      `gorm:"not null;uniqueIndex" json:"member_id"`
	TotalEarned   int       `gorm:"default:0" json:"total_earned"`
	TotalRedeemed int       `gorm:"default:0" json:"total_redeemed"`
	Balance       int       `gorm:"default:0" json:"balance"`
	UpdatedAt     time.Time `json:"updated_at"`

	Member Member `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}

// LoyaltyConfig holds gym-level settings for the loyalty programme.
// One row per facility (facility_id=0 means global default).
type LoyaltyConfig struct {
	ID         uint `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID uint `gorm:"uniqueIndex;default:1" json:"facility_id"`

	// Earning rules — points credited per activity
	PointsOnNewMembership int `gorm:"default:50"  json:"points_on_new_membership"`
	PointsOnRenewal       int `gorm:"default:30"  json:"points_on_renewal"`
	PointsOnReferral      int `gorm:"default:100" json:"points_on_referral"`
	PointsOnDayPass       int `gorm:"default:10"  json:"points_on_day_pass"`
	PointsOnPTSession     int `gorm:"default:20"  json:"points_on_pt_session"`

	// Redemption rules
	PointsPerRupee    int `gorm:"default:10"  json:"points_per_rupee"`    // how many points = ₹1
	MinRedeemPoints   int `gorm:"default:100" json:"min_redeem_points"`    // minimum points needed to redeem
	MaxRedeemPerTx    int `gorm:"default:500" json:"max_redeem_per_tx"`    // max points redeemable in one go

	// Programme toggle
	IsActive bool `gorm:"default:true" json:"is_active"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// LoyaltyTransaction is a ledger entry for a loyalty point movement.
type LoyaltyTransaction struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID    uint      `gorm:"not null;index" json:"member_id"`
	TxType      string    `gorm:"type:enum('earned','redeemed','expired','adjusted');not null;index" json:"tx_type"`
	Points      int       `gorm:"not null" json:"points"` // positive=earn, negative=redeem/expire
	Description string    `gorm:"size:255" json:"description,omitempty"`
	RefModel    string    `gorm:"size:50" json:"ref_model,omitempty"` // e.g. "Referral", "Payment"
	RefID       uint      `gorm:"index" json:"ref_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`

	Member Member `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}
