package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gym-backend/internal/config"
	"gym-backend/internal/database"
	"gym-backend/internal/repositories"
	"gym-backend/internal/router"
	"gym-backend/internal/services"
	"gym-backend/internal/workers"
)

func main() {
	// Structured JSON logging.
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	db, err := database.Connect(&cfg.Database)
	if err != nil {
		slog.Error("database connect failed", "err", err)
		os.Exit(1)
	}

	// Wire up repositories.
	userRepo     := repositories.NewUserRepository(db)
	tokenRepo    := repositories.NewRefreshTokenRepository(db)
	otpRepo      := repositories.NewOTPRepository(db)
	memberRepo     := repositories.NewMemberRepository(db)
	planRepo       := repositories.NewPlanRepository(db)
	subRepo        := repositories.NewSubscriptionRepository(db)
	promoRepo      := repositories.NewPromoCodeRepository(db)
	auditRepo      := repositories.NewAuditLogRepository(db)
	paymentRepo    := repositories.NewPaymentRepository(db)
	facilityRepo   := repositories.NewFacilityRepository(db)
	attendanceRepo := repositories.NewAttendanceRepository(db)
	trainerRepo    := repositories.NewTrainerRepository(db)
	classRepo      := repositories.NewClassRepository(db)
	bookingRepo         := repositories.NewBookingRepository(db)
	dietTemplateRepo    := repositories.NewDietTemplateRepository(db)
	trainingTemplateRepo := repositories.NewTrainingTemplateRepository(db)
	dayPassRepo         := repositories.NewDayPassRepository(db)
	foodRepo            := repositories.NewFoodRepository(db)
	expenseCatRepo      := repositories.NewExpenseCategoryRepository(db)
	expenseRepo         := repositories.NewExpenseRepository(db)
	enquiryRepo         := repositories.NewEnquiryRepository(db)

	// Wire up repositories (notifications + reports).
	notifRepo  := repositories.NewNotificationRepository(db)
	reportRepo := repositories.NewReportRepository(db)

	// Billing & entitlement repositories.
	taxProfileRepo  := repositories.NewTaxProfileRepository(db)
	invoiceRepo     := repositories.NewInvoiceRepository(db)
	receiptRepo     := repositories.NewReceiptRepository(db)
	creditNoteRepo  := repositories.NewCreditNoteRepository(db)
	ledgerRepo      := repositories.NewEntitlementLedgerRepository(db)
	freezeRepo      := repositories.NewFreezeRepository(db)

	// PT repositories
	ptPkgRepo       := repositories.NewPTPackageRepository(db)
	memPTRepo       := repositories.NewMemberPTPackageRepository(db)
	ptSessionRepo   := repositories.NewPTSessionRepository(db)
	sessionCreditRepo := repositories.NewSessionCreditLedgerRepository(db)

	// Coaching repositories
	exerciseRepo          := repositories.NewExerciseRepository(db)
	workoutAssignmentRepo := repositories.NewWorkoutAssignmentRepository(db)
	dietAssignmentRepo    := repositories.NewDietAssignmentRepository(db)
	workoutLogRepo        := repositories.NewWorkoutLogRepository(db)
	trainerFeedbackRepo   := repositories.NewTrainerFeedbackRepository(db)

	// Retention repositories
	bodyMeasRepo       := repositories.NewBodyMeasurementRepository(db)
	progressPhotoRepo  := repositories.NewProgressPhotoRepository(db)
	retentionRiskRepo  := repositories.NewRetentionRiskRepository(db)
	retentionActionRepo := repositories.NewRetentionActionRepository(db)

	// CRM repositories
	leadActivityRepo := repositories.NewLeadActivityRepository(db)
	leadFollowUpRepo := repositories.NewLeadFollowUpRepository(db)
	trialVisitRepo  := repositories.NewTrialVisitRepository(db)
	waiverRepo      := repositories.NewMemberWaiverRepository(db)

	// Loyalty repositories
	referralCodeRepo    := repositories.NewReferralCodeRepository(db)
	referralRepo        := repositories.NewReferralRepository(db)
	loyaltyAccountRepo  := repositories.NewLoyaltyAccountRepository(db)
	loyaltyTxRepo       := repositories.NewLoyaltyTransactionRepository(db)
	loyaltyConfigRepo   := repositories.NewLoyaltyConfigRepository(db)

	// POS repositories
	productRepo      := repositories.NewProductRepository(db)
	posOrderRepo     := repositories.NewPOSOrderRepository(db)
	stockMovementRepo := repositories.NewStockMovementRepository(db)

	// Commission repositories
	commissionRuleRepo   := repositories.NewCommissionRuleRepository(db)
	commissionEntryRepo  := repositories.NewCommissionEntryRepository(db)
	commissionPayoutRepo := repositories.NewCommissionPayoutRepository(db)

	// Branch repository
	branchRepo := repositories.NewBranchRepository(db)
	lockerRepo           := repositories.NewLockerRepository(db)
	lockerAllotmentRepo  := repositories.NewLockerAllotmentRepository(db)

	// Operations repositories
	staffRepo               := repositories.NewStaffRepository(db)
	staffAttendanceRepo     := repositories.NewStaffAttendanceRepository(db)
	vendorRepo              := repositories.NewVendorRepository(db)
	equipRepo               := repositories.NewEquipmentRepository(db)
	purchaseRepo            := repositories.NewPurchaseRepository(db)

	// Wire up services.
	emailSvc   := services.NewEmailService(cfg.SMTP, logger)
	authSvc    := services.NewAuthService(userRepo, tokenRepo, otpRepo, emailSvc, cfg.JWT, logger)
	notifSvc   := services.NewNotificationService(notifRepo, emailSvc, logger)
	memberSvc  := services.NewMemberService(memberRepo, userRepo, auditRepo, authSvc, notifSvc, logger)
	planSvc    := services.NewPlanService(planRepo, auditRepo, logger)
	subSvc     := services.NewSubscriptionServiceFull(subRepo, memberRepo, planRepo, promoRepo, auditRepo, freezeRepo, ledgerRepo, logger)
	paymentSvc    := services.NewPaymentService(paymentRepo, memberRepo, subRepo, auditRepo, notifSvc, logger)
	attendanceSvc := services.NewAttendanceService(attendanceRepo, memberRepo, facilityRepo, cfg.JWT, logger)
	trainerSvc    := services.NewTrainerService(trainerRepo, userRepo, auditRepo, classRepo, authSvc, logger)
	classSvc      := services.NewClassService(classRepo, trainerRepo, bookingRepo, memberRepo, auditRepo, notifSvc, logger)
	bookingSvc    := services.NewBookingService(bookingRepo, classRepo, memberRepo, planRepo, subRepo, dayPassRepo, notifSvc, logger)
	reportSvc     := services.NewReportService(reportRepo, logger)
	auditSvc      := services.NewAuditService(auditRepo, logger)
	facilitySvc   := services.NewFacilityService(facilityRepo, logger)
	promoSvc            := services.NewPromoService(promoRepo, planRepo, logger)
	dietTemplateSvc     := services.NewDietTemplateService(dietTemplateRepo, logger)
	trainingTemplateSvc := services.NewTrainingTemplateService(trainingTemplateRepo, logger)
	dayPassSvc          := services.NewDayPassService(dayPassRepo, logger)
	foodSvc             := services.NewFoodService(foodRepo, logger)
	expenseCatSvc       := services.NewExpenseCategoryService(expenseCatRepo, logger)
	expenseSvc          := services.NewExpenseService(expenseRepo, logger)
	enquirySvc          := services.NewEnquiryService(enquiryRepo, logger)
	billingSvc          := services.NewBillingService(taxProfileRepo, invoiceRepo, receiptRepo, creditNoteRepo, memberRepo, paymentRepo, logger)
	ptSvc               := services.NewPTService(ptPkgRepo, memPTRepo, ptSessionRepo, sessionCreditRepo, memberRepo, trainerRepo, logger)
	exerciseSvc         := services.NewExerciseService(exerciseRepo, logger)
	coachingSvc         := services.NewCoachingService(workoutAssignmentRepo, dietAssignmentRepo, workoutLogRepo, trainerFeedbackRepo, logger)
	bodyMeasSvc         := services.NewBodyMeasurementService(bodyMeasRepo, logger)
	progressPhotoSvc    := services.NewProgressPhotoService(progressPhotoRepo, logger)
	retentionSvc        := services.NewRetentionService(retentionRiskRepo, retentionActionRepo, logger)
	crmSvc              := services.NewCRMService(leadActivityRepo, leadFollowUpRepo, trialVisitRepo, logger)
	waiverSvc           := services.NewWaiverService(waiverRepo, logger)
	loyaltySvc          := services.NewLoyaltyService(referralCodeRepo, referralRepo, loyaltyAccountRepo, loyaltyTxRepo, loyaltyConfigRepo, logger)
	posSvc              := services.NewPOSService(productRepo, posOrderRepo, stockMovementRepo, logger)
	commissionSvc       := services.NewCommissionService(commissionRuleRepo, commissionEntryRepo, commissionPayoutRepo, logger)
	branchSvc           := services.NewBranchService(branchRepo, logger)
	lockerSvc           := services.NewLockerService(lockerRepo, lockerAllotmentRepo)
	staffSvc            := services.NewStaffService(staffRepo, logger)
	staffAttendanceSvc  := services.NewStaffAttendanceService(staffAttendanceRepo, staffRepo, logger)
	vendorSvc           := services.NewVendorService(vendorRepo, logger)
	equipmentSvc        := services.NewEquipmentService(equipRepo, logger)
	purchaseSvc         := services.NewPurchaseService(purchaseRepo, logger)

	// Seed default templates (no-op if data already exists).
	if err := dietTemplateSvc.SeedDefaults(); err != nil {
		slog.Warn("diet template seed failed", "err", err)
	}
	if err := trainingTemplateSvc.SeedDefaults(); err != nil {
		slog.Warn("training template seed failed", "err", err)
	}
	if err := foodSvc.SeedDefaults(); err != nil {
		slog.Warn("food seed failed", "err", err)
	}

	// Build router.
	handler := router.New(cfg, db, memberRepo, authSvc, memberSvc, planSvc, subSvc, paymentSvc, attendanceSvc, trainerSvc, classSvc, bookingSvc, notifSvc, reportSvc, auditSvc, facilitySvc, promoSvc, dietTemplateSvc, trainingTemplateSvc, dayPassSvc, foodSvc, expenseCatSvc, expenseSvc, enquirySvc, billingSvc, ptSvc, exerciseSvc, coachingSvc, bodyMeasSvc, progressPhotoSvc, retentionSvc, crmSvc, waiverSvc, loyaltySvc, posSvc, commissionSvc, branchSvc, lockerSvc, staffSvc, staffAttendanceSvc, vendorSvc, equipmentSvc, purchaseSvc)

	srv := &http.Server{
		Addr:         ":" + cfg.App.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start background workers.
	workerCtx, cancelWorkers := context.WithCancel(context.Background())
	renewalWorker := workers.NewRenewalWorker(subRepo, memberRepo, auditRepo, logger)
	go renewalWorker.Start(workerCtx)
	notifWorker := workers.NewNotificationWorker(subRepo, memberRepo, classRepo, bookingRepo, notifSvc, logger)
	go notifWorker.Start(workerCtx)
	classWorker := workers.NewClassWorker(classRepo, logger)
	go classWorker.Start(workerCtx)

	// Graceful shutdown.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("server starting", "port", cfg.App.Port, "env", cfg.App.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-stop
	cancelWorkers()
	slog.Info("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	slog.Info("server stopped")
}
