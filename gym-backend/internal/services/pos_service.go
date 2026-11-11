package services

import (
	"log/slog"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
)

// ─── POS Service ──────────────────────────────────────────────────────────────

type POSService interface {
	// Products
	CreateProduct(req CreateProductRequest) (*models.Product, error)
	GetProduct(id uint) (*models.Product, error)
	ListProducts(page, limit int, search, category string) ([]*models.Product, int64, error)
	UpdateProduct(id uint, req UpdateProductRequest) (*models.Product, error)
	DeleteProduct(id uint) error
	AdjustStock(id uint, delta int, notes string, createdByID uint) error

	// Orders
	CreateOrder(req CreatePOSOrderRequest, cashierID uint) (*models.POSOrder, error)
	GetOrder(id uint) (*models.POSOrder, error)
	ListOrders(page, limit int) ([]*models.POSOrder, int64, error)
	VoidOrder(id uint) error

	// Stock movements
	ListStockMovements(productID uint, page, limit int) ([]*models.StockMovement, int64, error)
}

type CreateProductRequest struct {
	Name        string `json:"name"`
	SKU         string `json:"sku"`
	Category    string `json:"category"`
	Description string `json:"description"`
	MrpPaise    int64  `json:"mrp_paise"`
	PricePaise  int64  `json:"price_paise"`
	CostPaise   int64  `json:"cost_paise"`
	TaxRateID   *uint  `json:"tax_rate_id"`
	StockQty    int    `json:"stock_qty"`
	LowStockAt  int    `json:"low_stock_at"`
	ImageURL    string `json:"image_url"`
}

type UpdateProductRequest struct {
	Name        *string `json:"name"`
	Category    *string `json:"category"`
	Description *string `json:"description"`
	PricePaise  *int64  `json:"price_paise"`
	CostPaise   *int64  `json:"cost_paise"`
	TaxRateID   *uint   `json:"tax_rate_id"`
	LowStockAt  *int    `json:"low_stock_at"`
	ImageURL    *string `json:"image_url"`
}

type POSOrderItemInput struct {
	ProductID uint  `json:"product_id"`
	Qty       int   `json:"qty"`
}

type CreatePOSOrderRequest struct {
	MemberID      *uint               `json:"member_id"`
	Items         []POSOrderItemInput `json:"items"`
	PaymentMode   string              `json:"payment_mode"`
	DiscountPaise int64               `json:"discount_paise"`
	Notes         string              `json:"notes"`
}

type posService struct {
	productRepo  repositories.ProductRepository
	orderRepo    repositories.POSOrderRepository
	stockRepo    repositories.StockMovementRepository
	logger       *slog.Logger
}

func NewPOSService(
	productRepo repositories.ProductRepository,
	orderRepo repositories.POSOrderRepository,
	stockRepo repositories.StockMovementRepository,
	logger *slog.Logger,
) POSService {
	return &posService{
		productRepo: productRepo,
		orderRepo:   orderRepo,
		stockRepo:   stockRepo,
		logger:      logger,
	}
}

func (s *posService) CreateProduct(req CreateProductRequest) (*models.Product, error) {
	if req.Name == "" {
		return nil, apperrors.ErrValidation("product name is required")
	}
	if req.PricePaise <= 0 {
		return nil, apperrors.ErrValidation("price_paise must be positive")
	}
	lowStock := req.LowStockAt
	if lowStock == 0 {
		lowStock = 5
	}
	p := &models.Product{
		Name:        req.Name,
		SKU:         req.SKU,
		Category:    req.Category,
		Description: req.Description,
		MrpPaise:    req.MrpPaise,
		PricePaise:  req.PricePaise,
		CostPaise:   req.CostPaise,
		TaxRateID:   req.TaxRateID,
		StockQty:    req.StockQty,
		LowStockAt:  lowStock,
		ImageURL:    req.ImageURL,
		IsActive:    true,
	}
	if err := s.productRepo.Create(p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *posService) GetProduct(id uint) (*models.Product, error) {
	p, err := s.productRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, apperrors.New(http.StatusNotFound, "POS_001", "product not found", "")
	}
	return p, nil
}

func (s *posService) ListProducts(page, limit int, search, category string) ([]*models.Product, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.productRepo.List(page, limit, search, category)
}

func (s *posService) UpdateProduct(id uint, req UpdateProductRequest) (*models.Product, error) {
	p, err := s.productRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, apperrors.New(http.StatusNotFound, "POS_001", "product not found", "")
	}
	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.Category != nil {
		p.Category = *req.Category
	}
	if req.Description != nil {
		p.Description = *req.Description
	}
	if req.PricePaise != nil {
		p.PricePaise = *req.PricePaise
	}
	if req.CostPaise != nil {
		p.CostPaise = *req.CostPaise
	}
	if req.TaxRateID != nil {
		p.TaxRateID = req.TaxRateID
	}
	if req.LowStockAt != nil {
		p.LowStockAt = *req.LowStockAt
	}
	if req.ImageURL != nil {
		p.ImageURL = *req.ImageURL
	}
	if err := s.productRepo.Update(p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *posService) DeleteProduct(id uint) error {
	return s.productRepo.Delete(id)
}

