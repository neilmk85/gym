package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

// ─── Expense Category Repository ──────────────────────────────────────────────

type ExpenseCategoryRepository interface {
	Create(c *models.ExpenseCategory) error
	FindByID(id uint) (*models.ExpenseCategory, error)
	List(activeOnly bool) ([]*models.ExpenseCategory, error)
	Update(c *models.ExpenseCategory) error
	Delete(id uint) error
}

type expenseCategoryRepository struct{ db *gorm.DB }

func NewExpenseCategoryRepository(db *gorm.DB) ExpenseCategoryRepository {
	return &expenseCategoryRepository{db: db}
}

func (r *expenseCategoryRepository) Create(c *models.ExpenseCategory) error {
	return r.db.Create(c).Error
}

func (r *expenseCategoryRepository) FindByID(id uint) (*models.ExpenseCategory, error) {
	var c models.ExpenseCategory
	err := r.db.Where("id = ?", id).First(&c).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func (r *expenseCategoryRepository) List(activeOnly bool) ([]*models.ExpenseCategory, error) {
	query := r.db.Model(&models.ExpenseCategory{})
	if activeOnly {
		query = query.Where("is_active = ?", true)
	}
	var cats []*models.ExpenseCategory
	if err := query.Order("name ASC").Find(&cats).Error; err != nil {
		return nil, err
	}
	return cats, nil
}

func (r *expenseCategoryRepository) Update(c *models.ExpenseCategory) error {
	return r.db.Save(c).Error
}

func (r *expenseCategoryRepository) Delete(id uint) error {
	return r.db.Delete(&models.ExpenseCategory{}, id).Error
}

// ─── Expense Repository ───────────────────────────────────────────────────────

type ExpenseRepository interface {
	Create(e *models.Expense) error
	FindByID(id uint) (*models.Expense, error)
	List(req utils.PageRequest, facilityID *uint, categoryID *uint, status string, dateFrom string, dateTo string) ([]*models.Expense, int64, error)
	Update(e *models.Expense) error
	Delete(id uint) error
	SumByFacility(facilityID uint, dateFrom string, dateTo string) (float64, error)
}

type expenseRepository struct{ db *gorm.DB }

func NewExpenseRepository(db *gorm.DB) ExpenseRepository {
	return &expenseRepository{db: db}
}

func (r *expenseRepository) Create(e *models.Expense) error {
	return r.db.Create(e).Error
}

func (r *expenseRepository) FindByID(id uint) (*models.Expense, error) {
	var e models.Expense
	err := r.db.Preload("Category").Preload("Facility").Where("id = ?", id).First(&e).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *expenseRepository) List(req utils.PageRequest, facilityID *uint, categoryID *uint, status string, dateFrom string, dateTo string) ([]*models.Expense, int64, error) {
	query := r.db.Model(&models.Expense{}).Preload("Category")

	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if categoryID != nil {
		query = query.Where("category_id = ?", *categoryID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if dateFrom != "" {
		query = query.Where("expense_date >= ?", dateFrom)
	}
	if dateTo != "" {
		query = query.Where("expense_date <= ?", dateTo)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var expenses []*models.Expense
	if err := query.Order("expense_date DESC, created_at DESC").
		Offset((req.Page - 1) * req.PerPage).Limit(req.PerPage).
		Find(&expenses).Error; err != nil {
		return nil, 0, err
	}
	return expenses, total, nil
}

func (r *expenseRepository) Update(e *models.Expense) error {
	return r.db.Save(e).Error
}

func (r *expenseRepository) Delete(id uint) error {
	return r.db.Delete(&models.Expense{}, id).Error
}

func (r *expenseRepository) SumByFacility(facilityID uint, dateFrom string, dateTo string) (float64, error) {
	query := r.db.Model(&models.Expense{}).Where("facility_id = ? AND status != ?", facilityID, models.ExpenseStatusRejected)
	if dateFrom != "" {
		query = query.Where("expense_date >= ?", dateFrom)
	}
	if dateTo != "" {
		query = query.Where("expense_date <= ?", dateTo)
	}
	var sum float64
	if err := query.Select("COALESCE(SUM(amount), 0)").Scan(&sum).Error; err != nil {
		return 0, err
	}
	return sum, nil
}
