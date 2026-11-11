package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── Body Measurement Service ─────────────────────────────────────────────────

type BodyMeasurementService interface {
	RecordMeasurement(req RecordMeasurementRequest, recordedByID uint) (*models.MemberBodyMeasurement, error)
	GetMeasurement(id uint) (*models.MemberBodyMeasurement, error)
	ListMeasurementsByMember(memberID uint, page, limit int) ([]*models.MemberBodyMeasurement, int64, error)
	DeleteMeasurement(id uint) error
}

type RecordMeasurementRequest struct {
	MemberID     uint     `json:"member_id"`
	MeasuredAt   string   `json:"measured_at"` // YYYY-MM-DD
	WeightKg     *float64 `json:"weight_kg"`
	HeightCm     *float64 `json:"height_cm"`
	BodyFatPct   *float64 `json:"body_fat_pct"`
	MuscleMassKg *float64 `json:"muscle_mass_kg"`
	WaistCm      *float64 `json:"waist_cm"`
	ChestCm      *float64 `json:"chest_cm"`
	HipsCm       *float64 `json:"hips_cm"`
	ThighCm      *float64 `json:"thigh_cm"`
	BicepCm      *float64 `json:"bicep_cm"`
	Notes        string   `json:"notes"`
}

type bodyMeasurementService struct {
	repo   repositories.BodyMeasurementRepository
	logger *slog.Logger
}

func NewBodyMeasurementService(repo repositories.BodyMeasurementRepository, logger *slog.Logger) BodyMeasurementService {
	return &bodyMeasurementService{repo: repo, logger: logger}
}

func (s *bodyMeasurementService) RecordMeasurement(req RecordMeasurementRequest, recordedByID uint) (*models.MemberBodyMeasurement, error) {
	if req.MemberID == 0 {
		return nil, apperrors.ErrValidation("member_id is required")
	}
	if req.MeasuredAt == "" {
		return nil, apperrors.ErrValidation("measured_at is required")
	}
	measuredAt, err := time.Parse("2006-01-02", req.MeasuredAt)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid measured_at, use YYYY-MM-DD")
	}
	var bmi *float64
	if req.WeightKg != nil && req.HeightCm != nil && *req.HeightCm > 0 {
		h := *req.HeightCm / 100
		v := *req.WeightKg / (h * h)
		bmi = &v
	}
	m := &models.MemberBodyMeasurement{
		MemberID:     req.MemberID,
		RecordedByID: recordedByID,
		MeasuredAt:   measuredAt,
		WeightKg:     req.WeightKg,
		HeightCm:     req.HeightCm,
		BodyFatPct:   req.BodyFatPct,
		MuscleMassKg: req.MuscleMassKg,
		WaistCm:      req.WaistCm,
		ChestCm:      req.ChestCm,
		HipsCm:       req.HipsCm,
		ThighCm:      req.ThighCm,
		BicepCm:      req.BicepCm,
		BMI:          bmi,
		Notes:        req.Notes,
	}
	if err := s.repo.Create(m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *bodyMeasurementService) GetMeasurement(id uint) (*models.MemberBodyMeasurement, error) {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return nil, apperrors.New(http.StatusNotFound, "MEAS_001", "measurement not found", "")
	}
	return m, nil
}

func (s *bodyMeasurementService) ListMeasurementsByMember(memberID uint, page, limit int) ([]*models.MemberBodyMeasurement, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.repo.ListByMember(memberID, page, limit)
}

func (s *bodyMeasurementService) DeleteMeasurement(id uint) error {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}
	if m == nil {
		return apperrors.New(http.StatusNotFound, "MEAS_001", "measurement not found", "")
	}
	return s.repo.Delete(id)
}

// ─── Progress Photo Service ───────────────────────────────────────────────────

type ProgressPhotoService interface {
	AddPhoto(req AddProgressPhotoRequest, uploadedByID uint) (*models.MemberProgressPhoto, error)
	GetPhoto(id uint) (*models.MemberProgressPhoto, error)
	ListPhotosByMember(memberID uint, page, limit int) ([]*models.MemberProgressPhoto, int64, error)
	DeletePhoto(id uint) error
}

