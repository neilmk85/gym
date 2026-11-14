package database

import (
	"fmt"
	"log/slog"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"gym-backend/internal/config"
	"gym-backend/internal/models"
)

// Connect opens a MySQL connection and runs AutoMigrate.
func Connect(cfg *config.DatabaseConfig) (*gorm.DB, error) {
	// Ensure the database exists.
	if err := createDatabaseIfNotExists(cfg); err != nil {
		return nil, fmt.Errorf("create database: %w", err)
	}

	db, err := gorm.Open(mysql.Open(cfg.DSN()), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	slog.Info("database connected", "host", cfg.Host, "name", cfg.Name)
	return db, nil
}

// migrate runs GORM AutoMigrate for all models.
func migrate(db *gorm.DB) error {
	// Disable FK checks so circular references (Member ↔ Subscription) don't
	// block table creation; re-enabled automatically after the session closes.
	db.Exec("SET FOREIGN_KEY_CHECKS=0")
	defer db.Exec("SET FOREIGN_KEY_CHECKS=1")
	return db.AutoMigrate(
		&models.Facility{},
		&models.User{},
		&models.RefreshToken{},
		&models.OTPCode{},
		&models.Member{},
		&models.Plan{},
		&models.PromoCode{},
		&models.PromoCodeUsage{},
		&models.Subscription{},
		&models.AuditLog{},
		&models.Payment{},
		&models.Attendance{},
		&models.TrainerProfile{},
		&models.TrainerSchedule{},
		&models.Class{},
		&models.ClassBooking{},
		&models.Notification{},
		&models.NotificationPreference{},
		&models.DietTemplate{},
		&models.TrainingTemplate{},
		&models.DayPass{},
		&models.Food{},
		&models.ExpenseCategory{},
		&models.Expense{},
		&models.Enquiry{},
		&models.SubscriptionFreeze{},
		&models.UpgradeQuote{},
		&models.TaxProfile{},
		&models.TaxRate{},
		&models.Invoice{},
		&models.InvoiceLine{},
		&models.Receipt{},
		&models.CreditNote{},
		&models.EntitlementLedger{},
		// Month 2: PT packages
		&models.PTPackage{},
		&models.MemberPTPackage{},
		&models.PTSession{},
		&models.SessionCreditLedger{},
		// Month 3: Coaching loop
		&models.Exercise{},
		&models.WorkoutAssignment{},
		&models.DietAssignment{},
		&models.WorkoutLog{},
		&models.TrainerFeedback{},
		// Month 4: Retention workspace
		&models.MemberBodyMeasurement{},
		&models.MemberProgressPhoto{},
		&models.RetentionRisk{},
		&models.RetentionAction{},
		// Month 5: CRM depth + waivers
		&models.LeadActivity{},
		&models.LeadFollowUp{},
		&models.TrialVisit{},
		&models.MemberWaiver{},
		// Month 6: Referrals/loyalty, POS/inventory, commissions, branches
		&models.ReferralCode{},
		&models.Referral{},
		&models.LoyaltyAccount{},
		&models.LoyaltyTransaction{},
		&models.LoyaltyConfig{},
		&models.Product{},
		&models.POSOrder{},
		&models.POSOrderItem{},
		&models.StockMovement{},
		&models.CommissionRule{},
		&models.CommissionEntry{},
		&models.CommissionPayout{},
		&models.Branch{},
		// Locker management
		&models.Locker{},
		&models.LockerAllotment{},
		// Operations: staff, vendors, equipment, purchases
		&models.Staff{},
		&models.StaffAttendance{},
		&models.SalarySlip{},
		&models.Vendor{},
		&models.Equipment{},
		&models.Purchase{},
		&models.PurchaseItem{},
		&models.SubscriptionTransfer{},
	)
}

// createDatabaseIfNotExists connects without a DB name and creates it.
func createDatabaseIfNotExists(cfg *config.DatabaseConfig) error {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=utf8mb4&parseTime=True&loc=Local",
		cfg.User, cfg.Password, cfg.Host, cfg.Port)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return err
	}

	sql := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", cfg.Name)
	if err := db.Exec(sql).Error; err != nil {
		return err
	}

	sqlDB, _ := db.DB()
	return sqlDB.Close()
}
