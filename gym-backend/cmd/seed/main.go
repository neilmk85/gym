// cmd/seed/main.go — development seed data loader.
//
// Usage:
//
//	go run ./cmd/seed
//
// Creates (idempotently):
//   - 1 facility
//   - 1 admin user  (admin@gymapp.com / Admin@123456)
//   - 1 manager user (manager@gymapp.com / Manager@123456)
//   - 3 membership plans (Basic, Premium, Elite)
//   - 3 member users + member profiles  (alice/bob/charlie)
//   - 2 trainer profiles
//   - 4 scheduled classes across the next 7 days
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

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
	planRepo     := repositories.NewPlanRepository(db)
	memberRepo   := repositories.NewMemberRepository(db)
	trainerRepo  := repositories.NewTrainerRepository(db)
	classRepo    := repositories.NewClassRepository(db)
	auditRepo    := repositories.NewAuditLogRepository(db)

	// Services.
	emailSvc  := services.NewEmailService(cfg.SMTP, logger)
	authSvc   := services.NewAuthService(userRepo, tokenRepo, otpRepo, emailSvc, cfg.JWT, logger)

	ctx := context.Background()
	_ = ctx

	// ── 1. Facility ───────────────────────────────────────────────────────────
	facility := seedFacility(facilityRepo, logger)

	// ── 2. Admin & manager users ──────────────────────────────────────────────
	adminUser  := seedUser(authSvc, userRepo, "admin@gymapp.com", "Admin@123456", constants.RoleAdmin, logger)
	managerUser := seedUser(authSvc, userRepo, "manager@gymapp.com", "Manager@123456", constants.RoleManager, logger)
	_, _ = adminUser, managerUser

	// ── 3. Plans ──────────────────────────────────────────────────────────────
	basicPlan   := seedPlan(planRepo, "Basic",   999,  30, false, false, logger)
	premiumPlan := seedPlan(planRepo, "Premium", 1999, 30, true,  true,  logger)
	elitePlan   := seedPlan(planRepo, "Elite",   3499, 30, true,  true,  logger)
	_ = premiumPlan
	_ = elitePlan

	// ── 4. Member users ───────────────────────────────────────────────────────
	alice   := seedMember(authSvc, userRepo, memberRepo, facility.ID, basicPlan.ID,   "alice@example.com",   "Alice",   "Smith",  logger)
	bob     := seedMember(authSvc, userRepo, memberRepo, facility.ID, premiumPlan.ID, "bob@example.com",     "Bob",     "Jones",  logger)
	charlie := seedMember(authSvc, userRepo, memberRepo, facility.ID, basicPlan.ID,   "charlie@example.com", "Charlie", "Brown",  logger)
	_, _, _ = alice, bob, charlie

	// ── 5. Trainers ───────────────────────────────────────────────────────────
	trainer1 := seedTrainer(authSvc, userRepo, trainerRepo, auditRepo, facility.ID, "trainer1@example.com", "John", "Doe", []string{"Yoga", "Pilates"}, logger)
	trainer2 := seedTrainer(authSvc, userRepo, trainerRepo, auditRepo, facility.ID, "trainer2@example.com", "Jane", "Lee", []string{"HIIT", "Cardio"}, logger)

	// ── 6. Classes ────────────────────────────────────────────────────────────
	seedClasses(classRepo, facility.ID, trainer1, trainer2, logger)

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

// ─── User / auth ──────────────────────────────────────────────────────────────

func seedUser(authSvc services.AuthService, userRepo repositories.UserRepository,
	email, password, role string, logger *slog.Logger) *models.User {

	if u, _ := userRepo.FindByEmail(email); u != nil {
		logger.Info("user already exists", "email", email)
		return u
	}

	firstName := role
	info, err := authSvc.Signup(services.SignupRequest{
		Email:     email,
		Password:  password,
		FirstName: firstName,
		LastName:  "User",
		Role:      role,
	})
	if err != nil {
		logger.Error("signup failed", "email", email, "err", err)
		os.Exit(1)
	}

	// Mark email verified immediately for seed data.
	u, _ := userRepo.FindByEmail(email)
	if u != nil {
		u.EmailVerified = true
		_ = userRepo.Update(u)
	}

	logger.Info("user created", "id", info.ID, "email", email, "role", role)
	u, _ = userRepo.FindByEmail(email)
	return u
}

