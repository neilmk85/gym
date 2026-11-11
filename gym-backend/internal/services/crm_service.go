package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── CRM Service (lead activities + follow-ups + trial visits) ────────────────

type CRMService interface {
	// Lead activities
	LogActivity(req LogLeadActivityRequest, performedByID uint) (*models.LeadActivity, error)
	ListActivitiesByEnquiry(enquiryID uint) ([]*models.LeadActivity, error)

	// Follow-ups
	CreateFollowUp(req CreateFollowUpRequest) (*models.LeadFollowUp, error)
	GetFollowUp(id uint) (*models.LeadFollowUp, error)
	ListFollowUpsByEnquiry(enquiryID uint) ([]*models.LeadFollowUp, error)
	CompleteFollowUp(id uint) error

	// Trial visits
	ScheduleTrial(req ScheduleTrialRequest) (*models.TrialVisit, error)
	GetTrial(id uint) (*models.TrialVisit, error)
	ListTrialsByEnquiry(enquiryID uint) ([]*models.TrialVisit, error)
	ListUpcomingTrials(page, limit int) ([]*models.TrialVisit, int64, error)
	UpdateTrialStatus(id uint, status string, feedback string) error
	UpdateTrial(id uint, req UpdateTrialRequest) (*models.TrialVisit, error)
}

type UpdateTrialRequest struct {
	ScheduledAt  string `json:"scheduled_at"`
	AssignedToID uint   `json:"assigned_to_id"`
	Notes        string `json:"notes"`
}

type LogLeadActivityRequest struct {
	EnquiryID    uint   `json:"enquiry_id"`
	ActivityType string `json:"activity_type"`
	Subject      string `json:"subject"`
	Notes        string `json:"notes"`
	Outcome      string `json:"outcome"`
	ActivityDate string `json:"activity_date"` // YYYY-MM-DD
}

type CreateFollowUpRequest struct {
	EnquiryID    uint   `json:"enquiry_id"`
	AssignedToID uint   `json:"assigned_to_id"`
	DueDate      string `json:"due_date"` // YYYY-MM-DD
	Subject      string `json:"subject"`
	Notes        string `json:"notes"`
}

type ScheduleTrialRequest struct {
	EnquiryID    uint   `json:"enquiry_id"`
	ScheduledAt  string `json:"scheduled_at"` // RFC3339
	AssignedToID uint   `json:"assigned_to_id"`
	Notes        string `json:"notes"`
}

type crmService struct {
	activityRepo repositories.LeadActivityRepository
	followUpRepo repositories.LeadFollowUpRepository
	trialRepo    repositories.TrialVisitRepository
	logger       *slog.Logger
}

func NewCRMService(
	activityRepo repositories.LeadActivityRepository,
	followUpRepo repositories.LeadFollowUpRepository,
	trialRepo repositories.TrialVisitRepository,
	logger *slog.Logger,
) CRMService {
	return &crmService{
		activityRepo: activityRepo,
		followUpRepo: followUpRepo,
		trialRepo:    trialRepo,
		logger:       logger,
	}
}

func (s *crmService) LogActivity(req LogLeadActivityRequest, performedByID uint) (*models.LeadActivity, error) {
	if req.EnquiryID == 0 {
		return nil, apperrors.ErrValidation("enquiry_id is required")
	}
	actDate := time.Now()
	if req.ActivityDate != "" {
		d, err := time.Parse("2006-01-02", req.ActivityDate)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid activity_date, use YYYY-MM-DD")
		}
		actDate = d
	}
	actType := req.ActivityType
	if actType == "" {
		actType = models.LeadActivityTypeCall
	}
	a := &models.LeadActivity{
		EnquiryID:     req.EnquiryID,
		PerformedByID: performedByID,
		ActivityType:  actType,
		Subject:       req.Subject,
		Notes:         req.Notes,
		Outcome:       req.Outcome,
		ActivityDate:  actDate,
	}
	if err := s.activityRepo.Create(a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *crmService) ListActivitiesByEnquiry(enquiryID uint) ([]*models.LeadActivity, error) {
	return s.activityRepo.ListByEnquiry(enquiryID)
}

func (s *crmService) CreateFollowUp(req CreateFollowUpRequest) (*models.LeadFollowUp, error) {
	if req.EnquiryID == 0 || req.AssignedToID == 0 {
		return nil, apperrors.ErrValidation("enquiry_id and assigned_to_id are required")
	}
	if req.DueDate == "" {
		return nil, apperrors.ErrValidation("due_date is required")
	}
	dueDate, err := time.Parse("2006-01-02", req.DueDate)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid due_date, use YYYY-MM-DD")
	}
	f := &models.LeadFollowUp{
		EnquiryID:    req.EnquiryID,
		AssignedToID: req.AssignedToID,
		DueDate:      dueDate,
		Subject:      req.Subject,
		Notes:        req.Notes,
	}
	if err := s.followUpRepo.Create(f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *crmService) GetFollowUp(id uint) (*models.LeadFollowUp, error) {
	f, err := s.followUpRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if f == nil {
		return nil, apperrors.New(http.StatusNotFound, "CRM_001", "follow-up not found", "")
	}
	return f, nil
}

func (s *crmService) ListFollowUpsByEnquiry(enquiryID uint) ([]*models.LeadFollowUp, error) {
	return s.followUpRepo.ListByEnquiry(enquiryID)
}

