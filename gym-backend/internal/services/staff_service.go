package services

import (
	"fmt"
	"log/slog"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

type CreateStaffRequest struct {
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
}

type UpdateStaffRequest struct {
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
}

type StaffService interface {
	Create(req CreateStaffRequest) (*models.Staff, error)
	GetByID(id uint) (*models.Staff, error)
	List(status, department, search string, page, perPage int) ([]*models.Staff, int64, error)
	Update(id uint, req UpdateStaffRequest) (*models.Staff, error)
	Delete(id uint) error
}

type staffService struct {
	repo   repositories.StaffRepository
	logger *slog.Logger
}

func NewStaffService(repo repositories.StaffRepository, logger *slog.Logger) StaffService {
	return &staffService{repo: repo, logger: logger}
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

	m := &models.Staff{
		EmployeeID:            empID,
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

func (s *staffService) List(status, department, search string, page, perPage int) ([]*models.Staff, int64, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 500 {
		perPage = 25
	}
	list, total, err := s.repo.List(status, department, search, page, perPage)
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

	if err := s.repo.Update(m); err != nil {
		s.logger.Error("update staff failed", "err", err)
		return nil, apperrors.ErrInternal
	}
	return m, nil
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
