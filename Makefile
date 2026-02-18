BINARY     := durins-door
MODULE     := github.com/unisoniq/durins-door
BUILD_DIR  := .
INSTALL_DIR := /usr/local/bin

# Build info
GIT_COMMIT  := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE  := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
GO_VERSION  := $(shell go version | awk '{print $$3}')

LDFLAGS := -s -w \
	-X '$(MODULE)/cmd.Version=$(GIT_COMMIT)' \
	-X '$(MODULE)/cmd.BuildDate=$(BUILD_DATE)'

.PHONY: all build install clean test tidy fmt vet run help

## all: Build the binary (default)
all: build

## build: Compile durins-door
build:
	@echo "🔨  Building $(BINARY)…"
	go build -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY) .
	@echo "✅  $(BUILD_DIR)/$(BINARY) built ($(GIT_COMMIT))"

## install: Build and install to $(INSTALL_DIR)
install: build
	@echo "📦  Installing $(BINARY) → $(INSTALL_DIR)/$(BINARY)"
	install -m 0755 $(BUILD_DIR)/$(BINARY) $(INSTALL_DIR)/$(BINARY)
	@echo "✅  Installed."

## uninstall: Remove the installed binary
uninstall:
	@echo "🗑   Removing $(INSTALL_DIR)/$(BINARY)"
	rm -f $(INSTALL_DIR)/$(BINARY)

## clean: Remove build artifacts
clean:
	@echo "🧹  Cleaning…"
	rm -f $(BUILD_DIR)/$(BINARY)
	go clean -cache

## tidy: Run go mod tidy
tidy:
	go mod tidy

## fmt: Format all Go source files
fmt:
	gofmt -w -s .

## vet: Run go vet
vet:
	go vet ./...

## test: Run unit tests
test:
	go test ./... -v -race -count=1

## run: Build and run the server on port 8888
run: build
	./$(BINARY) server --port 8888

## help: Show this help
help:
	@echo "Durin's Door — Makefile targets:"
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | column -t -s ':' | sed 's/^/  /'
