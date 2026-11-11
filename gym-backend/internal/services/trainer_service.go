package services

import (
	"log/slog"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/constants"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type CreateShiftRequest struct {
	DayOfWeek int                   `json:"day_of_week"` // 0=Mon … 6=Sun
	StartTime string                `json:"start_time"`  // "HH:MM"
	EndTime   string                `json:"end_time"`
	Breaks    []models.BreakTime    `json:"breaks"`
	Notes     string                `json:"notes"`
}

type UpdateShiftRequest struct {
	StartTime *string               `json:"start_time"`
	EndTime   *string               `json:"end_time"`
	Breaks    []models.BreakTime    `json:"breaks"`
	Notes     *string               `json:"notes"`
	IsActive  *bool                 `json:"is_active"`
}

type CreateTrainerRequest struct {
	// New user fields
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Password  string `json:"password"`

	// OR link to existing user
	UserID uint `json:"user_id"`

	FacilityID      uint     `json:"facility_id"`
	Bio             string   `json:"bio"`
	Specializations []string `json:"specializations"`
	Certifications  []string `json:"certifications"`
	ExperienceYears int      `json:"experience_years"`
	HourlyRate      float64  `json:"hourly_rate"`
	MaxClientsPerDay int     `json:"max_clients_per_day"`
}

type UpdateTrainerRequest struct {
	FacilityID       *uint    `json:"facility_id"`
	Bio              string   `json:"bio"`
	Specializations  []string `json:"specializations"`
	Certifications   []string `json:"certifications"`
	ExperienceYears  *int     `json:"experience_years"`
	HourlyRate       *float64 `json:"hourly_rate"`
	MaxClientsPerDay *int     `json:"max_clients_per_day"`
	WeeklyOffDays    []int    `json:"weekly_off_days"`
	SetWeeklyOffDays bool     `json:"set_weekly_off_days"` // explicit flag so empty slice clears all
}

// ─── Service ─────────────────────────────────────────────────────────────────

type TrainerService interface {
	Create(req CreateTrainerRequest, actorID uint, ipAddress string) (*models.TrainerProfile, error)
	GetByID(id uint) (*models.TrainerProfile, error)
	GetByUserID(userID uint) (*models.TrainerProfile, error)
	List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.TrainerProfile, int64, error)
	Update(id uint, req UpdateTrainerRequest, actorID uint, ipAddress string) (*models.TrainerProfile, error)
	Deactivate(id uint, actorID uint, ipAddress string) error
	ListClasses(trainerID uint, req utils.PageRequest, status string) ([]*models.Class, int64, error)

	// Schedule
	GetSchedule(trainerID uint) ([]*models.TrainerSchedule, error)
	CreateShift(trainerID uint, req CreateShiftRequest, actorID uint, ipAddress string) (*models.TrainerSchedule, error)
	UpdateShift(trainerID uint, shiftID uint, req UpdateShiftRequest, actorID uint, ipAddress string) (*models.TrainerSchedule, error)
	DeleteShift(trainerID uint, shiftID uint, actorID uint, ipAddress string) error
}

type trainerService struct {
	trainerRepo repositories.TrainerRepository
	userRepo    repositories.UserRepository
	auditRepo   repositories.AuditLogRepository
	classRepo   repositories.ClassRepository
	authSvc     AuthService
	logger      *slog.Logger
}

func NewTrainerService(
	trainerRepo repositories.TrainerRepository,
	userRepo repositories.UserRepository,
	auditRepo repositories.AuditLogRepository,
	classRepo repositories.ClassRepository,
	authSvc AuthService,
	logger *slog.Logger,
) TrainerService {
	return &trainerService{
		trainerRepo: trainerRepo,
		userRepo:    userRepo,
		auditRepo:   auditRepo,
		classRepo:   classRepo,
		authSvc:     authSvc,
		logger:      logger,
	}
}