// ─── Plans ────────────────────────────────────────────────────────────────────

func seedPlan(repo repositories.PlanRepository, name string, price float64, days int,
	groupAccess, personalTraining bool, logger *slog.Logger) *models.Plan {

	plans, _, err := repo.List(utils.PageRequest{Page: 1, PerPage: 50}, nil, false)
	if err == nil {
		for _, p := range plans {
			if p.Name == name {
				logger.Info("plan already exists", "name", name)
				return p
			}
		}
	}

	p := &models.Plan{
		Name:             name,
		PriceAmount:      price,
		BillingPeriodDays: days,
		IsActive:         true,
		GroupClassAccess: groupAccess,
	}
	if err := repo.Create(p); err != nil {
		logger.Error("create plan failed", "name", name, "err", err)
		os.Exit(1)
	}
	logger.Info("plan created", "id", p.ID, "name", name, "price", price)
	return p
}

// ─── Members ──────────────────────────────────────────────────────────────────

func seedMember(authSvc services.AuthService, userRepo repositories.UserRepository,
	memberRepo repositories.MemberRepository, facilityID, planID uint,
	email, firstName, lastName string, logger *slog.Logger) *models.Member {

	if u, _ := userRepo.FindByEmail(email); u != nil {
		m, _ := memberRepo.FindByUserID(u.ID)
		if m != nil {
			logger.Info("member already exists", "email", email)
			return m
		}
	}

	// Create the user account first.
	info, err := authSvc.Signup(services.SignupRequest{
		Email:     email,
		Password:  "Member@123456",
		FirstName: firstName,
		LastName:  lastName,
		Role:      constants.RoleMember,
	})
	if err != nil {
		logger.Error("member signup failed", "email", email, "err", err)
		os.Exit(1)
	}

	// Verify email.
	u, _ := userRepo.FindByEmail(email)
	if u != nil {
		u.EmailVerified = true
		_ = userRepo.Update(u)
	}

	// Create member profile.
	pid := planID
	m := &models.Member{
		UserID:           info.ID,
		FacilityID:       facilityID,
		MembershipStatus: models.MemberStatusActive,
		CurrentPlanID:    &pid,
	}
	if err := memberRepo.Create(m); err != nil {
		logger.Error("create member failed", "email", email, "err", err)
		os.Exit(1)
	}
	logger.Info("member created", "id", m.ID, "email", email)
	return m
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

// ─── Classes ──────────────────────────────────────────────────────────────────

func seedClasses(repo repositories.ClassRepository, facilityID uint,
	t1, t2 *models.TrainerProfile, logger *slog.Logger) {

	now := time.Now()
	type classSeed struct {
		name      string
		classType string
		trainerID *uint
		dayOffset int
		hour      int
		duration  int
		capacity  int
		isFree    bool
	}

	seeds := []classSeed{
		{"Morning Yoga", models.ClassTypeYoga, &t1.ID, 1, 7, 60, 20, true},
		{"HIIT Blast", models.ClassTypeHIIT, &t2.ID, 2, 18, 45, 15, false},
		{"Pilates Core", models.ClassTypePilates, &t1.ID, 3, 10, 60, 12, false},
		{"Cardio Burn", models.ClassTypeCardio, &t2.ID, 5, 7, 30, 25, true},
	}

	for _, s := range seeds {
		start := time.Date(now.Year(), now.Month(), now.Day()+s.dayOffset,
			s.hour, 0, 0, 0, now.Location())
		end := start.Add(time.Duration(s.duration) * time.Minute)

		c := &models.Class{
			FacilityID:   facilityID,
			TrainerID:    s.trainerID,
			Name:         s.name,
			ClassType:    s.classType,
			DurationMins: s.duration,
			MaxCapacity:  s.capacity,
			StartTime:    start,
			EndTime:      end,
			Status:       models.ClassStatusScheduled,
			IsActive:     true,
			IsFree:       s.isFree,
		}
		if err := repo.Create(c); err != nil {
			logger.Error("create class failed", "name", s.name, "err", err)
			continue
		}
		logger.Info("class created", "id", c.ID, "name", s.name, "start", start.Format("2006-01-02 15:04"))
	}
}
