package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type TransferRepository interface {
	Create(t *models.SubscriptionTransfer) error
	List(req utils.PageRequest) ([]*TransferRow, int64, error)
}

type TransferRow struct {
	ID                   uint   `json:"id"`
	SourceSubscriptionID uint   `json:"source_subscription_id"`
	NewSubscriptionID    *uint  `json:"new_subscription_id,omitempty"`
	SourceMemberID       uint   `json:"source_member_id"`
	TargetMemberID       uint   `json:"target_member_id"`
	SourceMemberName     string `json:"source_member_name"`
	TargetMemberName     string `json:"target_member_name"`
	PlanName             string `json:"plan_name"`
	MonthsTransferred    int    `json:"months_transferred"`
	TransferStartDate    string `json:"transfer_start_date"`
	TransferEndDate      string `json:"transfer_end_date"`
	Reason               string `json:"reason"`
	TransferredByName    string `json:"transferred_by_name"`
	CreatedAt            string `json:"created_at"`
}

type transferRepository struct {
	db *gorm.DB
}

func NewTransferRepository(db *gorm.DB) TransferRepository {
	return &transferRepository{db: db}
}

func (r *transferRepository) Create(t *models.SubscriptionTransfer) error {
	return r.db.Create(t).Error
}

func (r *transferRepository) List(req utils.PageRequest) ([]*TransferRow, int64, error) {
	var rows []*TransferRow
	var total int64

	base := r.db.Table("subscription_transfers st").
		Select(`st.id, st.source_subscription_id, st.new_subscription_id,
			st.source_member_id, st.target_member_id,
			CONCAT(smu.first_name,' ',smu.last_name) AS source_member_name,
			CONCAT(tmu.first_name,' ',tmu.last_name) AS target_member_name,
			p.name AS plan_name,
			st.months_transferred,
			DATE_FORMAT(st.transfer_start_date,'%Y-%m-%d') AS transfer_start_date,
			DATE_FORMAT(st.transfer_end_date,'%Y-%m-%d')   AS transfer_end_date,
			st.reason,
			CONCAT(u.first_name,' ',u.last_name) AS transferred_by_name,
			st.created_at`).
		Joins("JOIN members sm ON sm.id = st.source_member_id").
		Joins("JOIN users smu ON smu.id = sm.user_id").
		Joins("JOIN members tm ON tm.id = st.target_member_id").
		Joins("JOIN users tmu ON tmu.id = tm.user_id").
		Joins("JOIN subscriptions src ON src.id = st.source_subscription_id").
		Joins("JOIN plans p ON p.id = src.plan_id").
		Joins("LEFT JOIN users u ON u.id = st.transferred_by_id")

	base.Count(&total)

	err := base.Order("st.created_at DESC").
		Limit(req.PerPage).
		Offset((req.Page - 1) * req.PerPage).
		Scan(&rows).Error

	return rows, total, err
}