func (s *trainerService) Create(req CreateTrainerRequest, actorID uint, ipAddress string) (*models.TrainerProfile, error) {
	if req.FacilityID == 0 {
		return nil, apperrors.ErrValidation("facility_id is required")
	}

	var userID uint

	if req.UserID != 0 {
		// Link to existing user — verify they have a trainer role.
		user, err := s.userRepo.FindByID(req.UserID)
		if err != nil || user == nil {
			return nil, apperrors.ErrUserNotFound
		}
		if user.Role != constants.RoleTrainer && user.Role != constants.RoleTrainerAssistant {
			return nil, apperrors.ErrValidation("user must have a trainer or trainer_assistant role")
		}
		// Ensure no existing profile.
		existing, _ := s.trainerRepo.FindByUserID(req.UserID)
		if existing != nil {
			return nil, apperrors.New(http.StatusConflict, "TRN_001", "Trainer profile already exists for this user", "")
		}
		userID = req.UserID
	} else {
		// Create a new trainer user via AuthService.
		if req.Email == "" || req.Password == "" || req.FirstName == "" {
			return nil, apperrors.ErrValidation("first_name, email, and password are required when not linking an existing user")
		}
		signupReq := SignupRequest{
			FirstName: req.FirstName,
			LastName:  req.LastName,
			Email:     req.Email,
			Phone:     req.Phone,
			Password:  req.Password,
			Role:      constants.RoleTrainer,
		}
		user, err := s.authSvc.Signup(signupReq)
		if err != nil {
			return nil, err
		}
		// Auto-verify the trainer's email (staff-created account).
		_ = s.userRepo.MarkEmailVerified(user.ID)
		userID = user.ID
	}

	profile := &models.TrainerProfile{
		UserID:           userID,
		FacilityID:       req.FacilityID,
		Bio:              req.Bio,
		Specializations:  models.StringSlice(req.Specializations),
		Certifications:   models.StringSlice(req.Certifications),
		ExperienceYears:  req.ExperienceYears,
		HourlyRate:       req.HourlyRate,
		MaxClientsPerDay: req.MaxClientsPerDay,
		IsActive:         true,
	}
	if profile.MaxClientsPerDay == 0 {
		profile.MaxClientsPerDay = 10
	}

	if err := s.trainerRepo.Create(profile); err != nil {
		s.logger.Error("create trainer profile failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	s.audit(actorID, "trainer.create", profile.ID, nil, nil, ipAddress)

	loaded, err := s.trainerRepo.FindByID(profile.ID)
	if err != nil || loaded == nil {
		return profile, nil
	}
	return loaded, nil
}

func (s *trainerService) GetByID(id uint) (*models.TrainerProfile, error) {
	t, err := s.trainerRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if t == nil {
		return nil, apperrors.New(http.StatusNotFound, "TRN_002", "Trainer not found", "")
	}
	return t, nil
}

func (s *trainerService) GetByUserID(userID uint) (*models.TrainerProfile, error) {
	t, err := s.trainerRepo.FindByUserID(userID)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if t == nil {
		return nil, apperrors.New(http.StatusNotFound, "TRN_002", "Trainer not found", "")
	}
	return t, nil
}

func (s *trainerService) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.TrainerProfile, int64, error) {
	return s.trainerRepo.List(req, facilityID, activeOnly)
}

func (s *trainerService) Update(id uint, req UpdateTrainerRequest, actorID uint, ipAddress string) (*models.TrainerProfile, error) {
	t, err := s.trainerRepo.FindByID(id)
	if err != nil || t == nil {
		return nil, apperrors.New(http.StatusNotFound, "TRN_002", "Trainer not found", "")
	}

	if req.FacilityID != nil {
		t.FacilityID = *req.FacilityID
	}
	if req.Bio != "" {
		t.Bio = req.Bio
	}
	if req.Specializations != nil {
		t.Specializations = models.StringSlice(req.Specializations)
	}
	if req.Certifications != nil {
		t.Certifications = models.StringSlice(req.Certifications)
	}
	if req.ExperienceYears != nil {
		t.ExperienceYears = *req.ExperienceYears
	}
	if req.HourlyRate != nil {
		t.HourlyRate = *req.HourlyRate
	}
	if req.MaxClientsPerDay != nil {
		t.MaxClientsPerDay = *req.MaxClientsPerDay
	}
	if req.SetWeeklyOffDays {
		t.WeeklyOffDays = models.IntSlice(req.WeeklyOffDays)
	}

	if err := s.trainerRepo.Update(t); err != nil {
		return nil, apperrors.ErrInternal
	}

	s.audit(actorID, "trainer.update", id, nil, nil, ipAddress)
	return t, nil
}

func (s *trainerService) Deactivate(id uint, actorID uint, ipAddress string) error {
	t, err := s.trainerRepo.FindByID(id)
	if err != nil || t == nil {
		return apperrors.New(http.StatusNotFound, "TRN_002", "Trainer not found", "")
	}
	if err := s.trainerRepo.Deactivate(id); err != nil {
		return apperrors.ErrInternal
	}
	s.audit(actorID, "trainer.deactivate", id, nil, nil, ipAddress)
	return nil
}

func (s *trainerService) ListClasses(trainerID uint, req utils.PageRequest, status string) ([]*models.Class, int64, error) {
	t, err := s.trainerRepo.FindByID(trainerID)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	if t == nil {
		return nil, 0, apperrors.New(http.StatusNotFound, "TRN_002", "Trainer not found", "")
	}
	id := trainerID
	return s.classRepo.List(req, nil, &id, status)
}

func (s *trainerService) GetSchedule(trainerID uint) ([]*models.TrainerSchedule, error) {
	if _, err := s.GetByID(trainerID); err != nil {
		return nil, err
	}
	return s.trainerRepo.GetSchedule(trainerID)
}

func (s *trainerService) CreateShift(trainerID uint, req CreateShiftRequest, actorID uint, ipAddress string) (*models.TrainerSchedule, error) {
	if _, err := s.GetByID(trainerID); err != nil {
		return nil, err
	}
	if req.StartTime == "" || req.EndTime == "" {
		return nil, apperrors.ErrValidation("start_time and end_time are required")
	}
	if req.DayOfWeek < 0 || req.DayOfWeek > 6 {
		return nil, apperrors.ErrValidation("day_of_week must be 0 (Monday) to 6 (Sunday)")
	}
	shift := &models.TrainerSchedule{
		TrainerID: trainerID,
		DayOfWeek: req.DayOfWeek,
		StartTime: req.StartTime,
		EndTime:   req.EndTime,
		Breaks:    models.BreakSlice(req.Breaks),
		Notes:     req.Notes,
		IsActive:  true,
	}
	if err := s.trainerRepo.CreateShift(shift); err != nil {
		return nil, apperrors.ErrInternal
	}
	s.audit(actorID, "trainer.shift.create", shift.ID, nil, nil, ipAddress)
	return shift, nil
}

func (s *trainerService) UpdateShift(trainerID uint, shiftID uint, req UpdateShiftRequest, actorID uint, ipAddress string) (*models.TrainerSchedule, error) {
	shift, err := s.trainerRepo.GetShift(shiftID)
	if err != nil || shift == nil {
		return nil, apperrors.New(http.StatusNotFound, "TRN_003", "Shift not found", "")
	}
	if shift.TrainerID != trainerID {
		return nil, apperrors.New(http.StatusForbidden, "TRN_004", "Shift does not belong to this trainer", "")
	}
	if req.StartTime != nil {
		shift.StartTime = *req.StartTime
	}
	if req.EndTime != nil {
		shift.EndTime = *req.EndTime
	}
	if req.Breaks != nil {
		shift.Breaks = models.BreakSlice(req.Breaks)
	}
	if req.Notes != nil {
		shift.Notes = *req.Notes
	}
	if req.IsActive != nil {
		shift.IsActive = *req.IsActive
	}
	if err := s.trainerRepo.UpdateShift(shift); err != nil {
		return nil, apperrors.ErrInternal
	}
	s.audit(actorID, "trainer.shift.update", shift.ID, nil, nil, ipAddress)
	return shift, nil
}

func (s *trainerService) DeleteShift(trainerID uint, shiftID uint, actorID uint, ipAddress string) error {
	shift, err := s.trainerRepo.GetShift(shiftID)
	if err != nil || shift == nil {
		return apperrors.New(http.StatusNotFound, "TRN_003", "Shift not found", "")
	}
	if shift.TrainerID != trainerID {
		return apperrors.New(http.StatusForbidden, "TRN_004", "Shift does not belong to this trainer", "")
	}
	if err := s.trainerRepo.DeleteShift(shiftID); err != nil {
		return apperrors.ErrInternal
	}
	s.audit(actorID, "trainer.shift.delete", shiftID, nil, nil, ipAddress)
	return nil
}

func (s *trainerService) audit(userID uint, action string, resourceID uint, old, new models.JSONMap, ip string) {
	rid := resourceID
	_ = s.auditRepo.Create(&models.AuditLog{
		UserID:       userID,
		Action:       action,
		ResourceType: "trainer",
		ResourceID:   &rid,
		OldValues:    old,
		NewValues:    new,
		IPAddress:    ip,
	})
}