type AddProgressPhotoRequest struct {
	MemberID  uint   `json:"member_id"`
	PhotoURL  string `json:"photo_url"`
	Angle     string `json:"angle"`
	PhotoDate string `json:"photo_date"` // YYYY-MM-DD
	Notes     string `json:"notes"`
}

type progressPhotoService struct {
	repo   repositories.ProgressPhotoRepository
	logger *slog.Logger
}

func NewProgressPhotoService(repo repositories.ProgressPhotoRepository, logger *slog.Logger) ProgressPhotoService {
	return &progressPhotoService{repo: repo, logger: logger}
}

func (s *progressPhotoService) AddPhoto(req AddProgressPhotoRequest, uploadedByID uint) (*models.MemberProgressPhoto, error) {
	if req.MemberID == 0 {
		return nil, apperrors.ErrValidation("member_id is required")
	}
	if req.PhotoURL == "" {
		return nil, apperrors.ErrValidation("photo_url is required")
	}
	photoDate := time.Now()
	if req.PhotoDate != "" {
		d, err := time.Parse("2006-01-02", req.PhotoDate)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid photo_date, use YYYY-MM-DD")
		}
		photoDate = d
	}
	p := &models.MemberProgressPhoto{
		MemberID:     req.MemberID,
		UploadedByID: uploadedByID,
		PhotoURL:     req.PhotoURL,
		Angle:        req.Angle,
		PhotoDate:    photoDate,
		Notes:        req.Notes,
	}
	if err := s.repo.Create(p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *progressPhotoService) GetPhoto(id uint) (*models.MemberProgressPhoto, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, apperrors.New(http.StatusNotFound, "PHOTO_001", "photo not found", "")
	}
	return p, nil
}

func (s *progressPhotoService) ListPhotosByMember(memberID uint, page, limit int) ([]*models.MemberProgressPhoto, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.repo.ListByMember(memberID, page, limit)
}

func (s *progressPhotoService) DeletePhoto(id uint) error {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}
	if p == nil {
		return apperrors.New(http.StatusNotFound, "PHOTO_001", "photo not found", "")
	}
	return s.repo.Delete(id)
}

// ─── Retention Service ────────────────────────────────────────────────────────

type RetentionService interface {
	RaiseRisk(req RaiseRetentionRiskRequest, raisedByID uint) (*models.RetentionRisk, error)
	GetRisk(id uint) (*models.RetentionRisk, error)
	ListOpenRisks(page, limit int) ([]*models.RetentionRisk, int64, error)
	ListRisksByMember(memberID uint, page, limit int) ([]*models.RetentionRisk, int64, error)
	ResolveRisk(id uint, notes string) error

	CreateAction(req CreateRetentionActionRequest) (*models.RetentionAction, error)
	GetAction(id uint) (*models.RetentionAction, error)
	ListActionsByRisk(riskID uint) ([]*models.RetentionAction, error)
	CompleteAction(id uint, outcome string) error
}

type RaiseRetentionRiskRequest struct {
	MemberID  uint   `json:"member_id"`
	RiskLevel string `json:"risk_level"` // low | medium | high
	Reason    string `json:"reason"`
	Notes     string `json:"notes"`
}

type CreateRetentionActionRequest struct {
	RetentionRiskID uint   `json:"retention_risk_id"`
	MemberID        uint   `json:"member_id"`
	AssignedToID    uint   `json:"assigned_to_id"`
	ActionType      string `json:"action_type"` // call | message | visit | other
	DueDate         string `json:"due_date"`    // YYYY-MM-DD
	Notes           string `json:"notes"`
}

type retentionService struct {
	riskRepo   repositories.RetentionRiskRepository
	actionRepo repositories.RetentionActionRepository
	logger     *slog.Logger
}

