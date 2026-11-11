package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── DTOs ─────────────────────────────────────────────────────────────────────

type CreatePTPackageRequest struct {
	FacilityID   uint    `json:"facility_id"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Sessions     int     `json:"sessions"`
	ValidityDays int     `json:"validity_days"`
	Price        float64 `json:"price"`
}

type PurchasePTPackageRequest struct {
	MemberID    uint    `json:"member_id"`
	FacilityID  uint    `json:"facility_id"`
	PTPackageID uint    `json:"pt_package_id"`
	TrainerID   *uint   `json:"trainer_id"`
	PaymentID   *uint   `json:"payment_id"`
	Amount      float64 `json:"amount"`
	Notes       string  `json:"notes"`
}

type SchedulePTSessionRequest struct {
	MemberID          uint   `json:"member_id"`
	FacilityID        uint   `json:"facility_id"`
	MemberPTPackageID *uint  `json:"member_pt_package_id"`
	TrainerID         uint   `json:"trainer_id"`
	ScheduledAt       string `json:"scheduled_at"` // RFC3339
	DurationMinutes   int    `json:"duration_minutes"`
	Notes             string `json:"notes"`
}

// ─── Service Interface ────────────────────────────────────────────────────────

type PTService interface {
	// PT Package catalog
	CreatePackage(req CreatePTPackageRequest, actorID uint) (*models.PTPackage, error)
	ListPackages(facilityID uint) ([]*models.PTPackage, error)
	GetPackage(id uint) (*models.PTPackage, error)
	DeactivatePackage(id uint) error

	// Member PT package purchases
	PurchasePackage(req PurchasePTPackageRequest, actorID uint) (*models.MemberPTPackage, error)
	GetMemberPackage(id uint) (*models.MemberPTPackage, error)
	ListMemberPackages(memberID uint, page, limit int) ([]*models.MemberPTPackage, int64, error)
	ListAllMemberPackages(facilityID uint, page, limit int) ([]*models.MemberPTPackage, int64, error)
	GetActivePackagesForMember(memberID uint) ([]*models.MemberPTPackage, error)

	// PT session scheduling
	ScheduleSession(req SchedulePTSessionRequest, actorID uint) (*models.PTSession, error)
	CompleteSession(sessionID uint, trainerNotes string, actorID uint) (*models.PTSession, error)
	CancelSession(sessionID uint, reason string, actorID uint) (*models.PTSession, error)
	MarkNoShow(sessionID uint, actorID uint) (*models.PTSession, error)
	ListSessionsByMember(memberID uint, page, limit int) ([]*models.PTSession, int64, error)
	ListSessionsByTrainer(trainerID uint, page, limit int) ([]*models.PTSession, int64, error)
	ListSessionsByFacility(facilityID uint, trainerID uint, status string, page, limit int) ([]*models.PTSession, int64, error)
	GetSession(id uint) (*models.PTSession, error)

	// Credit ledger
	GetSessionCredits(memberID uint) ([]*models.SessionCreditLedger, error)
}

// ─── Implementation ───────────────────────────────────────────────────────────

type ptService struct {
	pkgRepo     repositories.PTPackageRepository
	memPkgRepo  repositories.MemberPTPackageRepository
	sessionRepo repositories.PTSessionRepository
	creditRepo  repositories.SessionCreditLedgerRepository
	memberRepo  repositories.MemberRepository
	trainerRepo repositories.TrainerRepository
	logger      *slog.Logger
}

func NewPTService(
	pkgRepo repositories.PTPackageRepository,
	memPkgRepo repositories.MemberPTPackageRepository,
	sessionRepo repositories.PTSessionRepository,
	creditRepo repositories.SessionCreditLedgerRepository,
	memberRepo repositories.MemberRepository,
	trainerRepo repositories.TrainerRepository,
	logger *slog.Logger,
) PTService {
	return &ptService{
		pkgRepo:     pkgRepo,
		memPkgRepo:  memPkgRepo,
		sessionRepo: sessionRepo,
		creditRepo:  creditRepo,
		memberRepo:  memberRepo,
		trainerRepo: trainerRepo,
		logger:      logger,
	}
}

// ── Package Catalog ───────────────────────────────────────────────────────────

func (s *ptService) CreatePackage(req CreatePTPackageRequest, actorID uint) (*models.PTPackage, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.Sessions <= 0 {
		return nil, apperrors.ErrValidation("sessions must be > 0")
	}
	if req.Price < 0 {
		return nil, apperrors.ErrValidation("price cannot be negative")
	}
	if req.FacilityID == 0 {
		req.FacilityID = 1
	}
	validity := req.ValidityDays
	if validity <= 0 {
		validity = 90
	}

	p := &models.PTPackage{
		FacilityID:   req.FacilityID,
		Name:         req.Name,
		Description:  req.Description,
		Sessions:     req.Sessions,
		ValidityDays: validity,
		Price:        req.Price,
		Currency:     "INR",
		Status:       models.PTPackageStatusActive,
		IsActive:     true,
		CreatedByID:  actorID,
	}
	if err := s.pkgRepo.Create(p); err != nil {
		return nil, apperrors.ErrInternal
	}
	return p, nil
}

func (s *ptService) ListPackages(facilityID uint) ([]*models.PTPackage, error) {
	if facilityID == 0 {
		facilityID = 1
	}
	return s.pkgRepo.ListByFacility(facilityID)
}

func (s *ptService) GetPackage(id uint) (*models.PTPackage, error) {
	p, err := s.pkgRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if p == nil {
		return nil, apperrors.New(http.StatusNotFound, "PT_001", "PT package not found", "")
	}
	return p, nil
}

func (s *ptService) DeactivatePackage(id uint) error {
	p, err := s.pkgRepo.FindByID(id)
	if err != nil || p == nil {
		return apperrors.New(http.StatusNotFound, "PT_001", "PT package not found", "")
	}
	p.IsActive = false
	p.Status = models.PTPackageStatusInactive
	return s.pkgRepo.Update(p)
}

// ── Member Package Purchases ──────────────────────────────────────────────────

func (s *ptService) PurchasePackage(req PurchasePTPackageRequest, actorID uint) (*models.MemberPTPackage, error) {
	if req.MemberID == 0 || req.PTPackageID == 0 {
		return nil, apperrors.ErrValidation("member_id and pt_package_id are required")
	}

	member, err := s.memberRepo.FindByID(req.MemberID)
	if err != nil || member == nil {
		return nil, apperrors.ErrMemberNotFound
	}

	pkg, err := s.pkgRepo.FindByID(req.PTPackageID)
	if err != nil || pkg == nil {
		return nil, apperrors.New(http.StatusNotFound, "PT_001", "PT package not found", "")
	}
	if !pkg.IsActive {
		return nil, apperrors.New(http.StatusConflict, "PT_002", "PT package is not active", "")
	}

	amount := req.Amount
	if amount <= 0 {
		amount = pkg.Price
	}

	now := time.Now()
	expiresAt := now.AddDate(0, 0, pkg.ValidityDays)

	memPkg := &models.MemberPTPackage{
		MemberID:      req.MemberID,
		FacilityID:    req.FacilityID,
		PTPackageID:   req.PTPackageID,
		TrainerID:     req.TrainerID,
		PaymentID:     req.PaymentID,
		TotalSessions: pkg.Sessions,
		UsedSessions:  0,
		Amount:        amount,
		Currency:      "INR",
		PurchasedAt:   now,
		ExpiresAt:     expiresAt,
		IsActive:      true,
		Notes:         req.Notes,
		CreatedByID:   actorID,
	}

	if err := s.memPkgRepo.Create(memPkg); err != nil {
		return nil, apperrors.ErrInternal
	}

	// Record initial credit in session ledger
	_ = s.creditRepo.Create(&models.SessionCreditLedger{
		MemberID:          req.MemberID,
		MemberPTPackageID: memPkg.ID,
		EntryType:         models.SessionCreditTypeCredit,
		Sessions:          pkg.Sessions,
		BalanceAfter:      pkg.Sessions,
		Description:       "Package purchased: " + pkg.Name,
		ActorID:           actorID,
	})

	loaded, _ := s.memPkgRepo.FindByID(memPkg.ID)
	if loaded != nil {
		return loaded, nil
	}
	return memPkg, nil
}

func (s *ptService) GetMemberPackage(id uint) (*models.MemberPTPackage, error) {
	m, err := s.memPkgRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if m == nil {
		return nil, apperrors.New(http.StatusNotFound, "PT_003", "Member PT package not found", "")
	}
	return m, nil
}

func (s *ptService) ListAllMemberPackages(facilityID uint, page, limit int) ([]*models.MemberPTPackage, int64, error) {
	return s.memPkgRepo.ListByFacility(facilityID, page, limit)
}

func (s *ptService) ListMemberPackages(memberID uint, page, limit int) ([]*models.MemberPTPackage, int64, error) {
	if page < 1 { page = 1 }
	if limit < 1 || limit > 100 { limit = 20 }
	return s.memPkgRepo.ListByMember(memberID, page, limit)
}

func (s *ptService) GetActivePackagesForMember(memberID uint) ([]*models.MemberPTPackage, error) {
	return s.memPkgRepo.FindActiveByMember(memberID)
}

// ── Session Scheduling ────────────────────────────────────────────────────────

func (s *ptService) ScheduleSession(req SchedulePTSessionRequest, actorID uint) (*models.PTSession, error) {
	if req.MemberID == 0 || req.TrainerID == 0 {
		return nil, apperrors.ErrValidation("member_id and trainer_id are required")
	}
	if req.ScheduledAt == "" {
		return nil, apperrors.ErrValidation("scheduled_at is required")
	}

	scheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid scheduled_at, use RFC3339 format")
	}
	if scheduledAt.Before(time.Now()) {
		return nil, apperrors.ErrValidation("scheduled_at must be in the future")
	}

	// Deduct from member PT package if provided
	if req.MemberPTPackageID != nil {
		memPkg, err := s.memPkgRepo.FindByID(*req.MemberPTPackageID)
		if err != nil || memPkg == nil {
			return nil, apperrors.New(http.StatusNotFound, "PT_003", "Member PT package not found", "")
		}
		if memPkg.MemberID != req.MemberID {
			return nil, apperrors.New(http.StatusForbidden, "PT_004", "Package does not belong to this member", "")
		}
		remaining := memPkg.TotalSessions - memPkg.UsedSessions
		if remaining <= 0 {
			return nil, apperrors.New(http.StatusConflict, "PT_005", "No sessions remaining in this package", "")
		}
		if time.Now().After(memPkg.ExpiresAt) {
			return nil, apperrors.New(http.StatusConflict, "PT_006", "Package has expired", "")
		}
	}

	duration := req.DurationMinutes
	if duration <= 0 {
		duration = 60
	}
	facilityID := req.FacilityID
	if facilityID == 0 {
		facilityID = 1
	}

	session := &models.PTSession{
		MemberID:          req.MemberID,
		FacilityID:        facilityID,
		MemberPTPackageID: req.MemberPTPackageID,
		TrainerID:         req.TrainerID,
		ScheduledAt:       scheduledAt,
		DurationMinutes:   duration,
		Status:            models.PTSessionStatusScheduled,
		Notes:             req.Notes,
		CreatedByID:       actorID,
	}

	if err := s.sessionRepo.Create(session); err != nil {
		return nil, apperrors.ErrInternal
	}

	// Deduct session credit from package
	if req.MemberPTPackageID != nil {
		_ = s.memPkgRepo.IncrementUsed(*req.MemberPTPackageID)
		memPkg, _ := s.memPkgRepo.FindByID(*req.MemberPTPackageID)
		if memPkg != nil {
			remaining := memPkg.TotalSessions - memPkg.UsedSessions
			sessionID := session.ID
			_ = s.creditRepo.Create(&models.SessionCreditLedger{
				MemberID:          req.MemberID,
				MemberPTPackageID: *req.MemberPTPackageID,
				PTSessionID:       &sessionID,
				EntryType:         models.SessionCreditTypeDebit,
				Sessions:          -1,
				BalanceAfter:      remaining,
				Description:       "Session booked",
				ActorID:           actorID,
			})
		}
	}

	loaded, _ := s.sessionRepo.FindByID(session.ID)
	if loaded != nil {
		return loaded, nil
	}
	return session, nil
}

func (s *ptService) CompleteSession(sessionID uint, trainerNotes string, actorID uint) (*models.PTSession, error) {
	session, err := s.sessionRepo.FindByID(sessionID)
	if err != nil || session == nil {
		return nil, apperrors.New(http.StatusNotFound, "PT_007", "PT session not found", "")
	}
	if session.Status != models.PTSessionStatusScheduled {
		return nil, apperrors.New(http.StatusConflict, "PT_008", "Session is not in scheduled status", "")
	}

	now := time.Now()
	session.Status = models.PTSessionStatusCompleted
	session.CompletedAt = &now
	session.TrainerNotes = trainerNotes

	if err := s.sessionRepo.Update(session); err != nil {
		return nil, apperrors.ErrInternal
	}
	return session, nil
}

func (s *ptService) CancelSession(sessionID uint, reason string, actorID uint) (*models.PTSession, error) {
	session, err := s.sessionRepo.FindByID(sessionID)
	if err != nil || session == nil {
		return nil, apperrors.New(http.StatusNotFound, "PT_007", "PT session not found", "")
	}
	if session.Status != models.PTSessionStatusScheduled {
		return nil, apperrors.New(http.StatusConflict, "PT_008", "Cannot cancel a session that is not scheduled", "")
	}

	session.Status = models.PTSessionStatusCancelled
	session.CancelReason = reason
	session.CancelledByID = &actorID

	if err := s.sessionRepo.Update(session); err != nil {
		return nil, apperrors.ErrInternal
	}

	// Refund credit back to package
	if session.MemberPTPackageID != nil {
		_ = s.memPkgRepo.DecrementUsed(*session.MemberPTPackageID)
		memPkg, _ := s.memPkgRepo.FindByID(*session.MemberPTPackageID)
		if memPkg != nil {
			remaining := memPkg.TotalSessions - memPkg.UsedSessions
			sessionID := session.ID
			_ = s.creditRepo.Create(&models.SessionCreditLedger{
				MemberID:          session.MemberID,
				MemberPTPackageID: *session.MemberPTPackageID,
				PTSessionID:       &sessionID,
				EntryType:         models.SessionCreditTypeRefund,
				Sessions:          1,
				BalanceAfter:      remaining,
				Description:       "Session cancelled: " + reason,
				ActorID:           actorID,
			})
		}
	}

	return session, nil
}

func (s *ptService) MarkNoShow(sessionID uint, actorID uint) (*models.PTSession, error) {
	session, err := s.sessionRepo.FindByID(sessionID)
	if err != nil || session == nil {
		return nil, apperrors.New(http.StatusNotFound, "PT_007", "PT session not found", "")
	}
	if session.Status != models.PTSessionStatusScheduled {
		return nil, apperrors.New(http.StatusConflict, "PT_008", "Session is not in scheduled status", "")
	}

	session.Status = models.PTSessionStatusNoShow
	if err := s.sessionRepo.Update(session); err != nil {
		return nil, apperrors.ErrInternal
	}
	return session, nil
}

func (s *ptService) ListSessionsByMember(memberID uint, page, limit int) ([]*models.PTSession, int64, error) {
	if page < 1 { page = 1 }
	if limit < 1 || limit > 100 { limit = 20 }
	return s.sessionRepo.ListByMember(memberID, page, limit)
}

func (s *ptService) ListSessionsByTrainer(trainerID uint, page, limit int) ([]*models.PTSession, int64, error) {
	if page < 1 { page = 1 }
	if limit < 1 || limit > 100 { limit = 20 }
	return s.sessionRepo.ListByTrainer(trainerID, page, limit)
}

func (s *ptService) ListSessionsByFacility(facilityID uint, trainerID uint, status string, page, limit int) ([]*models.PTSession, int64, error) {
	if page < 1 { page = 1 }
	if limit < 1 || limit > 100 { limit = 20 }
	return s.sessionRepo.ListByFacility(facilityID, trainerID, status, page, limit)
}

func (s *ptService) GetSession(id uint) (*models.PTSession, error) {
	session, err := s.sessionRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if session == nil {
		return nil, apperrors.New(http.StatusNotFound, "PT_007", "PT session not found", "")
	}
	return session, nil
}

func (s *ptService) GetSessionCredits(memberID uint) ([]*models.SessionCreditLedger, error) {
	return s.creditRepo.ListByMember(memberID)
}