func (s *posService) AdjustStock(id uint, delta int, notes string, createdByID uint) error {
	p, err := s.productRepo.FindByID(id)
	if err != nil {
		return err
	}
	if p == nil {
		return apperrors.New(http.StatusNotFound, "POS_001", "product not found", "")
	}
	qtyBefore := p.StockQty
	if err := s.productRepo.AdjustStock(id, delta); err != nil {
		return err
	}
	moveType := models.StockMovementTypePurchase
	if delta < 0 {
		moveType = models.StockMovementTypeAdjustment
	}
	m := &models.StockMovement{
		ProductID:    id,
		MovementType: moveType,
		Qty:          delta,
		QtyBefore:    qtyBefore,
		QtyAfter:     qtyBefore + delta,
		Notes:        notes,
		CreatedByID:  createdByID,
	}
	return s.stockRepo.Create(m)
}

func (s *posService) CreateOrder(req CreatePOSOrderRequest, cashierID uint) (*models.POSOrder, error) {
	if len(req.Items) == 0 {
		return nil, apperrors.ErrValidation("order must have at least one item")
	}
	payMode := req.PaymentMode
	if payMode == "" {
		payMode = "cash"
	}

	var items []models.POSOrderItem
	var totalPaise int64
	for _, itemReq := range req.Items {
		if itemReq.Qty <= 0 {
			return nil, apperrors.ErrValidation("item qty must be positive")
		}
		p, err := s.productRepo.FindByID(itemReq.ProductID)
		if err != nil {
			return nil, err
		}
		if p == nil {
			return nil, apperrors.New(http.StatusNotFound, "POS_001", "product not found", "")
		}
		if p.StockQty < itemReq.Qty {
			return nil, apperrors.ErrValidation("insufficient stock for " + p.Name)
		}
		lineTotal := p.PricePaise * int64(itemReq.Qty)
		items = append(items, models.POSOrderItem{
			ProductID:  p.ID,
			Qty:        itemReq.Qty,
			UnitPaise:  p.PricePaise,
			TotalPaise: lineTotal,
		})
		totalPaise += lineTotal
	}

	discount := req.DiscountPaise
	if discount < 0 {
		discount = 0
	}
	if discount > totalPaise {
		discount = totalPaise
	}
	order := &models.POSOrder{
		MemberID:      req.MemberID,
		CashierID:     cashierID,
		Status:        models.POSOrderStatusCompleted,
		TotalPaise:    totalPaise,
		DiscountPaise: discount,
		GrandPaise:    totalPaise - discount,
		PaymentMode:   payMode,
		Notes:         req.Notes,
		Items:         items,
	}
	if err := s.orderRepo.Create(order); err != nil {
		return nil, err
	}

	// Deduct stock and record movements
	for _, item := range order.Items {
		if err := s.productRepo.AdjustStock(item.ProductID, -item.Qty); err != nil {
			s.logger.Error("stock adjust failed", "product_id", item.ProductID, "err", err)
		}
		p, _ := s.productRepo.FindByID(item.ProductID)
		qtyBefore := 0
		if p != nil {
			qtyBefore = p.StockQty + item.Qty // restored value
		}
		mv := &models.StockMovement{
			ProductID:    item.ProductID,
			MovementType: models.StockMovementTypeSale,
			Qty:          -item.Qty,
			QtyBefore:    qtyBefore,
			QtyAfter:     qtyBefore - item.Qty,
			RefModel:     "POSOrder",
			RefID:        order.ID,
			CreatedByID:  cashierID,
		}
		s.stockRepo.Create(mv)
	}

	return order, nil
}

func (s *posService) GetOrder(id uint) (*models.POSOrder, error) {
	o, err := s.orderRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	if o == nil {
		return nil, apperrors.New(http.StatusNotFound, "POS_002", "order not found", "")
	}
	return o, nil
}

func (s *posService) ListOrders(page, limit int) ([]*models.POSOrder, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.orderRepo.List(page, limit)
}

func (s *posService) VoidOrder(id uint) error {
	o, err := s.orderRepo.FindByID(id)
	if err != nil {
		return err
	}
	if o == nil {
		return apperrors.New(http.StatusNotFound, "POS_002", "order not found", "")
	}
	if o.Status == models.POSOrderStatusVoided {
		return apperrors.New(http.StatusConflict, "POS_003", "order already voided", "")
	}
	o.Status = models.POSOrderStatusVoided
	return s.orderRepo.Update(o)
}

func (s *posService) ListStockMovements(productID uint, page, limit int) ([]*models.StockMovement, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return s.stockRepo.ListByProduct(productID, page, limit)
}
