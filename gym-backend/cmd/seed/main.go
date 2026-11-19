// cmd/seed/main.go — development seed data loader.
//
// Usage:
//
//	go run ./cmd/seed
//
// Creates (idempotently):
//   - 1 facility
//   - 2 trainer profiles  (trainer1 / trainer2)
package main

import (
	"fmt"
	"log/slog"
	"os"

	"gym-backend/internal/config"
	"gym-backend/internal/constants"
	"gym-backend/internal/database"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := config.Load()
	if err != nil {
		logger.Error("config load failed", "err", err)
		os.Exit(1)
	}

	db, err := database.Connect(&cfg.Database)
	if err != nil {
		logger.Error("database connect failed", "err", err)
		os.Exit(1)
	}

	// Repositories.
	userRepo     := repositories.NewUserRepository(db)
	tokenRepo    := repositories.NewRefreshTokenRepository(db)
	otpRepo      := repositories.NewOTPRepository(db)
	facilityRepo := repositories.NewFacilityRepository(db)
	trainerRepo  := repositories.NewTrainerRepository(db)
	auditRepo    := repositories.NewAuditLogRepository(db)

	// Services.
	emailSvc := services.NewEmailService(cfg.SMTP, logger)
	authSvc  := services.NewAuthService(userRepo, tokenRepo, otpRepo, emailSvc, cfg.JWT, logger)

	// ── 1. Facility ───────────────────────────────────────────────────────────
	facility := seedFacility(facilityRepo, logger)

	// ── 2. Trainers ───────────────────────────────────────────────────────────
	seedTrainer(authSvc, userRepo, trainerRepo, auditRepo, facility.ID, "trainer1@example.com", "John", "Doe", []string{"Yoga", "Pilates"}, logger)
	seedTrainer(authSvc, userRepo, trainerRepo, auditRepo, facility.ID, "trainer2@example.com", "Jane", "Lee", []string{"HIIT", "Cardio"}, logger)

	logger.Info("seed complete")
}

// ─── Facility ─────────────────────────────────────────────────────────────────

func seedFacility(repo repositories.FacilityRepository, logger *slog.Logger) *models.Facility {
	list, _, err := repo.List(utils.PageRequest{Page: 1, PerPage: 1})
	if err == nil && len(list) > 0 {
		logger.Info("facility already exists", "id", list[0].ID)
		return list[0]
	}

	f := &models.Facility{
		Name:    "GymApp Main Branch",
		Address: "123 Fitness Street",
		City:    "Mumbai",
		Country: "India",
		Phone:   "+91-9999999999",
		Email:   "main@gymapp.com",
	}
	if err := repo.Create(f); err != nil {
		logger.Error("create facility failed", "err", err)
		os.Exit(1)
	}
	logger.Info("facility created", "id", f.ID, "name", f.Name)
	return f
}

// ─── Trainers ─────────────────────────────────────────────────────────────────

func seedTrainer(authSvc services.AuthService, userRepo repositories.UserRepository,
	trainerRepo repositories.TrainerRepository, auditRepo repositories.AuditLogRepository,
	facilityID uint, email, firstName, lastName string,
	specializations []string, logger *slog.Logger) *models.TrainerProfile {

	if u, _ := userRepo.FindByEmail(email); u != nil {
		t, _ := trainerRepo.FindByUserID(u.ID)
		if t != nil {
			logger.Info("trainer already exists", "email", email)
			return t
		}
	}

	info, err := authSvc.Signup(services.SignupRequest{
		Email:     email,
		Password:  "Trainer@123456",
		FirstName: firstName,
		LastName:  lastName,
		Role:      constants.RoleTrainer,
	})
	if err != nil {
		logger.Error("trainer signup failed", "email", email, "err", err)
		os.Exit(1)
	}

	u, _ := userRepo.FindByEmail(email)
	if u != nil {
		u.EmailVerified = true
		_ = userRepo.Update(u)
	}

	t := &models.TrainerProfile{
		UserID:          info.ID,
		FacilityID:      facilityID,
		Bio:             fmt.Sprintf("%s %s is a certified trainer.", firstName, lastName),
		Specializations: models.StringSlice(specializations),
		ExperienceYears: 3,
		HourlyRate:      1500,
		IsActive:        true,
	}
	if err := trainerRepo.Create(t); err != nil {
		logger.Error("create trainer failed", "email", email, "err", err)
		os.Exit(1)
	}

	// Audit log.
	rid := t.ID
	_ = auditRepo.Create(&models.AuditLog{
		UserID:       info.ID,
		Action:       "trainer.seed",
		ResourceType: "trainer",
		ResourceID:   &rid,
		IPAddress:    "seed",
	})

	logger.Info("trainer created", "id", t.ID, "email", email)
	return t
}

