BINARY   := durins-door-cli
MODULE   := github.com/durins-door/cli
VERSION  ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS  := -s -w -X main.version=$(VERSION)

# Build for the current platform.
.PHONY: build
build:
	go build -ldflags "$(LDFLAGS)" -o $(BINARY) .

# Run all unit tests.
.PHONY: test
test:
	go test ./...

# Cross-compile release artefacts into dist/.
.PHONY: release
release: dist/$(BINARY)-linux-amd64 dist/$(BINARY)-darwin-amd64 dist/$(BINARY)-darwin-arm64 dist/$(BINARY)-windows-amd64.exe

dist/$(BINARY)-linux-amd64:
	mkdir -p dist
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
		go build -ldflags "$(LDFLAGS)" -o $@ .

dist/$(BINARY)-darwin-amd64:
	mkdir -p dist
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 \
		go build -ldflags "$(LDFLAGS)" -o $@ .

dist/$(BINARY)-darwin-arm64:
	mkdir -p dist
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 \
		go build -ldflags "$(LDFLAGS)" -o $@ .

dist/$(BINARY)-windows-amd64.exe:
	mkdir -p dist
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 \
		go build -ldflags "$(LDFLAGS)" -o $@ .

# Install the binary to $GOPATH/bin (or ~/go/bin).
.PHONY: install
install:
	go install -ldflags "$(LDFLAGS)" .

# Remove build artefacts.
.PHONY: clean
clean:
	rm -f $(BINARY)
	rm -rf dist/

# Tidy modules.
.PHONY: tidy
tidy:
	go mod tidy

.PHONY: help
help:
	@echo "Targets:"
	@echo "  build        Build for current platform"
	@echo "  test         Run unit tests"
	@echo "  release      Cross-compile for linux/amd64, darwin/amd64, darwin/arm64, windows/amd64"
	@echo "  install      Install to GOPATH/bin"
	@echo "  clean        Remove build artefacts"
	@echo "  tidy         go mod tidy"
