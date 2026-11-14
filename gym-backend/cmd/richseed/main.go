// cmd/richseed/main.go — seeds rich dashboard data: members, subscriptions,
// payments, attendance, and class bookings spanning the last 90 days.
//
// Usage:
//
//	go run ./cmd/richseed
//
// Idempotent: skips already-seeded records.
package main

import (
	"fmt"
	"log/slog"
	"math/rand"
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
		logger.Error("db connect failed", "err", err)
		os.Exit(1)
	}

	userRepo     := repositories.NewUserRepository(db)
	tokenRepo    := repositories.NewRefreshTokenRepository(db)
	otpRepo      := repositories.NewOTPRepository(db)
	facilityRepo := repositories.NewFacilityRepository(db)
	planRepo     := repositories.NewPlanRepository(db)
	memberRepo   := repositories.NewMemberRepository(db)
	classRepo    := repositories.NewClassRepository(db)
	emailSvc     := services.NewEmailService(cfg.SMTP, logger)
	authSvc      := services.NewAuthService(userRepo, tokenRepo, otpRepo, emailSvc, cfg.JWT, logger)

	// ── Get facility & plans ──────────────────────────────────────────────────
	facilityList, _, _ := facilityRepo.List(utils.PageRequest{Page: 1, PerPage: 1})
	if len(facilityList) == 0 {
		logger.Error("no facility — run cmd/seed first")
		os.Exit(1)
	}
	facility := facilityList[0]

	planList, _, _ := planRepo.List(utils.PageRequest{Page: 1, PerPage: 50}, nil, false, "", "")
	if len(planList) == 0 {
		logger.Error("no plans — run cmd/seed first")
		os.Exit(1)
	}

	// Find admin user for recorded_by_id
	adminUser, _ := userRepo.FindByEmail("admin@gymapp.com")
	var adminID uint = 1
	if adminUser != nil {
		adminID = adminUser.ID
	}

	// ── Get existing classes (or use 0) ──────────────────────────────────────
	classList, _, _ := classRepo.List(utils.PageRequest{Page: 1, PerPage: 50}, &facility.ID, nil, "")

	now := time.Now()

	// ── Seed 25 members spread over last 90 days ──────────────────────────────
	type memberSeed struct {
		email     string
		firstName string
		lastName  string
		phone     string
		daysAgo   int // when they joined
	}

	memberSeeds := []memberSeed{
		{"priya.sharma@example.com",   "Priya",     "Sharma",     "9876543210", 85},
		{"rohan.verma@example.com",    "Rohan",     "Verma",      "9765432109", 80},
		{"ananya.nair@example.com",    "Ananya",    "Nair",       "9654321098", 75},
		{"karan.mehta@example.com",    "Karan",     "Mehta",      "9543210987", 70},
		{"deepika.joshi@example.com",  "Deepika",   "Joshi",      "9432109876", 65},
		{"arjun.patel@example.com",    "Arjun",     "Patel",      "9321098765", 60},
		{"neha.gupta@example.com",     "Neha",      "Gupta",      "9210987654", 55},
		{"siddharth.rao@example.com",  "Siddharth", "Rao",        "9109876543", 50},
		{"pooja.iyer@example.com",     "Pooja",     "Iyer",       "9098765432", 45},
		{"vikram.singh@example.com",   "Vikram",    "Singh",      "8987654321", 42},
		{"meera.pillai@example.com",   "Meera",     "Pillai",     "8876543210", 38},
		{"aditya.kumar@example.com",   "Aditya",    "Kumar",      "8765432109", 35},
		{"shruti.das@example.com",     "Shruti",    "Das",        "8654321098", 30},
		{"rahul.malhotra@example.com", "Rahul",     "Malhotra",   "8543210987", 27},
		{"kavita.reddy@example.com",   "Kavita",    "Reddy",      "8432109876", 24},
		{"suresh.bhatt@example.com",   "Suresh",    "Bhatt",      "8321098765", 21},
		{"nisha.chopra@example.com",   "Nisha",     "Chopra",     "8210987654", 18},
		{"amit.srivastava@example.com","Amit",      "Srivastava", "8109876543", 15},
		{"riya.agarwal@example.com",   "Riya",      "Agarwal",    "8098765432", 12},
		{"vivek.menon@example.com",    "Vivek",     "Menon",      "7987654321", 10},
		{"sneha.kapoor@example.com",   "Sneha",     "Kapoor",     "7876543210", 7},
		{"tarun.dubey@example.com",    "Tarun",     "Dubey",      "7765432109", 5},
		{"preeti.bose@example.com",    "Preeti",    "Bose",       "7654321098", 3},
		{"manish.tiwari@example.com",  "Manish",    "Tiwari",     "7543210987", 2},
		{"anjali.mishra@example.com",  "Anjali",    "Mishra",     "7432109876", 1},
	}

	paymentMethods := []string{"cash", "upi", "card", "upi", "cash", "upi"}

	var allMembers []*models.Member

	for i, ms := range memberSeeds {
		// Check if user exists
		if u, _ := userRepo.FindByEmail(ms.email); u != nil {
			if m, _ := memberRepo.FindByUserID(u.ID); m != nil {
				logger.Info("member already exists", "email", ms.email)
				allMembers = append(allMembers, m)
				continue
			}
		}

		info, err := authSvc.Signup(services.SignupRequest{
			Email:     ms.email,
			Password:  "Member@123456",
			FirstName: ms.firstName,
			LastName:  ms.lastName,
			Phone:     ms.phone,
			Role:      constants.RoleMember,
		})
		if err != nil {
			logger.Error("member signup failed", "email", ms.email, "err", err)
			continue
		}

		u, _ := userRepo.FindByEmail(ms.email)
		if u != nil {
			u.EmailVerified = true
			_ = userRepo.Update(u)
		}

		plan := planList[i%len(planList)]
		pid := plan.ID
		joinDate := now.AddDate(0, 0, -ms.daysAgo)

		m := &models.Member{
			UserID:           info.ID,
			FacilityID:       facility.ID,
			MembershipStatus: models.MemberStatusActive,
			CurrentPlanID:    &pid,
			JoinedDate:       joinDate,
		}
		if err := memberRepo.Create(m); err != nil {
			logger.Error("create member failed", "email", ms.email, "err", err)
			continue
		}

		// Subscription
		subStart := joinDate
		subEnd   := subStart.AddDate(0, 0, plan.BillingPeriodDays)
		if subEnd.Before(now) {
			subEnd = now.AddDate(0, 0, 30)
		}
		nextRenewal := subEnd
		sub := &models.Subscription{
			MemberID:        m.ID,
			PlanID:          plan.ID,
			StartDate:       subStart,
			EndDate:         subEnd,
			Status:          models.SubStatusActive,
			OriginalAmount:  plan.PriceAmount,
			FinalAmount:     plan.PriceAmount,
			Currency:        "INR",
			AutoRenew:       true,
			NextRenewalDate: &nextRenewal,
		}
		if err := db.Create(sub).Error; err != nil {
			logger.Error("create subscription failed", "err", err)
			continue
		}

		// Payment
		method := paymentMethods[i%len(paymentMethods)]
		pmt := &models.Payment{
			MemberID:       m.ID,
			SubscriptionID: &sub.ID,
			Amount:         plan.PriceAmount,
			Currency:       "INR",
			PaymentMethod:  method,
			Status:         "completed",
			PaidAt:         joinDate,
			RecordedByID:   adminID,
		}
		if err := db.Create(pmt).Error; err != nil {
			logger.Error("create payment failed", "err", err)
		}

		allMembers = append(allMembers, m)
		logger.Info("member seeded", "email", ms.email, "plan", plan.Name, "joined", joinDate.Format("2006-01-02"))
	}

	// ── Attendance records: last 30 days, 8–25 check-ins per day ─────────────
	if len(allMembers) == 0 {
		logger.Info("no members, skipping attendance")
	} else {
		// Delete existing seed attendance to allow re-runs
		db.Exec("DELETE FROM attendances WHERE notes = 'richseed'")

		for dayOffset := 29; dayOffset >= 0; dayOffset-- {
			day := now.AddDate(0, 0, -dayOffset)
			// 8–22 check-ins per day, more on weekdays
			checkIns := 8 + rand.Intn(15)
			if day.Weekday() == time.Saturday || day.Weekday() == time.Sunday {
				checkIns = 15 + rand.Intn(10)
			}
			// Pick random members for this day
			shuffled := rand.Perm(len(allMembers))
			for k := 0; k < checkIns && k < len(shuffled); k++ {
				member := allMembers[shuffled[k]]
				hour := 6 + rand.Intn(13) // 6am-7pm
				checkIn := time.Date(day.Year(), day.Month(), day.Day(), hour, rand.Intn(60), 0, 0, now.Location())
				dur := 45 + rand.Intn(60)
				durPtr := &dur
				checkOut := checkIn.Add(time.Duration(dur) * time.Minute)
				rec := &models.Attendance{
					MemberID:     member.ID,
					FacilityID:   facility.ID,
					CheckInAt:    checkIn,
					CheckOutAt:   &checkOut,
					DurationMins: durPtr,
					Method:       "manual",
					Notes:        "richseed",
				}
				db.Create(rec)
			}
		}
		logger.Info("attendance seeded", "days", 30)
	}

	// ── Extra payments spread over last 30 days (renewal/walk-in revenue) ─────
	db.Exec("DELETE FROM payments WHERE notes = 'richseed-extra'")
	extraAmounts := []float64{999, 1999, 3499, 1999, 999, 1499, 2999, 1999}
	methods2 := []string{"cash", "upi", "card", "upi", "cash"}
	for dayOffset := 29; dayOffset >= 0; dayOffset-- {
		paymentsThisDay := 1 + rand.Intn(4)
		for k := 0; k < paymentsThisDay; k++ {
			if len(allMembers) == 0 { break }
			member := allMembers[rand.Intn(len(allMembers))]
			amt := extraAmounts[rand.Intn(len(extraAmounts))]
			paidAt := now.AddDate(0, 0, -dayOffset).Add(time.Duration(8+rand.Intn(10)) * time.Hour)
			pmt := &models.Payment{
				MemberID:      member.ID,
				Amount:        amt,
				Currency:      "INR",
				PaymentMethod: methods2[rand.Intn(len(methods2))],
				Status:        "completed",
				PaidAt:        paidAt,
				RecordedByID:  adminID,
				Notes:         "richseed-extra",
			}
			db.Create(pmt)
		}
	}
	logger.Info("extra payments seeded")

	// ── Class bookings ────────────────────────────────────────────────────────
	if len(classList) > 0 && len(allMembers) > 0 {
		db.Exec("DELETE FROM class_bookings WHERE notes = 'richseed'")
		for _, class := range classList {
			slots := 3 + rand.Intn(8)
			shuffled := rand.Perm(len(allMembers))
			for k := 0; k < slots && k < len(shuffled); k++ {
				member := allMembers[shuffled[k]]
				mid := member.ID
			booking := &models.ClassBooking{
					ClassID:    class.ID,
					MemberID:   &mid,
					Status:     models.BookingStatusConfirmed,
					BookedAt:   class.StartTime.Add(-time.Duration(1+rand.Intn(48)) * time.Hour),
				}
				if err := db.Create(booking).Error; err == nil {
					logger.Info("booking created", "class", class.Name, "member", member.ID)
				}
			}
		}
	}

	// ── Past classes with attended bookings for history ───────────────────────
	pastClassDefs := []struct {
		name      string
		classType string
		daysAgo   int
		hour      int
		duration  int
	}{
		{"Morning Yoga", models.ClassTypeYoga, 25, 7, 60},
		{"HIIT Blast", models.ClassTypeHIIT, 22, 18, 45},
		{"Pilates Core", models.ClassTypePilates, 18, 10, 60},
		{"Cardio Burn", models.ClassTypeCardio, 15, 7, 30},
		{"Zumba Fun", models.ClassTypeCardio, 12, 17, 45},
		{"Power Yoga", models.ClassTypeYoga, 10, 6, 60},
		{"Strength Circuit", models.ClassTypeHIIT, 7, 19, 50},
		{"Meditation", models.ClassTypeYoga, 5, 8, 30},
		{"Boxing Basics", models.ClassTypeHIIT, 3, 18, 60},
		{"Stretch & Flex", models.ClassTypePilates, 1, 9, 45},
	}

	var trainerIDs []uint
	rows, _ := db.Table("trainer_profiles").Select("id").Rows()
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var tid uint
			rows.Scan(&tid)
			trainerIDs = append(trainerIDs, tid)
		}
	}

	for idx, pc := range pastClassDefs {
		start := now.AddDate(0, 0, -pc.daysAgo)
		start = time.Date(start.Year(), start.Month(), start.Day(), pc.hour, 0, 0, 0, now.Location())
		end   := start.Add(time.Duration(pc.duration) * time.Minute)

		var trainerID *uint
		if len(trainerIDs) > 0 {
			tid := trainerIDs[idx%len(trainerIDs)]
			trainerID = &tid
		}

		class := &models.Class{
			FacilityID:   facility.ID,
			TrainerID:    trainerID,
			Name:         pc.name,
			ClassType:    pc.classType,
			DurationMins: pc.duration,
			MaxCapacity:  20,
			StartTime:    start,
			EndTime:      end,
			Status:       models.ClassStatusCompleted,
			IsActive:     true,
			IsFree:       idx%2 == 0,
		}
		if err := db.Create(class).Error; err != nil {
			continue
		}

		// Add 5-15 bookings per past class
		slots := 5 + rand.Intn(10)
		shuffled := rand.Perm(len(allMembers))
		for k := 0; k < slots && k < len(shuffled); k++ {
			member := allMembers[shuffled[k]]
			mid2 := member.ID
			bk := &models.ClassBooking{
				ClassID:   class.ID,
				MemberID:  &mid2,
				Status:    models.BookingStatusAttended,
				BookedAt:  start.Add(-time.Duration(24+rand.Intn(48)) * time.Hour),
			}
			db.Create(bk)
		}
		logger.Info(fmt.Sprintf("past class seeded: %s (%d bookings)", pc.name, slots))
	}

	logger.Info("rich seed complete ✓")
}