func NewRetentionService(
	riskRepo repositories.RetentionRiskRepository,
	actionRepo repositories.RetentionActionRepository,
	logger *slog.Logger,
) RetentionService {
	return &retentionService{riskRepo: riskRepo, actionRepo: actionRepo, logger: logger}
}

func (s *retentionService) RaiseRisk(req RaiseRetentionRiskRequest, raisedByID uint) (*models.RetentionRisk, error) {
	if req.MemberID == 0 {
		return nil, apperrors.ErrValidation("member_id is required")
	}
	if req.Reason == "" {
		return nil, apperrors.ErrValidation("reason is required")
	}
	riskLevel := req.RiskLevel
	if riskLevel == "" {
		riskLevel = models.RetentionRiskMedium
	}
	r := &models.RetentionRisk{
		MemberID:   req.MemberID,
		RaisedByID: raisedByID,
		RiskLevel:  riskLevel,
		Reason:     req.Reason,
		Notes:      req.Notes,
	}
	if err := s.riskRepo.Create(r); err != nil {
		return nil, err
	}
	return s.riskRepo.FindByID(r.ID)
}

func (s *retentionService) GetRisk(id uint) (*models.RetentionRisk, error) {
	r, err := s.riskRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, apperrors.New(http.StatusNotFound, "RET_001", "retention risk not found", "")
	}
	return r, nil
}

func (s *retentionService) ListOpenRisks(page, limit int) ([]*models.RetentionRisk, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.riskRepo.ListOpen(page, limit)
}

func (s *retentionService) ListRisksByMember(memberID uint, page, limit int) ([]*models.RetentionRisk, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.riskRepo.ListByMember(memberID, page, limit)
}

func (s *retentionService) ResolveRisk(id uint, notes string) error {
	r, err := s.riskRepo.FindByID(id)
	if err != nil {
		return err
	}
	if r == nil {
		return apperrors.New(http.StatusNotFound, "RET_001", "retention risk not found", "")
	}
	now := time.Now()
	r.IsResolved = true
	r.ResolvedAt = &now
	if notes != "" {
		r.Notes = notes
	}
	return s.riskRepo.Update(r)
}

func (s *retentionService) CreateAction(req CreateRetentionActionRequest) (*models.RetentionAction, error) {
	if req.RetentionRiskID == 0 || req.MemberID == 0 || req.AssignedToID == 0 {
		return nil, apperrors.ErrValidation("retention_risk_id, member_id, and assigned_to_id are required")
	}
	if req.DueDate == "" {
		return nil, apperrors.ErrValidation("due_date is required")
	}
	dueDate, err := time.Parse("2006-01-02", req.DueDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid due_date, use YYYY-MM-DD")
	}
	actionType := req.ActionType
	if actionType == "" {
		actionType = models.RetentionActionTypeCall
	}
	a := &models.RetentionAction{
		RetentionRiskID: req.RetentionRiskID,
		MemberID:        req.MemberID,
		AssignedToID:    req.AssignedToID,
		ActionType:      actionType,
		Status:          models.RetentionActionStatusOpen,
		DueDate:         dueDate,
		Notes:           req.Notes,
	}
	if err := s.actionRepo.Create(a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *retentionService) GetAction(id uint) (*models.RetentionAction, error) {
	a, err := s.actionRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, apperrors.New(http.StatusNotFound, "RET_002", "retention action not found", "")
	}
	return a, nil
}

func (s *retentionService) ListActionsByRisk(riskID uint) ([]*models.RetentionAction, error) {
	return s.actionRepo.ListByRisk(riskID)
}

func (s *retentionService) CompleteAction(id uint, outcome string) error {
	a, err := s.actionRepo.FindByID(id)
	if err != nil {
		return err
	}
	if a == nil {
		return apperrors.New(http.StatusNotFound, "RET_002", "retention action not found", "")
	}
	now := time.Now()
	a.Status = models.RetentionActionStatusDone
	a.Outcome = outcome
	a.CompletedAt = &now
	return s.actionRepo.Update(a)
}
