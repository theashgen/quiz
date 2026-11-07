.PHONY: up infra certs dev test integration e2e build down load
certs:
	mkdir -p .local/certs
	@if [ ! -f .local/certs/localhost.pem ]; then \
		openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
			-keyout .local/certs/localhost-key.pem -out .local/certs/localhost.pem \
			-subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'; \
	fi
up: certs
	docker compose up --build -d
infra:
	docker compose up -d postgres redis
dev:
	LOCAL_HTTP=true go run ./cmd/server
test:
	go test -race ./...
	npm --prefix web run check
integration:
	TEST_DATABASE_URL="$${TEST_DATABASE_URL:-postgres://quiz:local-quiz-only@localhost:55432/quiz?sslmode=disable}" TEST_REDIS_URL="$${TEST_REDIS_URL:-redis://localhost:56379/0}" go test -race -count=1 ./...
e2e:
	npm --prefix web run test:e2e
build:
	npm --prefix web ci
	npm --prefix web run build
	mkdir -p .local
	go build -o .local/quiz-server ./cmd/server
down:
	docker compose down
load:
	go run ./cmd/loadtest -players 150
