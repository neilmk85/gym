package repositories

import (
	"errors"

	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type FoodRepository interface {
	Create(f *models.Food) error
	FindByID(id uint) (*models.Food, error)
	List(search, category string, activeOnly bool) ([]*models.Food, int64, error)
	Update(f *models.Food) error
	Delete(id uint) error
	CountAll() (int64, error)
	BulkCreate(foods []*models.Food) (imported int, skipped int, err error)
}

type foodRepository struct {
	db *gorm.DB
}

func NewFoodRepository(db *gorm.DB) FoodRepository {
	return &foodRepository{db: db}
}

func (r *foodRepository) Create(f *models.Food) error {
	return r.db.Create(f).Error
}

func (r *foodRepository) FindByID(id uint) (*models.Food, error) {
	var f models.Food
	err := r.db.Where("id = ?", id).First(&f).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &f, nil
}

func (r *foodRepository) List(search, category string, activeOnly bool) ([]*models.Food, int64, error) {
	query := r.db.Model(&models.Food{})

	if search != "" {
		query = query.Where("name LIKE ?", "%"+search+"%")
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if activeOnly {
		query = query.Where("is_active = true")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var foods []*models.Food
	if err := query.Order("category ASC, name ASC").Find(&foods).Error; err != nil {
		return nil, 0, err
	}
	return foods, total, nil
}

func (r *foodRepository) Update(f *models.Food) error {
	return r.db.Save(f).Error
}

func (r *foodRepository) Delete(id uint) error {
	return r.db.Delete(&models.Food{}, id).Error
}

func (r *foodRepository) CountAll() (int64, error) {
	var count int64
	err := r.db.Model(&models.Food{}).Count(&count).Error
	return count, err
}

func (r *foodRepository) BulkCreate(foods []*models.Food) (imported int, skipped int, err error) {
	if len(foods) == 0 {
		return 0, 0, nil
	}

	// Collect all names to check for duplicates in one query.
	names := make([]string, len(foods))
	for i, f := range foods {
		names[i] = f.Name
	}

	var existing []models.Food
	if err = r.db.Where("name IN ?", names).Find(&existing).Error; err != nil {
		return 0, 0, err
	}

	existingSet := make(map[string]bool, len(existing))
	for _, e := range existing {
		existingSet[e.Name] = true
	}

	var toCreate []*models.Food
	for _, f := range foods {
		if existingSet[f.Name] {
			skipped++
		} else {
			toCreate = append(toCreate, f)
		}
	}

	if len(toCreate) > 0 {
		if err = r.db.CreateInBatches(toCreate, 50).Error; err != nil {
			return 0, skipped, err
		}
		imported = len(toCreate)
	}

	return imported, skipped, nil
}
