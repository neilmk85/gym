.PHONY: run build test test-all test-coverage lint clean tidy

BINARY=gym-backend
CMD=./cmd/server

run:
	go run $(CMD)/main.go

build:
	go build -o bin/$(BINARY) $(CMD)/main.go

test:
	go test ./internal/services/... -v

test-all:
	go test ./...

test-coverage:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report: coverage.html"

lint:
	go vet ./...

tidy:
	go mod tidy

clean:
	rm -rf bin/ coverage.out coverage.html
