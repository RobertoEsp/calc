GO_IMAGE ?= golang:1.27-alpine
GO_DOCKER := docker run --rm \
	-v "$(CURDIR)/backend:/src" \
	-w /src \
	-v mvp-calc-go-mod:/go/pkg/mod \
	-v mvp-calc-go-build:/root/.cache/go-build \
	$(GO_IMAGE)

.PHONY: dev-api dev-web test test-api test-web cover lint build-api docker

dev-api:
	docker run --rm -p 8080:8080 -e PORT=8080 \
		-v "$(CURDIR)/backend:/src" \
		-w /src \
		-v mvp-calc-go-mod:/go/pkg/mod \
		-v mvp-calc-go-build:/root/.cache/go-build \
		$(GO_IMAGE) go run ./cmd/server

dev-web:
	cd frontend && npm run dev

test: test-api test-web

test-api:
	$(GO_DOCKER) go test ./...

test-web:
	cd frontend && npm test

cover:
	$(GO_DOCKER) go test ./... -coverprofile=coverage.out
	cd frontend && npm run test:coverage

lint:
	$(GO_DOCKER) go vet ./...
	cd frontend && npm run lint

build-api:
	$(GO_DOCKER) go build -o bin/server ./cmd/server

docker:
	docker build -t mvp-calc:dev .
