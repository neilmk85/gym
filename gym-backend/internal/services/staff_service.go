package services

import (
	"fmt"
	"log/slog"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// TrainerProfileRequest holds trainer-specific fields sent when role=trainer.
type TrainerProfileRequest struct {
	Bio              string   `json:"bio"`
	Specializations  []string `json:"specializations"`
	Certifications   []string `json:"certifications"`
	ExperienceYears  int      `json:"experience_years"`
	HourlyRate       float64  `json:"hourly_rate"`
	MaxClientsPerDay int      `json:"max_clients_per_day"`
	// Login credentials for the trainer's app account (required on create if role=trainer)
	Password string `json:"password"`
}

type CreateStaffRequest struct {
	Role                  string  `json:"role"`
	FirstName             string  `json:"first_name"`
	LastName              string  `json:"last_name"`
	Email                 string  `json:"email"`
	Phone                 string  `json:"phone"`
	SecondaryPhone        string  `json:"secondary_phone"`
	DateOfBirth           string  `json:"date_of_birth"`
	Gender                string  `json:"gender"`
	Address               string  `json:"address"`
	EmergencyContactName  string  `json:"emergency_contact_name"`
	EmergencyContactPhone string  `json:"emergency_contact_phone"`
	Department            string  `json:"department"`
	Designation           string  `json:"designation"`
	EmploymentType        string  `json:"employment_type"`
	DateOfJoining         string  `json:"date_of_joining"`
	ReportingTo           string  `json:"reporting_to"`
	Salary                float64 `json:"salary"`
	PANNumber             string  `json:"pan_number"`
	AadharNumber          string  `json:"aadhar_number"`
	Status                string  `json:"status"`
	Notes                 string  `json:"notes"`
	FacilityID            uint    `json:"facility_id"`
	// Trainer-specific (only used when role=trainer)
	TrainerProfile *TrainerProfileRequest `json:"trainer_profile,omitempty"`
}

type UpdateStaffRequest struct {
	Role                  string   `json:"role"`
	FirstName             string   `json:"first_name"`
	LastName              string   `json:"last_name"`
	Email                 string   `json:"email"`
	Phone                 string   `json:"phone"`
	SecondaryPhone        string   `json:"secondary_phone"`
	DateOfBirth           string   `json:"date_of_birth"`
	Gender                string   `json:"gender"`
	Address               string   `json:"address"`
	EmergencyContactName  string   `json:"emergency_contact_name"`
	EmergencyContactPhone string   `json:"emergency_contact_phone"`
	Department            string   `json:"department"`
	Designation           string   `json:"designation"`
	EmploymentType        string   `json:"employment_type"`
	DateOfJoining         string   `json:"date_of_joining"`
	ReportingTo           string   `json:"reporting_to"`
	Salary                *float64 `json:"salary"`
	PANNumber             string   `json:"pan_number"`
	AadharNumber          string   `json:"aadhar_number"`
	Status                string   `json:"status"`
	Notes                 string   `json:"notes"`
	// Trainer-specific (only used when role=trainer)
	TrainerProfile *TrainerProfileRequest `json:"trainer_profile,omitempty"`
}

type StaffService interface {
	Create(req CreateStaffRequest) (*models.Staff, error)
	GetByID(id uint) (*models.Staff, error)
	List(status, department, role, search string, page, perPage int) ([]*models.Staff, int64, error)
	Update(id uint, req UpdateStaffRequest) (*models.Staff, error)
	Delete(id uint) error
}

type staffService struct {
	repo        repositories.StaffRepository
	trainerRepo repositories.TrainerRepository
	authSvc     AuthService
	logger      *slog.Logger
}

func NewStaffService(repo repositories.StaffRepository, trainerRepo repositories.TrainerRepository, authSvc AuthService, logger *slog.Logger) StaffService {
	return &staffService{repo: repo, trainerRepo: trainerRepo, authSvc: authSvc, logger: logger}
}

func (s *staffService) Create(req CreateStaffRequest) (*models.Staff, error) {
	if req.FirstName == "" || req.LastName == "" {
		return nil, apperrors.ErrValidation("first_name and last_name are required")
	}
	if req.Phone == "" {
		return nil, apperrors.ErrValidation("phone is required")
	}
	if req.Department == "" || req.Designation == "" {
		return nil, apperrors.ErrValidation("department and designation are required")
	}

	role := req.Role
	if role == "" {
		role = models.StaffRoleOther
	}

	seq := s.repo.MaxEmployeeSeq() + 1
	empID := fmt.Sprintf("EMP%03d", seq)

	joiningDate := time.Now()
	if req.DateOfJoining != "" {
		if t, err := time.Parse("2006-01-02", req.DateOfJoining); err == nil {
			joiningDate = t
		}
	}

	employmentType := req.EmploymentType
	if employmentType == "" {
		employmentType = "full_time"
	}
	status := req.Status
	if status == "" {
		status = "active"
	}

	facilityID := req.FacilityID
	if facilityID == 0 {
		facilityID = 1
	}

	m := &models.Staff{
		FacilityID:            facilityID,
		EmployeeID:            empID,
		Role:                  role,
		FirstName:             req.FirstName,
		LastName:              req.LastName,
		Email:                 req.Email,
		Phone:                 req.Phone,
		SecondaryPhone:        req.SecondaryPhone,
		Gender:                req.Gender,
		Address:               req.Address,
		EmergencyContactName:  req.EmergencyContactName,
		EmergencyContactPhone: req.EmergencyContactPhone,
		Department:            req.Department,
		Designation:           req.Designation,
		EmploymentType:        employmentType,
		DateOfJoining:         joiningDate,
		ReportingTo:           req.ReportingTo,
		Salary:                req.Salary,
		PANNumber:             req.PANNumber,
		AadharNumber:          req.AadharNumber,
		Status:                status,
		Notes:                 req.Notes,
	}

	if req.DateOfBirth != "" {
		if t, err := time.Parse("2006-01-02", req.DateOfBirth); err == nil {
			m.DateOfBirth = &t
		}
	}

	// For trainers: create a user account and TrainerProfile.
	if role == models.StaffRoleTrainer && req.TrainerProfile != nil {
		tp := req.TrainerProfile
		if req.Email == "" || tp.Password == "" {
			return nil, apperrors.ErrValidation("email and trainer_profile.password are required for trainer staff")
		}
		user, err := s.authSvc.SignupStaff(SignupRequest{
			FirstName: req.FirstName,
			LastName:  req.LastName,
			Email:     req.Email,
			Phone:     req.Phone,
			Password:  tp.Password,
			Role:      "trainer",
		})
		if err != nil {
			return nil, err
		}
		m.UserID = &user.ID

		if err := s.repo.Create(m); err != nil {
			s.logger.Error("create staff failed", "err", err)
			return nil, apperrors.ErrInternal
		}

		maxClients := tp.MaxClientsPerDay
		if maxClients == 0 {
			maxClients = 10
		}
		profile := &models.TrainerProfile{
			UserID:           user.ID,
			StaffID:          &m.ID,
			FacilityID:       facilityID,
			Bio:              tp.Bio,
			Specializations:  models.StringSlice(tp.Specializations),
			Certifications:   models.StringSlice(tp.Certifications),
			ExperienceYears:  tp.ExperienceYears,
			HourlyRate:       tp.HourlyRate,
			MaxClientsPerDay: maxClients,
			IsActive:         true,
		}
		if err := s.trainerRepo.Create(profile); err != nil {
			s.logger.Error("create trainer profile for staff failed", "err", err)
			return nil, apperrors.ErrInternal
		}
		return s.repo.FindByID(m.ID)
	}

	if err := s.repo.Create(m); err != nil {
		s.logger.Error("create staff failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return m, nil
}

func (s *staffService) GetByID(id uint) (*models.Staff, error) {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if m == nil {
		return nil, apperrors.New(404, "STAFF_NOT_FOUND", "staff member not found", "")
	}
	return m, nil
}

func (s *staffService) List(status, department, role, search string, page, perPage int) ([]*models.Staff, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 500 {
		perPage = 25
	}
	list, total, err := s.repo.List(status, department, role, search, page, perPage)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	return list, total, nil
}

func (s *staffService) Update(id uint, req UpdateStaffRequest) (*models.Staff, error) {
	m, err := s.repo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if m == nil {
		return nil, apperrors.New(404, "STAFF_NOT_FOUND", "staff member not found", "")
	}

	if req.FirstName != "" {
		m.FirstName = req.FirstName
	}
	if req.LastName != "" {
		m.LastName = req.LastName
	}
	if req.Email != "" {
		m.Email = req.Email
	}
	if req.Phone != "" {
		m.Phone = req.Phone
	}
	if req.SecondaryPhone != "" {
		m.SecondaryPhone = req.SecondaryPhone
	}
	if req.DateOfBirth != "" {
		if t, err := time.Parse("2006-01-02", req.DateOfBirth); err == nil {
			m.DateOfBirth = &t
		}
	}
	if req.Gender != "" {
		m.Gender = req.Gender
	}
	if req.Address != "" {
		m.Address = req.Address
	}
	if req.EmergencyContactName != "" {
		m.EmergencyContactName = req.EmergencyContactName
	}
	if req.EmergencyContactPhone != "" {
		m.EmergencyContactPhone = req.EmergencyContactPhone
	}
	if req.Department != "" {
		m.Department = req.Department
	}
	if req.Designation != "" {
		m.Designation = req.Designation
	}
	if req.EmploymentType != "" {
		m.EmploymentType = req.EmploymentType
	}
	if req.DateOfJoining != "" {
		if t, err := time.Parse("2006-01-02", req.DateOfJoining); err == nil {
			m.DateOfJoining = t
		}
	}
	if req.ReportingTo != "" {
		m.ReportingTo = req.ReportingTo
	}
	if req.Salary != nil {
		m.Salary = *req.Salary
	}
	if req.PANNumber != "" {
		m.PANNumber = req.PANNumber
	}
	if req.AadharNumber != "" {
		m.AadharNumber = req.AadharNumber
	}
	if req.Status != "" {
		m.Status = req.Status
	}
	if req.Notes != "" {
		m.Notes = req.Notes
	}
	if req.Role != "" {
		m.Role = req.Role
	}

	if err := s.repo.Update(m); err != nil {
		s.logger.Error("update staff failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	// Update TrainerProfile if provided.
	if m.Role == models.StaffRoleTrainer && req.TrainerProfile != nil {
		tp := req.TrainerProfile
		existing := m.TrainerProfile
		if existing == nil {
			// No profile yet — look it up by staff_id.
			existing, _ = s.trainerRepo.FindByStaffID(m.ID)
		}
		if existing != nil {
			if tp.Bio != "" {
				existing.Bio = tp.Bio
			}
			if len(tp.Specializations) > 0 {
				existing.Specializations = models.StringSlice(tp.Specializations)
			}
			if len(tp.Certifications) > 0 {
				existing.Certifications = models.StringSlice(tp.Certifications)
			}
			if tp.ExperienceYears > 0 {
				existing.ExperienceYears = tp.ExperienceYears
			}
			if tp.HourlyRate > 0 {
				existing.HourlyRate = tp.HourlyRate
			}
			if tp.MaxClientsPerDay > 0 {
				existing.MaxClientsPerDay = tp.MaxClientsPerDay
			}
			_ = s.trainerRepo.Update(existing)
		}
	}

	return s.repo.FindByID(m.ID)
}

func (s *staffService) Delete(id uint) error {
	if _, err := s.GetByID(id); err != nil {
		return err
	}
	if err := s.repo.Delete(id); err != nil {
		s.logger.Error("delete staff failed", "err", err)
		return apperrors.ErrInternal
	}
	return nil
}
