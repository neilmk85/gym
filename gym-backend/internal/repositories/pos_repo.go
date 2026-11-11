package repositories

import (
	"gorm.io/gorm"

	"gym-backend/internal/models"
)

// ─── Product ──────────────────────────────────────────────────────────────────

type ProductRepository interface {
	Create(p *models.Product) error
	FindByID(id uint) (*models.Product, error)
	List(page, limit int, search, category string) ([]*models.Product, int64, error)
	Update(p *models.Product) error
	Delete(id uint) error
	AdjustStock(id uint, delta int) error
}

type productRepository struct{ db *gorm.DB }

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) Create(p *models.Product) error {
	return r.db.Create(p).Error
}

func (r *productRepository) FindByID(id uint) (*models.Product, error) {
	var p models.Product
	err := r.db.First(&p, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &p, err
}

func (r *productRepository) List(page, limit int, search, category string) ([]*models.Product, int64, error) {
	var list []*models.Product
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.Product{}).Where("is_active = true")
	if search != "" {
		q = q.Where("name LIKE ? OR sku LIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if category != "" {
		q = q.Where("category = ?", category)
	}
	q.Count(&total)
	err := q.Order("name asc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *productRepository) Update(p *models.Product) error {
	return r.db.Save(p).Error
}

func (r *productRepository) Delete(id uint) error {
	return r.db.Model(&models.Product{}).Where("id = ?", id).Update("is_active", false).Error
}

func (r *productRepository) AdjustStock(id uint, delta int) error {
	return r.db.Model(&models.Product{}).Where("id = ?", id).
		UpdateColumn("stock_qty", gorm.Expr("stock_qty + ?", delta)).Error
}

// ─── POS Order ────────────────────────────────────────────────────────────────

type POSOrderRepository interface {
	Create(o *models.POSOrder) error
	FindByID(id uint) (*models.POSOrder, error)
	List(page, limit int) ([]*models.POSOrder, int64, error)
	ListByMember(memberID uint, page, limit int) ([]*models.POSOrder, int64, error)
	Update(o *models.POSOrder) error
}

type posOrderRepository struct{ db *gorm.DB }

func NewPOSOrderRepository(db *gorm.DB) POSOrderRepository {
	return &posOrderRepository{db: db}
}

func (r *posOrderRepository) Create(o *models.POSOrder) error {
	return r.db.Create(o).Error
}

func (r *posOrderRepository) FindByID(id uint) (*models.POSOrder, error) {
	var o models.POSOrder
	err := r.db.Preload("Items.Product").First(&o, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	return &o, err
}

func (r *posOrderRepository) List(page, limit int) ([]*models.POSOrder, int64, error) {
	var list []*models.POSOrder
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.POSOrder{})
	q.Count(&total)
	err := q.Preload("Items.Product").Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *posOrderRepository) ListByMember(memberID uint, page, limit int) ([]*models.POSOrder, int64, error) {
	var list []*models.POSOrder
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.POSOrder{}).Where("member_id = ?", memberID)
	q.Count(&total)
	err := q.Preload("Items.Product").Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}

func (r *posOrderRepository) Update(o *models.POSOrder) error {
	return r.db.Save(o).Error
}

// ─── Stock Movement ───────────────────────────────────────────────────────────

type StockMovementRepository interface {
	Create(m *models.StockMovement) error
	ListByProduct(productID uint, page, limit int) ([]*models.StockMovement, int64, error)
}

type stockMovementRepository struct{ db *gorm.DB }

func NewStockMovementRepository(db *gorm.DB) StockMovementRepository {
	return &stockMovementRepository{db: db}
}

func (r *stockMovementRepository) Create(m *models.StockMovement) error {
	return r.db.Create(m).Error
}

func (r *stockMovementRepository) ListByProduct(productID uint, page, limit int) ([]*models.StockMovement, int64, error) {
	var list []*models.StockMovement
	var total int64
	offset := (page - 1) * limit
	q := r.db.Model(&models.StockMovement{}).Where("product_id = ?", productID)
	q.Count(&total)
	err := q.Order("created_at desc").Offset(offset).Limit(limit).Find(&list).Error
	return list, total, err
}
