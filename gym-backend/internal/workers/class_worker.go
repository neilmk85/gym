package workers

import (
	"context"
	"log/slog"
	"time"

	"gym-backend/internal/repositories"
)

// ClassWorker periodically marks ended classes as completed.
type ClassWorker struct {
	classRepo repositories.ClassRepository
	logger    *slog.Logger
	interval  time.Duration
}

func NewClassWorker(classRepo repositories.ClassRepository, logger *slog.Logger) *ClassWorker {
	return &ClassWorker{
		classRepo: classRepo,
		logger:    logger,
		interval:  15 * time.Minute,
	}
}

// Start runs the worker loop until ctx is cancelled.
func (w *ClassWorker) Start(ctx context.Context) {
	w.logger.Info("class worker started", "interval", w.interval)

	w.run()

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.run()
		case <-ctx.Done():
			w.logger.Info("class worker stopped")
			return
		}
	}
}

func (w *ClassWorker) run() {
	affected, err := w.classRepo.CompleteEndedClasses(time.Now())
	if err != nil {
		w.logger.Error("class worker: complete ended classes failed", "err", err)
		return
	}
	if affected > 0 {
		w.logger.Info("class worker: classes marked completed", "count", affected)
	}
}
