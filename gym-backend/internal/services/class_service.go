package services

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type CreateClassRequest struct {
	FacilityID     uint     `json:"facility_id"`
	TrainerID      *uint    `json:"trainer_id"`
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	ClassType      string   `json:"class_type"`
	DurationMins   int      `json:"duration_mins"`
	MaxCapacity    int      `json:"max_capacity"`
	StartTime      string   `json:"start_time"` // RFC3339
	IsRecurring    bool     `json:"is_recurring"`
	RecurringDays  []string `json:"recurring_days"`
	RecurringUntil string   `json:"recurring_until"` // YYYY-MM-DD
	IsFree         bool     `json:"is_free"`
	Price          float64  `json:"price"`
}

type UpdateClassRequest struct {
	TrainerID    *uint    `json:"trainer_id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	ClassType    string   `json:"class_type"`
	DurationMins *int     `json:"duration_mins"`
	MaxCapacity  *int     `json:"max_capacity"`
	StartTime    string   `json:"start_time"`
	IsFree       *bool    `json:"is_free"`
	Price        *float64 `json:"price"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type ClassService interface {
	Create(req CreateClassRequest, actorID uint, ipAddress string) (*models.Class, error)
	GetByID(id uint) (*models.Class, error)
	List(req utils.PageRequest, facilityID *uint, trainerID *uint, status string, date string) ([]*models.Class, int64, error)
	ListUpcoming(facilityID uint, limit int) ([]*models.Class, error)
	Update(id uint, req UpdateClassRequest, actorID uint, ipAddress string) (*models.Class, error)
	Cancel(id uint, actorID uint, ipAddress string) error
}

type classService struct {
	classRepo   repositories.ClassRepository
	trainerRepo repositories.TrainerRepository
	bookingRepo repositories.BookingRepository
	memberRepo  repositories.MemberRepository
	auditRepo   repositories.AuditLogRepository
	notifSvc    NotificationService
	logger      *slog.Logger
}

func NewClassService(
	classRepo repositories.ClassRepository,
	trainerRepo repositories.TrainerRepository,
	bookingRepo repositories.BookingRepository,
	memberRepo repositories.MemberRepository,
	auditRepo repositories.AuditLogRepository,
	notifSvc NotificationService,
	logger *slog.Logger,
) ClassService {
	return &classService{
		classRepo:   classRepo,
		trainerRepo: trainerRepo,
		bookingRepo: bookingRepo,
		memberRepo:  memberRepo,
		auditRepo:   auditRepo,
		notifSvc:    notifSvc,
		logger:      logger,
	}
}

func (s *classService) Create(req CreateClassRequest, actorID uint, ipAddress string) (*models.Class, error) {
	if req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("facility_id is required")
	}
	if req.Name == "" {
		return nil, apperrors.ErrValidation("name is required")
	}
	if req.StartTime == "" {
		return nil, apperrors.ErrValidation("start_time is required")
	}

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		return nil, apperrors.ErrValidation("invalid start_time; use RFC3339 format (e.g. 2026-04-12T09:00:00+05:30)")
	}
	if startTime.Before(time.Now()) {
		return nil, apperrors.ErrValidation("start_time must be in the future")
	}

	duration := req.DurationMins
	if duration <= 0 {
		duration = 60
	}
	endTime := startTime.Add(time.Duration(duration) * time.Minute)

	capacity := req.MaxCapacity
	if capacity <= 0 {
		capacity = 20
	}

	classType := req.ClassType
	if classType == "" {
		classType = models.ClassTypeOther
	}
	if !isValidClassType(classType) {
		return nil, apperrors.ErrValidation("invalid class_type")
	}

	// Validate trainer if provided.
	if req.TrainerID != nil {
		trainer, err := s.trainerRepo.FindByID(*req.TrainerID)
		if err != nil || trainer == nil {
			return nil, apperrors.New(http.StatusNotFound, "TRN_002", "Trainer not found", "")
		}
		if !trainer.IsActive {
			return nil, apperrors.ErrValidation("trainer is not active")
		}
		if trainer.FacilityID != req.FacilityID {
			return nil, apperrors.ErrValidation("trainer does not belong to this facility")
		}
	}

	class := &models.Class{
		FacilityID:   req.FacilityID,
		TrainerID:    req.TrainerID,
		Name:         req.Name,
		Description:  req.Description,
		ClassType:    classType,
		DurationMins: duration,
		MaxCapacity:  capacity,
		StartTime:    startTime,
		EndTime:      endTime,
		IsRecurring:  req.IsRecurring,
		IsFree:       req.IsFree,
		Price:        req.Price,
		Status:       models.ClassStatusScheduled,
		IsActive:     true,
		CreatedByID:  actorID,
	}

	if req.IsRecurring {
		if len(req.RecurringDays) == 0 {
			return nil, apperrors.ErrValidation("recurring_days is required when is_recurring=true")
		}
		if req.RecurringUntil == "" {
			return nil, apperrors.ErrValidation("recurring_until is required when is_recurring=true")
		}

		validDays := map[string]bool{
			"monday": true, "tuesday": true, "wednesday": true,
			"thursday": true, "friday": true, "saturday": true, "sunday": true,
		}
		for _, d := range req.RecurringDays {
			if !validDays[strings.ToLower(d)] {
				return nil, apperrors.ErrValidation("invalid day in recurring_days: " + d)
			}
		}

		t, err := time.Parse("2006-01-02", req.RecurringUntil)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid recurring_until; use YYYY-MM-DD")
		}
		if !t.After(startTime) {
			return nil, apperrors.ErrValidation("recurring_until must be after start_time")
		}
		class.RecurringDays  = models.StringSlice(req.RecurringDays)
		class.RecurringUntil = &t
	}

	if err := s.classRepo.Create(class); err != nil {
		s.logger.Error("create class failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	// Generate recurring instances after saving the parent.
	if req.IsRecurring && class.RecurringUntil != nil {
		instances := s.generateRecurringInstances(class)
		if len(instances) > 0 {
			if err := s.classRepo.CreateBatch(instances); err != nil {
				s.logger.Error("create recurring instances failed", "parent_id", class.ID, "err", err)
				// Non-fatal: parent was created successfully.
			}
		}
	}

	s.auditClass(actorID, "class.create", class.ID, nil, nil, ipAddress)

	loaded, err := s.classRepo.FindByID(class.ID)
	if err != nil || loaded == nil {
		return class, nil
	}
	return loaded, nil
}

// generateRecurringInstances builds individual Class records for each
// occurrence of the recurring schedule from the day after the parent
// through RecurringUntil (inclusive), capped at 500 instances.
func (s *classService) generateRecurringInstances(parent *models.Class) []*models.Class {
	dayMap := map[string]time.Weekday{
		"sunday": time.Sunday, "monday": time.Monday,
		"tuesday": time.Tuesday, "wednesday": time.Wednesday,
		"thursday": time.Thursday, "friday": time.Friday,
		"saturday": time.Saturday,
	}

	targetDays := make(map[time.Weekday]bool)
	for _, d := range parent.RecurringDays {
		if wd, ok := dayMap[strings.ToLower(d)]; ok {
			targetDays[wd] = true
		}
	}
	if len(targetDays) == 0 {
		return nil
	}

	until := *parent.RecurringUntil
	// Extend until to end of that day so the last day is inclusive.
	until = time.Date(until.Year(), until.Month(), until.Day(), 23, 59, 59, 0, until.Location())

	duration := time.Duration(parent.DurationMins) * time.Minute
	h, m, sec := parent.StartTime.Clock()

	const maxInstances = 500
	var instances []*models.Class

	// Start from the day after the parent to avoid duplicating it.
	cursor := parent.StartTime.AddDate(0, 0, 1)
	for !cursor.After(until) && len(instances) < maxInstances {
		if targetDays[cursor.Weekday()] {
			instanceStart := time.Date(
				cursor.Year(), cursor.Month(), cursor.Day(),
				h, m, sec, 0, cursor.Location(),
			)
			instances = append(instances, &models.Class{
				FacilityID:        parent.FacilityID,
				TrainerID:         parent.TrainerID,
				Name:              parent.Name,
				Description:       parent.Description,
				ClassType:         parent.ClassType,
				DurationMins:      parent.DurationMins,
				MaxCapacity:       parent.MaxCapacity,
				StartTime:         instanceStart,
				EndTime:           instanceStart.Add(duration),
				IsRecurring:       false, // instances are not themselves recurring
				RecurringParentID: &parent.ID,
				Status:            models.ClassStatusScheduled,
				IsActive:          true,
				IsFree:            parent.IsFree,
				Price:             parent.Price,
				CreatedByID:       parent.CreatedByID,
			})
		}
		cursor = cursor.AddDate(0, 0, 1)
	}
	return instances
}

func (s *classService) GetByID(id uint) (*models.Class, error) {
	c, err := s.classRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if c == nil {
		return nil, apperrors.New(http.StatusNotFound, "CLS_001", "Class not found", "")
	}
	return c, nil
}

func (s *classService) List(req utils.PageRequest, facilityID *uint, trainerID *uint, status string, date string) ([]*models.Class, int64, error) {
	if date != "" {
		req.Filters["date_from"] = date + "T00:00:00Z"
		req.Filters["date_to"] = date + "T23:59:59Z"
	}
	return s.classRepo.List(req, facilityID, trainerID, status)
}

func (s *classService) ListUpcoming(facilityID uint, limit int) ([]*models.Class, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	return s.classRepo.ListUpcoming(facilityID, time.Now(), limit)
}

func (s *classService) Update(id uint, req UpdateClassRequest, actorID uint, ipAddress string) (*models.Class, error) {
	class, err := s.classRepo.FindByID(id)
	if err != nil || class == nil {
		return nil, apperrors.New(http.StatusNotFound, "CLS_001", "Class not found", "")
	}
	if class.Status == models.ClassStatusCancelled || class.Status == models.ClassStatusCompleted {
		return nil, apperrors.New(http.StatusConflict, "CLS_002", "Cannot update a cancelled or completed class", "")
	}

	if req.Name != "" {
		class.Name = req.Name
	}
	if req.Description != "" {
		class.Description = req.Description
	}
	if req.ClassType != "" {
		if !isValidClassType(req.ClassType) {
			return nil, apperrors.ErrValidation("invalid class_type")
		}
		class.ClassType = req.ClassType
	}
	if req.DurationMins != nil && *req.DurationMins > 0 {
		class.DurationMins = *req.DurationMins
		class.EndTime = class.StartTime.Add(time.Duration(*req.DurationMins) * time.Minute)
	}
	if req.MaxCapacity != nil && *req.MaxCapacity > 0 {
		if *req.MaxCapacity < class.CurrentEnrollment {
			return nil, apperrors.ErrValidation("new max_capacity cannot be less than current enrollment")
		}
		class.MaxCapacity = *req.MaxCapacity
	}
	if req.StartTime != "" {
		t, err := time.Parse(time.RFC3339, req.StartTime)
		if err != nil {
			return nil, apperrors.ErrValidation("invalid start_time; use RFC3339 format")
		}
		class.StartTime = t
		class.EndTime = t.Add(time.Duration(class.DurationMins) * time.Minute)
	}
	if req.IsFree != nil {
		class.IsFree = *req.IsFree
	}
	if req.Price != nil {
		class.Price = *req.Price
	}
	// Trainer update — validate if provided.
	if req.TrainerID != nil {
		if *req.TrainerID == 0 {
			class.TrainerID = nil
		} else {
			trainer, err := s.trainerRepo.FindByID(*req.TrainerID)
			if err != nil || trainer == nil {
				return nil, apperrors.New(http.StatusNotFound, "TRN_002", "Trainer not found", "")
			}
			class.TrainerID = req.TrainerID
		}
	}

	if err := s.classRepo.Update(class); err != nil {
		return nil, apperrors.ErrInternal
	}

	s.auditClass(actorID, "class.update", id, nil, nil, ipAddress)

	loaded, err := s.classRepo.FindByID(id)
	if err != nil || loaded == nil {
		return class, nil
	}
	return loaded, nil
}

func (s *classService) Cancel(id uint, actorID uint, ipAddress string) error {
	class, err := s.classRepo.FindByID(id)
	if err != nil || class == nil {
		return apperrors.New(http.StatusNotFound, "CLS_001", "Class not found", "")
	}
	if class.Status == models.ClassStatusCancelled {
		return apperrors.New(http.StatusConflict, "CLS_003", "Class is already cancelled", "")
	}
	if class.Status == models.ClassStatusCompleted {
		return apperrors.New(http.StatusConflict, "CLS_002", "Cannot cancel a completed class", "")
	}

	class.Status = models.ClassStatusCancelled
	class.IsActive = false
	if err := s.classRepo.Update(class); err != nil {
		return apperrors.ErrInternal
	}

	s.auditClass(actorID, "class.cancel", id, nil, nil, ipAddress)

	// Notify all confirmed/waitlisted members.
	go s.notifyClassCancelled(class)

	return nil
}

func (s *classService) notifyClassCancelled(class *models.Class) {
	req := utils.PageRequest{Page: 1, PerPage: 500}
	bookings, _, err := s.bookingRepo.ListByClass(class.ID, req)
	if err != nil {
		s.logger.Error("class cancel: list bookings failed", "class_id", class.ID, "err", err)
		return
	}
	for _, b := range bookings {
		if b.Status == models.BookingStatusCancelled || b.MemberID == nil {
			continue
		}
		member, err := s.memberRepo.FindByID(*b.MemberID)
		if err != nil || member == nil {
			continue
		}
		_ = s.notifSvc.Dispatch(ClassCancelledEvent(member.User.ID, class.ID, class.Name))
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func isValidClassType(t string) bool {
	switch t {
	case models.ClassTypeYoga, models.ClassTypeCardio, models.ClassTypeStrength,
		models.ClassTypeZumba, models.ClassTypePilates, models.ClassTypeCrossfit,
		models.ClassTypeSpin, models.ClassTypeHIIT, models.ClassTypeOther:
		return true
	}
	return false
}

func (s *classService) auditClass(userID uint, action string, resourceID uint, old, new models.JSONMap, ip string) {
	rid := resourceID
	_ = s.auditRepo.Create(&models.AuditLog{
		UserID:       userID,
		Action:       action,
		ResourceType: "class",
		ResourceID:   &rid,
		OldValues:    old,
		NewValues:    new,
		IPAddress:    ip,
	})
}