func (s *crmService) CompleteFollowUp(id uint) error {
	f, err := s.followUpRepo.FindByID(id)
	if err != nil {
		return err
	}
	if f == nil {
		return apperrors.New(http.StatusNotFound, "CRM_001", "follow-up not found", "")
	}
	now := time.Now()
	f.IsCompleted = true
	f.CompletedAt = &now
	return s.followUpRepo.Update(f)
}

func (s *crmService) ScheduleTrial(req ScheduleTrialRequest) (*models.TrialVisit, error) {
	if req.EnquiryID == 0 {
		return nil, apperrors.ErrValidation("enquiry_id is required")
	}
	if req.ScheduledAt == "" {
		return nil, apperrors.ErrValidation("scheduled_at is required")
	}
	scheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid scheduled_at, use RFC3339 format")
	}
	t := &models.TrialVisit{
		EnquiryID:    req.EnquiryID,
		ScheduledAt:  scheduledAt,
		AssignedToID: req.AssignedToID,
		Status:       models.TrialStatusScheduled,
		Notes:        req.Notes,
	}
	if err := s.trialRepo.Create(t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *crmService) GetTrial(id uint) (*models.TrialVisit, error) {
	t, err := s.trialRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, apperrors.New(http.StatusNotFound, "CRM_002", "trial visit not found", "")
	}
	return t, nil
}

func (s *crmService) ListTrialsByEnquiry(enquiryID uint) ([]*models.TrialVisit, error) {
	return s.trialRepo.ListByEnquiry(enquiryID)
}

func (s *crmService) ListUpcomingTrials(page, limit int) ([]*models.TrialVisit, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.trialRepo.ListUpcoming(page, limit)
}

func (s *crmService) UpdateTrial(id uint, req UpdateTrialRequest) (*models.TrialVisit, error) {
	t, err := s.trialRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, apperrors.New(http.StatusNotFound, "CRM_002", "trial visit not found", "")
	}
	if req.ScheduledAt != "" {
		scheduledAt, err := time.Parse(time.RFC3339, req.ScheduledAt)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid scheduled_at, use RFC3339 format")
		}
		t.ScheduledAt = scheduledAt
	}
	if req.AssignedToID != 0 {
		t.AssignedToID = req.AssignedToID
	}
	t.Notes = req.Notes
	if err := s.trialRepo.Update(t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *crmService) UpdateTrialStatus(id uint, status string, feedback string) error {
	t, err := s.trialRepo.FindByID(id)
	if err != nil {
		return err
	}
	if t == nil {
		return apperrors.New(http.StatusNotFound, "CRM_002", "trial visit not found", "")
	}
	t.Status = status
	if feedback != "" {
		t.Feedback = feedback
	}
	return s.trialRepo.Update(t)
}

// ─── Waiver Service ───────────────────────────────────────────────────────────

type WaiverService interface {
	CreateWaiver(req CreateWaiverRequest) (*models.MemberWaiver, error)
	GetWaiver(id uint) (*models.MemberWaiver, error)
	ListWaiversByMember(memberID uint) ([]*models.MemberWaiver, error)
	SignWaiver(id uint, ipAddress string) error
}

type CreateWaiverRequest struct {
	MemberID   uint   `json:"member_id"`
	WaiverType string `json:"waiver_type"` // parq | liability | medical
	Content    string `json:"content"`
	Answers    string `json:"answers"`    // JSON answers for PAR-Q
	ExpiresAt  string `json:"expires_at"` // YYYY-MM-DD optional
	Notes      string `json:"notes"`
}

type waiverService struct {
	repo   repositories.MemberWaiverRepository
	logger *slog.Logger
}

func NewWaiverService(repo repositories.MemberWaiverRepository, logger *slog.Logger) WaiverService {
	return &waiverService{repo: repo, logger: logger}
}

func (s *waiverService) CreateWaiver(req CreateWaiverRequest) (*models.MemberWaiver, error) {
	if req.MemberID == 0 {
		return nil, apperrors.ErrValidation("member_id is required")
	}
	waiverType := req.WaiverType
	if waiverType == "" {
		waiverType = "liability"
	}
	var expiresAt *time.Time
	if req.ExpiresAt != "" {
		d, err := time.Parse("2006-01-02", req.ExpiresAt)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid expires_at, use YYYY-MM-DD")
		}
		expiresAt = &d
	}
	w := &models.MemberWaiver{
		MemberID:   req.MemberID,
		WaiverType: waiverType,
		Status:     models.WaiverStatusPending,
		Content:    req.Content,
		Answers:    req.Answers,
		ExpiresAt:  expiresAt,
		Notes:      req.Notes,
	}
	if err := s.repo.Create(w); err != nil {
		return nil, err
	}
	return w, nil
}

func (s *waiverService) GetWaiver(id uint) (*models.MemberWaiver, error) {
	w, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if w == nil {
		return nil, apperrors.New(http.StatusNotFound, "WAV_001", "waiver not found", "")
	}
	return w, nil
}

func (s *waiverService) ListWaiversByMember(memberID uint) ([]*models.MemberWaiver, error) {
	return s.repo.ListByMember(memberID)
}

func (s *waiverService) SignWaiver(id uint, ipAddress string) error {
	w, err := s.repo.FindByID(id)
	if err != nil {
		return err
	}
	if w == nil {
		return apperrors.New(http.StatusNotFound, "WAV_001", "waiver not found", "")
	}
	if w.Status == models.WaiverStatusSigned {
		return apperrors.New(http.StatusConflict, "WAV_002", "waiver already signed", "")
	}
	now := time.Now()
	w.Status = models.WaiverStatusSigned
	w.SignedAt = &now
	w.IPAddress = ipAddress
	return s.repo.Update(w)
}
