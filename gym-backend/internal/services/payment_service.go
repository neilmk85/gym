package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type RecordPaymentRequest struct {
	MemberID        uint    `json:"member_id"`
	SubscriptionID  *uint   `json:"subscription_id"`
	Amount          float64 `json:"amount"`
	Currency        string  `json:"currency"`
	PaymentMethod   string  `json:"payment_method"`
	TransactionID   string  `json:"transaction_id"`
	ReferenceNumber string  `json:"reference_number"`
	Notes           string  `json:"notes"`
	PaidAt          string  `json:"paid_at"` // RFC3339 or YYYY-MM-DD; defaults to now
}

type RefundPaymentRequest struct {
	Amount float64 `json:"amount"` // 0 = full refund
	Reason string  `json:"reason"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type PaymentService interface {
	Record(req RecordPaymentRequest, actorID uint, ipAddress string) (*models.Payment, error)
	GetByID(id uint) (*models.Payment, error)
	ListByMember(memberID uint, req utils.PageRequest) ([]*models.Payment, int64, error)
	List(req utils.PageRequest) ([]*models.Payment, int64, error)
	Refund(paymentID uint, req RefundPaymentRequest, actorID uint, ipAddress string) (*models.Payment, error)
}

type paymentService struct {
	paymentRepo repositories.PaymentRepository
	memberRepo  repositories.MemberRepository
	subRepo     repositories.SubscriptionRepository
	auditRepo   repositories.AuditLogRepository
	notifSvc    NotificationService
	logger      *slog.Logger
}

func NewPaymentService(
	paymentRepo repositories.PaymentRepository,
	memberRepo repositories.MemberRepository,
	subRepo repositories.SubscriptionRepository,
	auditRepo repositories.AuditLogRepository,
	notifSvc NotificationService,
	logger *slog.Logger,
) PaymentService {
	return &paymentService{
		paymentRepo: paymentRepo,
		memberRepo:  memberRepo,
		subRepo:     subRepo,
		auditRepo:   auditRepo,
		notifSvc:    notifSvc,
		logger:      logger,
	}
}

func (s *paymentService) Record(req RecordPaymentRequest, actorID uint, ipAddress string) (*models.Payment, error) {
	if req.MemberID == 0 {
		return nil, apperrors.ErrValidation("member_id is required")
	}
	if req.Amount <= 0 {
		return nil, apperrors.ErrValidation("amount must be greater than zero")
	}
	if !isValidPaymentMethod(req.PaymentMethod) {
		return nil, apperrors.ErrValidation("invalid payment_method; accepted: cash, upi, card, bank_transfer, razorpay, other")
	}

	// Validate member exists.
	member, err := s.memberRepo.FindByID(req.MemberID)
	if err != nil || member == nil {
		return nil, apperrors.ErrMemberNotFound
	}

	// Optionally validate subscription.
	if req.SubscriptionID != nil {
		sub, err := s.subRepo.FindByID(*req.SubscriptionID)
		if err != nil || sub == nil {
			return nil, apperrors.New(http.StatusNotFound, "SUB_002", "Subscription not found", "")
		}
		if sub.MemberID != req.MemberID {
			return nil, apperrors.ErrValidation("subscription does not belong to this member")
		}
	}

	paidAt := time.Now()
	if req.PaidAt != "" {
		// Try RFC3339 first, then date-only.
		if t, err := time.Parse(time.RFC3339, req.PaidAt); err == nil {
			paidAt = t
		} else if t, err := time.Parse("2006-01-02", req.PaidAt); err == nil {
			paidAt = t
		} else {
			return nil, apperrors.ErrValidation("invalid paid_at format; use RFC3339 or YYYY-MM-DD")
		}
	}

	currency := req.Currency
	if currency == "" {
		currency = "INR"
	}

	payment := &models.Payment{
		MemberID:        req.MemberID,
		SubscriptionID:  req.SubscriptionID,
		Amount:          req.Amount,
		Currency:        currency,
		PaymentMethod:   req.PaymentMethod,
		Status:          models.PaymentStatusCompleted,
		TransactionID:   req.TransactionID,
		ReferenceNumber: req.ReferenceNumber,
		Notes:           req.Notes,
		PaidAt:          paidAt,
		RecordedByID:    actorID,
	}

	if err := s.paymentRepo.Create(payment); err != nil {
		s.logger.Error("record payment failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	// Update last_payment_id on the subscription.
	if req.SubscriptionID != nil {
		sub, _ := s.subRepo.FindByID(*req.SubscriptionID)
		if sub != nil {
			sub.LastPaymentID = &payment.ID
			_ = s.subRepo.Update(sub)
		}
	}

	s.auditPayment(actorID, "payment.record", payment.ID, nil,
		models.JSONMap{"amount": req.Amount, "method": req.PaymentMethod}, ipAddress)

	// Notify member of payment received.
	go s.notifSvc.Dispatch(PaymentReceivedEvent(member.User.ID, payment.ID, payment.Amount, payment.Currency))

	// Reload with associations.
	created, err := s.paymentRepo.FindByID(payment.ID)
	if err != nil || created == nil {
		return payment, nil
	}
	return created, nil
}

func (s *paymentService) GetByID(id uint) (*models.Payment, error) {
	p, err := s.paymentRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if p == nil {
		return nil, apperrors.New(http.StatusNotFound, "PAY_001", "Payment not found", "")
	}
	return p, nil
}

func (s *paymentService) ListByMember(memberID uint, req utils.PageRequest) ([]*models.Payment, int64, error) {
	return s.paymentRepo.ListByMember(memberID, req)
}

func (s *paymentService) List(req utils.PageRequest) ([]*models.Payment, int64, error) {
	return s.paymentRepo.List(req)
}

func (s *paymentService) Refund(paymentID uint, req RefundPaymentRequest, actorID uint, ipAddress string) (*models.Payment, error) {
	payment, err := s.paymentRepo.FindByID(paymentID)
	if err != nil || payment == nil {
		return nil, apperrors.New(http.StatusNotFound, "PAY_001", "Payment not found", "")
	}
	if payment.Status != models.PaymentStatusCompleted {
		return nil, apperrors.New(http.StatusConflict, "PAY_002", "Cannot refund", "Only completed payments can be refunded")
	}

	refundAmount := req.Amount
	if refundAmount <= 0 || refundAmount > payment.Amount {
		refundAmount = payment.Amount // full refund
	}

	now := time.Now()
	payment.Status = models.PaymentStatusRefunded
	payment.RefundedAt = &now
	payment.RefundAmount = refundAmount
	payment.RefundReason = req.Reason

	if err := s.paymentRepo.Update(payment); err != nil {
		return nil, apperrors.ErrInternal
	}

	s.auditPayment(actorID, "payment.refund", paymentID,
		models.JSONMap{"status": "completed"},
		models.JSONMap{"status": "refunded", "refund_amount": refundAmount}, ipAddress)

	// Notify member of refund.
	if member, err := s.memberRepo.FindByID(payment.MemberID); err == nil && member != nil {
		go s.notifSvc.Dispatch(PaymentRefundedEvent(member.User.ID, paymentID, refundAmount, payment.Currency))
	}

	return payment, nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func isValidPaymentMethod(m string) bool {
	switch m {
	case models.PaymentMethodCash, models.PaymentMethodUPI, models.PaymentMethodCard,
		models.PaymentMethodBankTransfer, models.PaymentMethodRazorpay, models.PaymentMethodOther:
		return true
	}
	return false
}

func (s *paymentService) auditPayment(userID uint, action string, resourceID uint, old, new models.JSONMap, ip string) {
	rid := resourceID
	_ = s.auditRepo.Create(&models.AuditLog{
		UserID:       userID,
		Action:       action,
		ResourceType: "payment",
		ResourceID:   &rid,
		OldValues:    old,
		NewValues:    new,
		IPAddress:    ip,
	})
}
