package router

import (
	"net/http"

	"gorm.io/gorm"

	"gym-backend/internal/config"
	"gym-backend/internal/constants"
	"gym-backend/internal/handlers"
	"gym-backend/internal/middleware"
	"gym-backend/internal/repositories"
	"gym-backend/internal/services"
)

// chain applies middlewares right-to-left so the first listed runs first.
func chain(h http.Handler, mws ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

// New builds and returns the root HTTP handler with all routes registered.
func New(
	cfg *config.Config,
	db *gorm.DB,
	memberRepo   repositories.MemberRepository,
	authSvc      services.AuthService,
	memberSvc    services.MemberService,
	planSvc      services.PlanService,
	subSvc       services.SubscriptionService,
	paymentSvc   services.PaymentService,
	attendanceSvc services.AttendanceService,
	trainerSvc   services.TrainerService,
	classSvc     services.ClassService,
	bookingSvc   services.BookingService,
	notifSvc     services.NotificationService,
	reportSvc    services.ReportService,
	auditSvc     services.AuditService,
	facilitySvc  services.FacilityService,
	promoSvc            services.PromoService,
	dietTemplateSvc     services.DietTemplateService,
	trainingTemplateSvc services.TrainingTemplateService,
	dayPassSvc          services.DayPassService,
	foodSvc             services.FoodService,
	expenseCatSvc       services.ExpenseCategoryService,
	expenseSvc          services.ExpenseService,
	enquirySvc          services.EnquiryService,
	billingSvc          services.BillingService,
	ptSvc               services.PTService,
	exerciseSvc         services.ExerciseService,
	coachingSvc         services.CoachingService,
	bodyMeasSvc         services.BodyMeasurementService,
	progressPhotoSvc    services.ProgressPhotoService,
	retentionSvc        services.RetentionService,
	crmSvc              services.CRMService,
	waiverSvc           services.WaiverService,
	loyaltySvc          services.LoyaltyService,
	posSvc              services.POSService,
	commissionSvc       services.CommissionService,
	branchSvc           services.BranchService,
	lockerSvc           services.LockerService,
	staffSvc            services.StaffService,
	staffAttendanceSvc  services.StaffAttendanceService,
	vendorSvc           services.VendorService,
	equipmentSvc        services.EquipmentService,
	purchaseSvc         services.PurchaseService,
) http.Handler {
	mux := http.NewServeMux()

	authH       := handlers.NewAuthHandler(authSvc)
	healthH     := handlers.NewHealthHandler(db)
	memberH     := handlers.NewMemberHandler(memberSvc)
	planH       := handlers.NewPlanHandler(planSvc)
	subH        := handlers.NewSubscriptionHandler(subSvc, memberSvc)
	paymentH    := handlers.NewPaymentHandler(paymentSvc, memberSvc)
	attendanceH := handlers.NewAttendanceHandler(attendanceSvc)
	trainerH    := handlers.NewTrainerHandler(trainerSvc)
	classH      := handlers.NewClassHandler(classSvc)
	bookingH    := handlers.NewBookingHandler(bookingSvc, memberSvc)
	notifH      := handlers.NewNotificationHandler(notifSvc)
	reportH     := handlers.NewReportHandler(reportSvc)
	auditH      := handlers.NewAuditHandler(auditSvc)
	facilityH   := handlers.NewFacilityHandler(facilitySvc)
	promoH              := handlers.NewPromoHandler(promoSvc, notifSvc, memberRepo)
	dietTemplateH       := handlers.NewDietTemplateHandler(dietTemplateSvc)
	trainingTemplateH   := handlers.NewTrainingTemplateHandler(trainingTemplateSvc)
	dayPassH            := handlers.NewDayPassHandler(dayPassSvc)
	foodH               := handlers.NewFoodHandler(foodSvc)
	expenseCatH         := handlers.NewExpenseCategoryHandler(expenseCatSvc)
	expenseH            := handlers.NewExpenseHandler(expenseSvc)
	enquiryH            := handlers.NewEnquiryHandler(enquirySvc)
	billingH            := handlers.NewBillingHandler(billingSvc, subSvc, memberSvc)
	ptH                 := handlers.NewPTHandler(ptSvc, memberSvc)
	exerciseH           := handlers.NewExerciseHandler(exerciseSvc)
	coachingH           := handlers.NewCoachingHandler(coachingSvc)
	bodyMeasH           := handlers.NewBodyMeasurementHandler(bodyMeasSvc)
	progressPhotoH      := handlers.NewProgressPhotoHandler(progressPhotoSvc)
	retentionH          := handlers.NewRetentionHandler(retentionSvc)
	crmH                := handlers.NewCRMHandler(crmSvc)
	waiverH             := handlers.NewWaiverHandler(waiverSvc)
	loyaltyH            := handlers.NewLoyaltyHandler(loyaltySvc)
	posH                := handlers.NewPOSHandler(posSvc)
	commissionH         := handlers.NewCommissionHandler(commissionSvc)
	branchH             := handlers.NewBranchHandler(branchSvc)
	lockerH             := handlers.NewLockerHandler(lockerSvc)
	staffH              := handlers.NewStaffHandler(staffSvc)
	staffAttendanceH    := handlers.NewStaffAttendanceHandler(staffAttendanceSvc)
	vendorH             := handlers.NewVendorHandler(vendorSvc)
	equipmentH          := handlers.NewEquipmentHandler(equipmentSvc)
	purchaseH           := handlers.NewPurchaseHandler(purchaseSvc)

	// Global middleware stack (order: recovery → bodyLimit → cors → requestID → logging → rateLimit).
	globalMW := []func(http.Handler) http.Handler{
		middleware.Recovery,
		middleware.BodyLimit,
		middleware.CORS(cfg.CORS.AllowedOrigins),
		middleware.RequestID,
		middleware.Logging,
		middleware.RateLimit(cfg.RateLimit.Requests, cfg.RateLimit.Window),
	}

	// Authenticated middleware stack (adds JWT validation).
	authMW := append(globalMW, middleware.Authenticate(authSvc))

	// Shorthand for role-gated authenticated routes.
	adminOnly    := func(h http.Handler) http.Handler { return middleware.RequireRoles(constants.RoleAdmin)(h) }
	adminManager := func(h http.Handler) http.Handler {
		return middleware.RequireRoles(constants.RoleAdmin, constants.RoleManager)(h)
	}

	// OPTIONS preflight catch-all for every sub-path under /api/v1/
	mux.Handle("OPTIONS /api/", chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}), globalMW...))
	mux.Handle("OPTIONS /", chain(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}), globalMW...))

	// ── Health ────────────────────────────────────────────────────────────────
	mux.Handle("GET /health", chain(http.HandlerFunc(healthH.Health), globalMW...))

	// ── Auth (public) ─────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/auth/signup",              chain(http.HandlerFunc(authH.Signup), globalMW...))
	mux.Handle("POST /api/v1/auth/verify-email",        chain(http.HandlerFunc(authH.VerifyEmail), globalMW...))
	mux.Handle("POST /api/v1/auth/resend-verification", chain(http.HandlerFunc(authH.ResendVerification), globalMW...))
	mux.Handle("POST /api/v1/auth/login",               chain(http.HandlerFunc(authH.Login), globalMW...))
	mux.Handle("POST /api/v1/auth/refresh-token",       chain(http.HandlerFunc(authH.RefreshToken), globalMW...))
	mux.Handle("POST /api/v1/auth/forgot-password",     chain(http.HandlerFunc(authH.ForgotPassword), globalMW...))
	mux.Handle("POST /api/v1/auth/reset-password",      chain(http.HandlerFunc(authH.ResetPassword), globalMW...))

	// ── Auth (protected) ──────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/auth/logout",          chain(http.HandlerFunc(authH.Logout), authMW...))
	mux.Handle("POST /api/v1/auth/change-password", chain(http.HandlerFunc(authH.ChangePassword), authMW...))
	mux.Handle("GET /api/v1/auth/me",               chain(http.HandlerFunc(authH.Me), authMW...))
	mux.Handle("PATCH /api/v1/auth/me",             chain(http.HandlerFunc(authH.UpdateMe), authMW...))

	// ── Members ───────────────────────────────────────────────────────────────
	// Admin/manager: create, list, manage any member.
	mux.Handle("POST /api/v1/members",
		chain(http.HandlerFunc(memberH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members",
		chain(http.HandlerFunc(memberH.List), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/members/{id}",
		chain(http.HandlerFunc(memberH.Delete), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/members/{id}/freeze",
		chain(http.HandlerFunc(memberH.Freeze), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/members/{id}/unfreeze",
		chain(http.HandlerFunc(memberH.Unfreeze), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/members/{id}/assign-trainer",
		chain(http.HandlerFunc(memberH.AssignTrainer), append(authMW, adminManager)...))

	// All authenticated users: view/update member profile.
	mux.Handle("GET /api/v1/members/me",             chain(http.HandlerFunc(memberH.Me), authMW...))
	mux.Handle("GET /api/v1/members/{id}",           chain(http.HandlerFunc(memberH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/members/{id}",         chain(http.HandlerFunc(memberH.Update), authMW...))
	mux.Handle("GET /api/v1/members/{id}/timeline",  chain(http.HandlerFunc(reportH.MemberTimeline), authMW...))

	// ── Plans ─────────────────────────────────────────────────────────────────
	// Public-ish: list active plans (requires auth so we know the facility).
	mux.Handle("GET /api/v1/plans",      chain(http.HandlerFunc(planH.List), authMW...))
	mux.Handle("GET /api/v1/plans/{id}", chain(http.HandlerFunc(planH.GetByID), authMW...))

	// Admin only: create, update, deactivate plans.
	mux.Handle("POST /api/v1/plans",
		chain(http.HandlerFunc(planH.Create), append(authMW, adminOnly)...))
	mux.Handle("PATCH /api/v1/plans/{id}",
		chain(http.HandlerFunc(planH.Update), append(authMW, adminOnly)...))
	mux.Handle("POST /api/v1/plans/{id}/activate",
		chain(http.HandlerFunc(planH.Activate), append(authMW, adminOnly)...))
	mux.Handle("DELETE /api/v1/plans/{id}",
		chain(http.HandlerFunc(planH.Deactivate), append(authMW, adminOnly)...))

	// ── Subscriptions ─────────────────────────────────────────────────────────
	// Admin/manager: full access.
	mux.Handle("POST /api/v1/subscriptions",
		chain(http.HandlerFunc(subH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/subscriptions",
		chain(http.HandlerFunc(subH.List), append(authMW, adminManager)...))

	// All authenticated: view subscription details.
	mux.Handle("GET /api/v1/subscriptions/{id}",
		chain(http.HandlerFunc(subH.GetByID), authMW...))

	// Subscription lifecycle (admin/manager).
	mux.Handle("POST /api/v1/subscriptions/{id}/pause",
		chain(http.HandlerFunc(subH.Pause), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/subscriptions/{id}/resume",
		chain(http.HandlerFunc(subH.Resume), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/subscriptions/{id}/cancel",
		chain(http.HandlerFunc(subH.Cancel), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/subscriptions/{id}/extend",
		chain(http.HandlerFunc(subH.Extend), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/subscriptions/{id}/upgrade",
		chain(http.HandlerFunc(subH.Upgrade), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/subscriptions/{id}/auto-renew",
		chain(http.HandlerFunc(subH.SetAutoRenew), authMW...))

	// Member subscriptions.
	mux.Handle("GET /api/v1/members/{id}/subscriptions",
		chain(http.HandlerFunc(subH.ListByMember), authMW...))
	mux.Handle("GET /api/v1/members/{id}/subscriptions/active",
		chain(http.HandlerFunc(subH.GetActivByMember), authMW...))

	// ── Payments ──────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/payments",
		chain(http.HandlerFunc(paymentH.Record), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/payments",
		chain(http.HandlerFunc(paymentH.List), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/payments/{id}",
		chain(http.HandlerFunc(paymentH.GetByID), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/payments/{id}/refund",
		chain(http.HandlerFunc(paymentH.Refund), append(authMW, adminManager)...))

	// Member payment history (accessible to the member themselves too).
	mux.Handle("GET /api/v1/members/{id}/payments",
		chain(http.HandlerFunc(paymentH.ListByMember), authMW...))

	// ── Attendance ────────────────────────────────────────────────────────────
	// QR code generation — members get their own, staff get any member's.
	mux.Handle("GET /api/v1/members/{id}/qr-code",
		chain(http.HandlerFunc(attendanceH.GenerateQRCode), authMW...))

	// Check-in / check-out — any authenticated user.
	mux.Handle("POST /api/v1/attendance/check-in",
		chain(http.HandlerFunc(attendanceH.CheckIn), authMW...))
	mux.Handle("POST /api/v1/attendance/check-out",
		chain(http.HandlerFunc(attendanceH.CheckOutByMember), authMW...))
	mux.Handle("PATCH /api/v1/attendance/{id}/check-out",
		chain(http.HandlerFunc(attendanceH.CheckOut), authMW...))

	// View attendance records — admin/manager see all, members see their own.
	mux.Handle("GET /api/v1/attendance",
		chain(http.HandlerFunc(attendanceH.List), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/attendance/{id}",
		chain(http.HandlerFunc(attendanceH.GetByID), append(authMW, adminManager)...))

	// Per-member attendance history and stats.
	mux.Handle("GET /api/v1/members/{id}/attendance",
		chain(http.HandlerFunc(attendanceH.ListByMember), authMW...))
	mux.Handle("GET /api/v1/members/{id}/attendance/stats",
		chain(http.HandlerFunc(attendanceH.Stats), authMW...))

	// ── Trainers ──────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/trainers",
		chain(http.HandlerFunc(trainerH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/trainers",
		chain(http.HandlerFunc(trainerH.List), authMW...))
	mux.Handle("GET /api/v1/trainers/me",
		chain(http.HandlerFunc(trainerH.Me), authMW...))
	mux.Handle("GET /api/v1/trainers/{id}",
		chain(http.HandlerFunc(trainerH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/trainers/{id}",
		chain(http.HandlerFunc(trainerH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/trainers/{id}",
		chain(http.HandlerFunc(trainerH.Deactivate), append(authMW, adminOnly)...))
	mux.Handle("GET /api/v1/trainers/{id}/classes",
		chain(http.HandlerFunc(trainerH.ListClasses), authMW...))
	mux.Handle("GET /api/v1/trainers/{id}/schedule",
		chain(http.HandlerFunc(trainerH.GetSchedule), authMW...))
	mux.Handle("POST /api/v1/trainers/{id}/schedule",
		chain(http.HandlerFunc(trainerH.CreateShift), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/trainers/{id}/schedule/{shift_id}",
		chain(http.HandlerFunc(trainerH.UpdateShift), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/trainers/{id}/schedule/{shift_id}",
		chain(http.HandlerFunc(trainerH.DeleteShift), append(authMW, adminManager)...))

	// ── Classes ───────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/classes",
		chain(http.HandlerFunc(classH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/classes",
		chain(http.HandlerFunc(classH.List), authMW...))
	mux.Handle("GET /api/v1/classes/upcoming",
		chain(http.HandlerFunc(classH.Upcoming), authMW...))
	mux.Handle("GET /api/v1/classes/{id}",
		chain(http.HandlerFunc(classH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/classes/{id}",
		chain(http.HandlerFunc(classH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/classes/{id}",
		chain(http.HandlerFunc(classH.Cancel), append(authMW, adminManager)...))

	// Roster for a class (admin/manager/trainer).
	mux.Handle("GET /api/v1/classes/{id}/bookings",
		chain(http.HandlerFunc(bookingH.ListByClass), authMW...))

	// ── Bookings ──────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/bookings",
		chain(http.HandlerFunc(bookingH.Book), authMW...))
	mux.Handle("GET /api/v1/bookings/{id}",
		chain(http.HandlerFunc(bookingH.GetByID), authMW...))
	mux.Handle("DELETE /api/v1/bookings/{id}",
		chain(http.HandlerFunc(bookingH.Cancel), authMW...))
	mux.Handle("POST /api/v1/bookings/{id}/attend",
		chain(http.HandlerFunc(bookingH.MarkAttended), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/bookings/{id}/no-show",
		chain(http.HandlerFunc(bookingH.MarkNoShow), append(authMW, adminManager)...))

	// Admin: list all bookings with filters.
	mux.Handle("GET /api/v1/bookings",
		chain(http.HandlerFunc(bookingH.List), append(authMW, adminManager)...))

	// Per-member booking history.
	mux.Handle("GET /api/v1/members/{id}/bookings/upcoming",
		chain(http.HandlerFunc(bookingH.ListUpcomingByMember), authMW...))
	mux.Handle("GET /api/v1/members/{id}/bookings",
		chain(http.HandlerFunc(bookingH.ListByMember), authMW...))

	// ── Facilities ────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/facilities",
		chain(http.HandlerFunc(facilityH.Create), append(authMW, adminOnly)...))
	mux.Handle("GET /api/v1/facilities",
		chain(http.HandlerFunc(facilityH.List), authMW...))
	mux.Handle("GET /api/v1/facilities/{id}",
		chain(http.HandlerFunc(facilityH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/facilities/{id}",
		chain(http.HandlerFunc(facilityH.Update), append(authMW, adminOnly)...))

	// ── Promo Codes ───────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/promo-codes",
		chain(http.HandlerFunc(promoH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/promo-codes",
		chain(http.HandlerFunc(promoH.List), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/promo-codes/validate",
		chain(http.HandlerFunc(promoH.Validate), authMW...))
	mux.Handle("GET /api/v1/promo-codes/{id}",
		chain(http.HandlerFunc(promoH.GetByID), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/promo-codes/{id}",
		chain(http.HandlerFunc(promoH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/promo-codes/{id}",
		chain(http.HandlerFunc(promoH.Deactivate), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/promo-codes/{id}/broadcast",
		chain(http.HandlerFunc(promoH.Broadcast), append(authMW, adminManager)...))

	// ── Audit Logs ────────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/audit-logs",
		chain(http.HandlerFunc(auditH.List), append(authMW, adminOnly)...))

	// ── Reports (admin/manager only) ──────────────────────────────────────────
	mux.Handle("GET /api/v1/reports/dashboard",
		chain(http.HandlerFunc(reportH.Dashboard), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/reports/revenue",
		chain(http.HandlerFunc(reportH.Revenue), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/reports/attendance",
		chain(http.HandlerFunc(reportH.Attendance), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/reports/members",
		chain(http.HandlerFunc(reportH.Members), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/reports/subscriptions",
		chain(http.HandlerFunc(reportH.Subscriptions), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/reports/classes",
		chain(http.HandlerFunc(reportH.Classes), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/reports/expiring",
		chain(http.HandlerFunc(reportH.ExpiringMembers), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/reports/trainers",
		chain(http.HandlerFunc(reportH.Trainers), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/reports/inactive-members",
		chain(http.HandlerFunc(reportH.InactiveMembers), append(authMW, adminManager)...))

	// ── Diet Templates ────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/diet-templates",
		chain(http.HandlerFunc(dietTemplateH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/diet-templates",
		chain(http.HandlerFunc(dietTemplateH.List), authMW...))
	mux.Handle("GET /api/v1/diet-templates/{id}",
		chain(http.HandlerFunc(dietTemplateH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/diet-templates/{id}",
		chain(http.HandlerFunc(dietTemplateH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/diet-templates/{id}",
		chain(http.HandlerFunc(dietTemplateH.Delete), append(authMW, adminManager)...))

	// ── Training Templates ────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/training-templates",
		chain(http.HandlerFunc(trainingTemplateH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/training-templates",
		chain(http.HandlerFunc(trainingTemplateH.List), authMW...))
	mux.Handle("GET /api/v1/training-templates/{id}",
		chain(http.HandlerFunc(trainingTemplateH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/training-templates/{id}",
		chain(http.HandlerFunc(trainingTemplateH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/training-templates/{id}",
		chain(http.HandlerFunc(trainingTemplateH.Delete), append(authMW, adminManager)...))

	// ── Day Passes ────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/day-passes",
		chain(http.HandlerFunc(dayPassH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/day-passes",
		chain(http.HandlerFunc(dayPassH.List), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/day-passes/{id}",
		chain(http.HandlerFunc(dayPassH.GetByID), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/day-passes/{id}",
		chain(http.HandlerFunc(dayPassH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/day-passes/{id}",
		chain(http.HandlerFunc(dayPassH.Delete), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/day-passes/{id}/check-in",
		chain(http.HandlerFunc(dayPassH.CheckIn), append(authMW, adminManager)...))

	// ── Foods ─────────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/foods",
		chain(http.HandlerFunc(foodH.Create), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/foods/bulk",
		chain(http.HandlerFunc(foodH.BulkImport), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/foods",
		chain(http.HandlerFunc(foodH.List), authMW...))
	mux.Handle("GET /api/v1/foods/{id}",
		chain(http.HandlerFunc(foodH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/foods/{id}",
		chain(http.HandlerFunc(foodH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/foods/{id}",
		chain(http.HandlerFunc(foodH.Delete), append(authMW, adminOnly)...))

	// ── Expense Categories ────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/expense-categories",
		chain(http.HandlerFunc(expenseCatH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/expense-categories",
		chain(http.HandlerFunc(expenseCatH.List), authMW...))
	mux.Handle("GET /api/v1/expense-categories/{id}",
		chain(http.HandlerFunc(expenseCatH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/expense-categories/{id}",
		chain(http.HandlerFunc(expenseCatH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/expense-categories/{id}",
		chain(http.HandlerFunc(expenseCatH.Delete), append(authMW, adminManager)...))

	// ── Expenses ──────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/expenses",
		chain(http.HandlerFunc(expenseH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/expenses",
		chain(http.HandlerFunc(expenseH.List), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/expenses/{id}",
		chain(http.HandlerFunc(expenseH.GetByID), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/expenses/{id}",
		chain(http.HandlerFunc(expenseH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/expenses/{id}",
		chain(http.HandlerFunc(expenseH.Delete), append(authMW, adminManager)...))

	// ── Enquiries ─────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/enquiries",
		chain(http.HandlerFunc(enquiryH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/enquiries",
		chain(http.HandlerFunc(enquiryH.List), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/enquiries/{id}",
		chain(http.HandlerFunc(enquiryH.GetByID), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/enquiries/{id}",
		chain(http.HandlerFunc(enquiryH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/enquiries/{id}",
		chain(http.HandlerFunc(enquiryH.Delete), append(authMW, adminManager)...))

	// ── Billing (GST invoices, receipts, credit notes, tax profile) ──────────
	mux.Handle("GET /api/v1/billing/tax-profile",
		chain(http.HandlerFunc(billingH.GetTaxProfile), append(authMW, adminManager)...))
	mux.Handle("PUT /api/v1/billing/tax-profile",
		chain(http.HandlerFunc(billingH.UpsertTaxProfile), append(authMW, adminOnly)...))
	mux.Handle("GET /api/v1/billing/tax-rates",
		chain(http.HandlerFunc(billingH.ListTaxRates), authMW...))
	mux.Handle("POST /api/v1/billing/tax-rates",
		chain(http.HandlerFunc(billingH.CreateTaxRate), append(authMW, adminOnly)...))
	mux.Handle("PATCH /api/v1/billing/tax-rates/{id}",
		chain(http.HandlerFunc(billingH.UpdateTaxRate), append(authMW, adminOnly)...))

	mux.Handle("POST /api/v1/billing/invoices",
		chain(http.HandlerFunc(billingH.CreateInvoice), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/billing/invoices",
		chain(http.HandlerFunc(billingH.ListInvoices), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/billing/invoices/{id}",
		chain(http.HandlerFunc(billingH.GetInvoice), authMW...))
	mux.Handle("DELETE /api/v1/billing/invoices/{id}",
		chain(http.HandlerFunc(billingH.CancelInvoice), append(authMW, adminOnly)...))

	mux.Handle("POST /api/v1/billing/receipts",
		chain(http.HandlerFunc(billingH.CreateReceipt), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/billing/receipts",
		chain(http.HandlerFunc(billingH.ListReceipts), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/billing/receipts/{id}",
		chain(http.HandlerFunc(billingH.GetReceipt), authMW...))

	mux.Handle("POST /api/v1/billing/credit-notes",
		chain(http.HandlerFunc(billingH.CreateCreditNote), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/billing/credit-notes/{id}",
		chain(http.HandlerFunc(billingH.GetCreditNote), authMW...))

	// Member-scoped billing history
	mux.Handle("GET /api/v1/members/{id}/invoices",
		chain(http.HandlerFunc(billingH.ListInvoicesByMember), authMW...))
	mux.Handle("GET /api/v1/members/{id}/receipts",
		chain(http.HandlerFunc(billingH.ListReceiptsByMember), authMW...))
	mux.Handle("GET /api/v1/members/{id}/credit-notes",
		chain(http.HandlerFunc(billingH.ListCreditNotesByMember), authMW...))

	// Subscription freeze
	mux.Handle("POST /api/v1/subscriptions/{id}/freeze",
		chain(http.HandlerFunc(billingH.FreezeSubscription), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/subscriptions/{id}/freezes",
		chain(http.HandlerFunc(billingH.ListFreezesForSubscription), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/subscription-freezes/{id}/unfreeze",
		chain(http.HandlerFunc(billingH.UnfreezeSubscription), append(authMW, adminManager)...))

	// Upgrade quote & entitlement ledger
	mux.Handle("GET /api/v1/subscriptions/{id}/upgrade-quote",
		chain(http.HandlerFunc(billingH.GetUpgradeQuote), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/subscriptions/{id}/entitlement-ledger",
		chain(http.HandlerFunc(billingH.GetEntitlementLedger), authMW...))

	// ── PT Packages & Sessions ────────────────────────────────────────────────
	mux.Handle("POST /api/v1/pt-packages",
		chain(http.HandlerFunc(ptH.CreatePackage), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/pt-packages",
		chain(http.HandlerFunc(ptH.ListPackages), authMW...))
	mux.Handle("GET /api/v1/pt-packages/{id}",
		chain(http.HandlerFunc(ptH.GetPackage), authMW...))
	mux.Handle("DELETE /api/v1/pt-packages/{id}",
		chain(http.HandlerFunc(ptH.DeactivatePackage), append(authMW, adminManager)...))

	mux.Handle("GET /api/v1/member-pt-packages",
		chain(http.HandlerFunc(ptH.ListAllMemberPackages), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/member-pt-packages",
		chain(http.HandlerFunc(ptH.PurchasePackage), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/member-pt-packages/{id}",
		chain(http.HandlerFunc(ptH.GetMemberPackage), authMW...))
	mux.Handle("GET /api/v1/members/{id}/pt-packages",
		chain(http.HandlerFunc(ptH.ListMemberPackages), authMW...))
	mux.Handle("GET /api/v1/members/{id}/pt-packages/active",
		chain(http.HandlerFunc(ptH.GetActivePackagesForMember), authMW...))

	mux.Handle("GET /api/v1/pt-sessions",
		chain(http.HandlerFunc(ptH.ListAllSessions), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/pt-sessions",
		chain(http.HandlerFunc(ptH.ScheduleSession), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/pt-sessions/{id}",
		chain(http.HandlerFunc(ptH.GetSession), authMW...))
	mux.Handle("POST /api/v1/pt-sessions/{id}/complete",
		chain(http.HandlerFunc(ptH.CompleteSession), authMW...))
	mux.Handle("POST /api/v1/pt-sessions/{id}/cancel",
		chain(http.HandlerFunc(ptH.CancelSession), authMW...))
	mux.Handle("POST /api/v1/pt-sessions/{id}/no-show",
		chain(http.HandlerFunc(ptH.MarkNoShow), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members/{id}/pt-sessions",
		chain(http.HandlerFunc(ptH.ListSessionsByMember), authMW...))
	mux.Handle("GET /api/v1/trainers/{id}/pt-sessions",
		chain(http.HandlerFunc(ptH.ListSessionsByTrainer), authMW...))
	mux.Handle("GET /api/v1/members/{id}/session-credits",
		chain(http.HandlerFunc(ptH.GetSessionCredits), authMW...))

	// ── Exercise Library ──────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/exercises",
		chain(http.HandlerFunc(exerciseH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/exercises",
		chain(http.HandlerFunc(exerciseH.List), authMW...))
	mux.Handle("GET /api/v1/exercises/{id}",
		chain(http.HandlerFunc(exerciseH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/exercises/{id}",
		chain(http.HandlerFunc(exerciseH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/exercises/{id}",
		chain(http.HandlerFunc(exerciseH.Delete), append(authMW, adminManager)...))

	// ── Workout Assignments ───────────────────────────────────────────────────
	mux.Handle("POST /api/v1/workout-assignments",
		chain(http.HandlerFunc(coachingH.CreateWorkoutAssignment), authMW...))
	mux.Handle("GET /api/v1/workout-assignments/{id}",
		chain(http.HandlerFunc(coachingH.GetWorkoutAssignment), authMW...))
	mux.Handle("DELETE /api/v1/workout-assignments/{id}",
		chain(http.HandlerFunc(coachingH.RevokeWorkoutAssignment), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members/{id}/workout-assignments",
		chain(http.HandlerFunc(coachingH.ListWorkoutAssignmentsByMember), authMW...))
	mux.Handle("GET /api/v1/trainers/{id}/workout-assignments",
		chain(http.HandlerFunc(coachingH.ListWorkoutAssignmentsByTrainer), authMW...))

	// ── Diet Assignments ──────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/diet-assignments",
		chain(http.HandlerFunc(coachingH.CreateDietAssignment), authMW...))
	mux.Handle("GET /api/v1/diet-assignments/{id}",
		chain(http.HandlerFunc(coachingH.GetDietAssignment), authMW...))
	mux.Handle("DELETE /api/v1/diet-assignments/{id}",
		chain(http.HandlerFunc(coachingH.RevokeDietAssignment), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members/{id}/diet-assignments",
		chain(http.HandlerFunc(coachingH.ListDietAssignmentsByMember), authMW...))
	mux.Handle("GET /api/v1/trainers/{id}/diet-assignments",
		chain(http.HandlerFunc(coachingH.ListDietAssignmentsByTrainer), authMW...))

	// ── Workout Logs ──────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/workout-logs",
		chain(http.HandlerFunc(coachingH.CreateWorkoutLog), authMW...))
	mux.Handle("GET /api/v1/workout-logs/{id}",
		chain(http.HandlerFunc(coachingH.GetWorkoutLog), authMW...))
	mux.Handle("GET /api/v1/members/{id}/workout-logs",
		chain(http.HandlerFunc(coachingH.ListWorkoutLogsByMember), authMW...))

	// ── Trainer Feedback ──────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/trainer-feedback",
		chain(http.HandlerFunc(coachingH.CreateTrainerFeedback), authMW...))
	mux.Handle("GET /api/v1/trainer-feedback/{id}",
		chain(http.HandlerFunc(coachingH.GetTrainerFeedback), authMW...))
	mux.Handle("GET /api/v1/members/{id}/trainer-feedback",
		chain(http.HandlerFunc(coachingH.ListFeedbackByMember), authMW...))
	mux.Handle("GET /api/v1/trainers/{id}/trainer-feedback",
		chain(http.HandlerFunc(coachingH.ListFeedbackByTrainer), authMW...))

	// ── Body Measurements ─────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/body-measurements",
		chain(http.HandlerFunc(bodyMeasH.Create), authMW...))
	mux.Handle("GET /api/v1/body-measurements/{id}",
		chain(http.HandlerFunc(bodyMeasH.GetByID), authMW...))
	mux.Handle("DELETE /api/v1/body-measurements/{id}",
		chain(http.HandlerFunc(bodyMeasH.Delete), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members/{id}/body-measurements",
		chain(http.HandlerFunc(bodyMeasH.ListByMember), authMW...))

	// ── Progress Photos ───────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/progress-photos",
		chain(http.HandlerFunc(progressPhotoH.Add), authMW...))
	mux.Handle("GET /api/v1/progress-photos/{id}",
		chain(http.HandlerFunc(progressPhotoH.GetByID), authMW...))
	mux.Handle("DELETE /api/v1/progress-photos/{id}",
		chain(http.HandlerFunc(progressPhotoH.Delete), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members/{id}/progress-photos",
		chain(http.HandlerFunc(progressPhotoH.ListByMember), authMW...))

	// ── Retention Workspace ───────────────────────────────────────────────────
	mux.Handle("POST /api/v1/retention/risks",
		chain(http.HandlerFunc(retentionH.RaiseRisk), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/retention/risks",
		chain(http.HandlerFunc(retentionH.ListOpenRisks), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/retention/risks/{id}",
		chain(http.HandlerFunc(retentionH.GetRisk), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/retention/risks/{id}/resolve",
		chain(http.HandlerFunc(retentionH.ResolveRisk), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members/{id}/retention-risks",
		chain(http.HandlerFunc(retentionH.ListRisksByMember), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/retention/actions",
		chain(http.HandlerFunc(retentionH.CreateAction), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/retention/risks/{id}/actions",
		chain(http.HandlerFunc(retentionH.ListActionsByRisk), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/retention/actions/{id}/complete",
		chain(http.HandlerFunc(retentionH.CompleteAction), append(authMW, adminManager)...))

	// ── CRM: Lead Activities, Follow-Ups, Trial Visits ───────────────────────
	mux.Handle("POST /api/v1/enquiries/{id}/activities",
		chain(http.HandlerFunc(crmH.LogActivity), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/enquiries/{id}/activities",
		chain(http.HandlerFunc(crmH.ListActivities), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/enquiries/{id}/follow-ups",
		chain(http.HandlerFunc(crmH.CreateFollowUp), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/enquiries/{id}/follow-ups",
		chain(http.HandlerFunc(crmH.ListFollowUps), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/follow-ups/{id}/complete",
		chain(http.HandlerFunc(crmH.CompleteFollowUp), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/enquiries/{id}/trials",
		chain(http.HandlerFunc(crmH.ScheduleTrial), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/enquiries/{id}/trials",
		chain(http.HandlerFunc(crmH.ListTrials), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/trials/upcoming",
		chain(http.HandlerFunc(crmH.ListUpcomingTrials), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/trials/{id}",
		chain(http.HandlerFunc(crmH.UpdateTrial), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/trials/{id}/status",
		chain(http.HandlerFunc(crmH.UpdateTrialStatus), append(authMW, adminManager)...))

	// ── Waivers ───────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/waivers",
		chain(http.HandlerFunc(waiverH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/waivers/{id}",
		chain(http.HandlerFunc(waiverH.GetByID), authMW...))
	mux.Handle("POST /api/v1/waivers/{id}/sign",
		chain(http.HandlerFunc(waiverH.Sign), authMW...))
	mux.Handle("GET /api/v1/members/{id}/waivers",
		chain(http.HandlerFunc(waiverH.ListByMember), authMW...))

	// ── Referrals & Loyalty ───────────────────────────────────────────────────
	mux.Handle("GET /api/v1/members/{id}/referral-code",
		chain(http.HandlerFunc(loyaltyH.GetOrCreateReferralCode), authMW...))
	mux.Handle("POST /api/v1/referrals",
		chain(http.HandlerFunc(loyaltyH.RegisterReferral), authMW...))
	mux.Handle("POST /api/v1/referrals/{id}/convert",
		chain(http.HandlerFunc(loyaltyH.ConvertReferral), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members/{id}/referrals",
		chain(http.HandlerFunc(loyaltyH.ListReferrals), authMW...))
	mux.Handle("GET /api/v1/members/{id}/loyalty",
		chain(http.HandlerFunc(loyaltyH.GetLoyaltyAccount), authMW...))
	mux.Handle("POST /api/v1/members/{id}/loyalty/redeem",
		chain(http.HandlerFunc(loyaltyH.RedeemPoints), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/members/{id}/loyalty/transactions",
		chain(http.HandlerFunc(loyaltyH.ListTransactions), authMW...))
	mux.Handle("GET /api/v1/loyalty/config",
		chain(http.HandlerFunc(loyaltyH.GetLoyaltyConfig), authMW...))
	mux.Handle("PUT /api/v1/loyalty/config",
		chain(http.HandlerFunc(loyaltyH.UpdateLoyaltyConfig), append(authMW, adminManager)...))

	// ── POS / Inventory ───────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/pos/products",
		chain(http.HandlerFunc(posH.CreateProduct), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/pos/products",
		chain(http.HandlerFunc(posH.ListProducts), authMW...))
	mux.Handle("GET /api/v1/pos/products/{id}",
		chain(http.HandlerFunc(posH.GetProduct), authMW...))
	mux.Handle("PATCH /api/v1/pos/products/{id}",
		chain(http.HandlerFunc(posH.UpdateProduct), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/pos/products/{id}",
		chain(http.HandlerFunc(posH.DeleteProduct), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/pos/products/{id}/stock",
		chain(http.HandlerFunc(posH.AdjustStock), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/pos/products/{id}/stock-movements",
		chain(http.HandlerFunc(posH.ListStockMovements), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/pos/orders",
		chain(http.HandlerFunc(posH.CreateOrder), authMW...))
	mux.Handle("GET /api/v1/pos/orders",
		chain(http.HandlerFunc(posH.ListOrders), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/pos/orders/{id}",
		chain(http.HandlerFunc(posH.GetOrder), authMW...))
	mux.Handle("POST /api/v1/pos/orders/{id}/void",
		chain(http.HandlerFunc(posH.VoidOrder), append(authMW, adminManager)...))

	// ── Staff Commissions ─────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/commission-rules",
		chain(http.HandlerFunc(commissionH.CreateRule), append(authMW, adminOnly)...))
	mux.Handle("GET /api/v1/staff/{id}/commission-rules",
		chain(http.HandlerFunc(commissionH.ListRules), append(authMW, adminManager)...))
	mux.Handle("PATCH /api/v1/commission-rules/{id}",
		chain(http.HandlerFunc(commissionH.UpdateRule), append(authMW, adminOnly)...))
	mux.Handle("DELETE /api/v1/commission-rules/{id}",
		chain(http.HandlerFunc(commissionH.DeleteRule), append(authMW, adminOnly)...))
	mux.Handle("GET /api/v1/staff/{id}/commissions",
		chain(http.HandlerFunc(commissionH.ListEntries), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/commissions/{id}/approve",
		chain(http.HandlerFunc(commissionH.ApproveEntry), append(authMW, adminOnly)...))
	mux.Handle("POST /api/v1/commissions/{id}/cancel",
		chain(http.HandlerFunc(commissionH.CancelEntry), append(authMW, adminOnly)...))
	mux.Handle("POST /api/v1/commission-payouts",
		chain(http.HandlerFunc(commissionH.CreatePayout), append(authMW, adminOnly)...))
	mux.Handle("POST /api/v1/commission-payouts/{id}/mark-paid",
		chain(http.HandlerFunc(commissionH.MarkPayoutPaid), append(authMW, adminOnly)...))
	mux.Handle("GET /api/v1/staff/{id}/commission-payouts",
		chain(http.HandlerFunc(commissionH.ListPayouts), append(authMW, adminManager)...))

	// ── Branches ──────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/branches",
		chain(http.HandlerFunc(branchH.Create), append(authMW, adminOnly)...))
	mux.Handle("GET /api/v1/branches",
		chain(http.HandlerFunc(branchH.List), authMW...))
	mux.Handle("GET /api/v1/branches/{id}",
		chain(http.HandlerFunc(branchH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/branches/{id}",
		chain(http.HandlerFunc(branchH.Update), append(authMW, adminOnly)...))
	mux.Handle("DELETE /api/v1/branches/{id}",
		chain(http.HandlerFunc(branchH.Delete), append(authMW, adminOnly)...))

	// ── Locker Management ─────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/lockers",
		chain(http.HandlerFunc(lockerH.CreateLocker), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/lockers",
		chain(http.HandlerFunc(lockerH.ListLockers), authMW...))
	mux.Handle("GET /api/v1/lockers/{id}",
		chain(http.HandlerFunc(lockerH.GetLocker), authMW...))
	mux.Handle("PATCH /api/v1/lockers/{id}",
		chain(http.HandlerFunc(lockerH.UpdateLocker), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/lockers/{id}",
		chain(http.HandlerFunc(lockerH.DeleteLocker), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/locker-allotments",
		chain(http.HandlerFunc(lockerH.AllocateLocker), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/locker-allotments",
		chain(http.HandlerFunc(lockerH.ListActiveAllotments), authMW...))
	mux.Handle("GET /api/v1/members/{id}/locker-allotments",
		chain(http.HandlerFunc(lockerH.ListAllotmentsByMember), authMW...))
	mux.Handle("POST /api/v1/locker-allotments/{id}/mark-paid",
		chain(http.HandlerFunc(lockerH.MarkFeePaid), append(authMW, adminManager)...))
	mux.Handle("POST /api/v1/locker-allotments/{id}/release",
		chain(http.HandlerFunc(lockerH.ReleaseLocker), append(authMW, adminManager)...))

	// ── Notifications ─────────────────────────────────────────────────────────
	mux.Handle("GET /api/v1/notifications",
		chain(http.HandlerFunc(notifH.List), authMW...))
	mux.Handle("GET /api/v1/notifications/unread-count",
		chain(http.HandlerFunc(notifH.UnreadCount), authMW...))
	mux.Handle("POST /api/v1/notifications/read-all",
		chain(http.HandlerFunc(notifH.MarkAllRead), authMW...))
	mux.Handle("PATCH /api/v1/notifications/{id}/read",
		chain(http.HandlerFunc(notifH.MarkRead), authMW...))
	mux.Handle("GET /api/v1/notifications/preferences",
		chain(http.HandlerFunc(notifH.GetPreferences), authMW...))
	mux.Handle("PATCH /api/v1/notifications/preferences",
		chain(http.HandlerFunc(notifH.UpdatePreferences), authMW...))

	// ── Staff ─────────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/staff",
		chain(http.HandlerFunc(staffH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/staff",
		chain(http.HandlerFunc(staffH.List), authMW...))
	mux.Handle("GET /api/v1/staff/{id}",
		chain(http.HandlerFunc(staffH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/staff/{id}",
		chain(http.HandlerFunc(staffH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/staff/{id}",
		chain(http.HandlerFunc(staffH.Delete), append(authMW, adminOnly)...))

	// ── Staff Attendance ──────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/staff/{id}/attendance",
		chain(http.HandlerFunc(staffAttendanceH.MarkAttendance), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/staff/{id}/attendance",
		chain(http.HandlerFunc(staffAttendanceH.ListByStaff), authMW...))
	mux.Handle("GET /api/v1/staff/attendance",
		chain(http.HandlerFunc(staffAttendanceH.ListByDate), authMW...))
	mux.Handle("GET /api/v1/staff/attendance/monthly",
		chain(http.HandlerFunc(staffAttendanceH.ListByMonth), authMW...))
	mux.Handle("POST /api/v1/staff/{id}/salary-slip",
		chain(http.HandlerFunc(staffAttendanceH.GenerateSalarySlip), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/staff/{id}/salary-slip",
		chain(http.HandlerFunc(staffAttendanceH.GetSalarySlip), authMW...))
	mux.Handle("GET /api/v1/staff/salary-slips",
		chain(http.HandlerFunc(staffAttendanceH.ListSalarySlips), authMW...))
	mux.Handle("PATCH /api/v1/staff/salary-slips/{id}/status",
		chain(http.HandlerFunc(staffAttendanceH.UpdateSlipStatus), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/staff/{id}/salary-slips/history",
		chain(http.HandlerFunc(staffAttendanceH.ListSlipsByStaff), authMW...))

	// ── Vendors ───────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/vendors",
		chain(http.HandlerFunc(vendorH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/vendors",
		chain(http.HandlerFunc(vendorH.List), authMW...))
	mux.Handle("GET /api/v1/vendors/{id}",
		chain(http.HandlerFunc(vendorH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/vendors/{id}",
		chain(http.HandlerFunc(vendorH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/vendors/{id}",
		chain(http.HandlerFunc(vendorH.Delete), append(authMW, adminOnly)...))

	// ── Equipment ─────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/equipment",
		chain(http.HandlerFunc(equipmentH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/equipment",
		chain(http.HandlerFunc(equipmentH.List), authMW...))
	mux.Handle("GET /api/v1/equipment/{id}",
		chain(http.HandlerFunc(equipmentH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/equipment/{id}",
		chain(http.HandlerFunc(equipmentH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/equipment/{id}",
		chain(http.HandlerFunc(equipmentH.Delete), append(authMW, adminOnly)...))

	// ── Purchases ─────────────────────────────────────────────────────────────
	mux.Handle("POST /api/v1/purchases",
		chain(http.HandlerFunc(purchaseH.Create), append(authMW, adminManager)...))
	mux.Handle("GET /api/v1/purchases",
		chain(http.HandlerFunc(purchaseH.List), authMW...))
	mux.Handle("GET /api/v1/purchases/{id}",
		chain(http.HandlerFunc(purchaseH.GetByID), authMW...))
	mux.Handle("PATCH /api/v1/purchases/{id}",
		chain(http.HandlerFunc(purchaseH.Update), append(authMW, adminManager)...))
	mux.Handle("DELETE /api/v1/purchases/{id}",
		chain(http.HandlerFunc(purchaseH.Delete), append(authMW, adminOnly)...))

	// Serve the Flutter web app for all non-API routes.
	// Files live in ./web/ relative to the working directory (gym-backend/).
	webFS := http.FileServer(http.Dir("./web"))
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// API routes are already registered above and won't reach here.
		// For the Flutter SPA, serve index.html for any path not found as a file.
		if _, err := http.Dir("./web").Open(r.URL.Path); err != nil {
			http.ServeFile(w, r, "./web/index.html")
			return
		}
		webFS.ServeHTTP(w, r)
	}))

	// Wrap the entire mux with CORS so OPTIONS preflights are handled
	// before Go's mux can return 405 for unregistered method+path combos.
	return middleware.CORS(cfg.CORS.AllowedOrigins)(mux)
}
