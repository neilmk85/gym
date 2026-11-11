package services

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── Referral & Loyalty Service ───────────────────────────────────────────────

type LoyaltyService interface {
	// Referral codes
	GetOrCreateReferralCode(memberID uint) (*models.ReferralCode, error)
	RegisterReferral(code string, refereeEmail string) (*models.Referral, error)
	ConvertReferral(id uint, refereeMemberID uint) error
	ListReferralsByMember(memberID uint) ([]*models.Referral, error)

	// Loyalty points
	GetLoyaltyAccount(memberID uint) (*models.LoyaltyAccount, error)
	EarnPoints(memberID uint, points int, desc, refModel string, refID uint) error
	RedeemPoints(memberID uint, points int, desc string) error
	ListTransactions(memberID uint, page, limit int) ([]*models.LoyaltyTransaction, int64, error)

	// Config
	GetConfig(facilityID uint) (*models.LoyaltyConfig, error)
	UpdateConfig(cfg *models.LoyaltyConfig) (*models.LoyaltyConfig, error)
}

type loyaltyService struct {
	codeRepo    repositories.ReferralCodeRepository
	refRepo     repositories.ReferralRepository
	accountRepo repositories.LoyaltyAccountRepository
	txRepo      repositories.LoyaltyTransactionRepository
	configRepo  repositories.LoyaltyConfigRepository
	logger      *slog.Logger
}

func NewLoyaltyService(
	codeRepo repositories.ReferralCodeRepository,
	refRepo repositories.ReferralRepository,
	accountRepo repositories.LoyaltyAccountRepository,
	txRepo repositories.LoyaltyTransactionRepository,
	configRepo repositories.LoyaltyConfigRepository,
	logger *slog.Logger,
) LoyaltyService {
	return &loyaltyService{
		codeRepo:    codeRepo,
		refRepo:     refRepo,
		accountRepo: accountRepo,
		txRepo:      txRepo,
		configRepo:  configRepo,
		logger:      logger,
	}
}

func (s *loyaltyService) GetOrCreateReferralCode(memberID uint) (*models.ReferralCode, error) {
	existing, err := s.codeRepo.FindByMember(memberID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	code, err := generateCode(8)
	if err != nil {
		return nil, err
	}
	rc := &models.ReferralCode{MemberID: memberID, Code: strings.ToUpper(code)}
	if err := s.codeRepo.Create(rc); err != nil {
		return nil, err
	}
	return rc, nil
}

func (s *loyaltyService) RegisterReferral(code string, refereeEmail string) (*models.Referral, error) {
	rc, err := s.codeRepo.FindByCode(strings.ToUpper(code))
	if err != nil {
		return nil, err
	}
	if rc == nil {
		return nil, apperrors.New(http.StatusNotFound, "REF_001", "referral code not found or inactive", "")
	}
	ref := &models.Referral{
		ReferrerID:     rc.MemberID,
		ReferralCodeID: rc.ID,
		RefereeEmail:   refereeEmail,
		Status:         models.ReferralStatusPending,
	}
	if err := s.refRepo.Create(ref); err != nil {
		return nil, err
	}
	return ref, nil
}

func (s *loyaltyService) ConvertReferral(id uint, refereeMemberID uint) error {
	ref, err := s.refRepo.FindByID(id)
	if err != nil {
		return err
	}
	if ref == nil {
		return apperrors.New(http.StatusNotFound, "REF_002", "referral not found", "")
	}
	if ref.Status != models.ReferralStatusPending {
		return apperrors.New(http.StatusConflict, "REF_003", "referral already processed", "")
	}
	now := time.Now()
	ref.Status = models.ReferralStatusConverted
	ref.RefereeMemberID = &refereeMemberID
	ref.ConvertedAt = &now
	cfg, _ := s.configRepo.Get(1) // facility 1 default
	rewardPoints := 100
	if cfg != nil && cfg.PointsOnReferral > 0 {
		rewardPoints = cfg.PointsOnReferral
	}
	ref.RewardPoints = rewardPoints
	if err := s.refRepo.Update(ref); err != nil {
		return err
	}
	// Credit loyalty points to referrer
	return s.EarnPoints(ref.ReferrerID, ref.RewardPoints, "Referral conversion bonus", "Referral", ref.ID)
}

func (s *loyaltyService) ListReferralsByMember(memberID uint) ([]*models.Referral, error) {
	return s.refRepo.ListByReferrer(memberID)
}

func (s *loyaltyService) GetLoyaltyAccount(memberID uint) (*models.LoyaltyAccount, error) {
	return s.accountRepo.FindOrCreate(memberID)
}

func (s *loyaltyService) EarnPoints(memberID uint, points int, desc, refModel string, refID uint) error {
	acc, err := s.accountRepo.FindOrCreate(memberID)
	if err != nil {
		return err
	}
	acc.TotalEarned += points
	acc.Balance += points
	if err := s.accountRepo.Update(acc); err != nil {
		return err
	}
	tx := &models.LoyaltyTransaction{
		MemberID:    memberID,
		TxType:      models.LoyaltyTxTypeEarned,
		Points:      points,
		Description: desc,
		RefModel:    refModel,
		RefID:       refID,
	}
	return s.txRepo.Create(tx)
}

func (s *loyaltyService) RedeemPoints(memberID uint, points int, desc string) error {
	acc, err := s.accountRepo.FindOrCreate(memberID)
	if err != nil {
		return err
	}
	if acc.Balance < points {
		return apperrors.ErrValidation("insufficient loyalty points balance")
	}
	acc.TotalRedeemed += points
	acc.Balance -= points
	if err := s.accountRepo.Update(acc); err != nil {
		return err
	}
	tx := &models.LoyaltyTransaction{
		MemberID:    memberID,
		TxType:      models.LoyaltyTxTypeRedeemed,
		Points:      -points,
		Description: desc,
	}
	return s.txRepo.Create(tx)
}

func (s *loyaltyService) ListTransactions(memberID uint, page, limit int) ([]*models.LoyaltyTransaction, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.txRepo.ListByMember(memberID, page, limit)
}

func (s *loyaltyService) GetConfig(facilityID uint) (*models.LoyaltyConfig, error) {
	return s.configRepo.Get(facilityID)
}

func (s *loyaltyService) UpdateConfig(cfg *models.LoyaltyConfig) (*models.LoyaltyConfig, error) {
	if cfg.FacilityID == 0 {
		cfg.FacilityID = 1
	}
	if err := s.configRepo.Upsert(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func generateCode(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b)[:n], nil
}
