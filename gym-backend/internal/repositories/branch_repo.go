package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

type BranchRepository interface {
	Create(b *models.Branch) error
	FindByID(id uint) (*models.Branch, error)
	List() ([]*models.Branch, error)
	Update(b *models.Branch) error
	Delete(id uint) error
}

type branchRepository struct{ db *gorm.DB }

func NewBranchRepository(db *gorm.DB) BranchRepository {
	return &branchRepository{db: db}
}

func (r *branchRepository) Create(b *models.Branch) error {
	return r.db.Create(b).Error
}

func (r *branchRepository) FindByID(id uint) (*models.Branch, error) {
	var b models.Branch
	err := r.db.First(&b, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &b, err
}

func (r *branchRepository) List() ([]*models.Branch, error) {
	var list []*models.Branch
	err := r.db.Where("is_active = true").Order("name asc").Find(&list).Error
	return list, err
}

func (r *branchRepository) Update(b *models.Branch) error {
	return r.db.Save(b).Error
}

func (r *branchRepository) Delete(id uint) error {
	return r.db.Model(&models.Branch{}).Where("id = ?", id).Update("is_active", false).Error
}
