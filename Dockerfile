# syntax=docker/dockerfile:1

FROM node:26.8.2-bookworm-slim AS web
WORKDIR /build/web
COPY web/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM golang:1.27.3-bookworm AS backend
WORKDIR /build
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download
COPY cmd/ cmd/
COPY internal/ internal/
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /quiz ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
ENV STATIC_DIR=/app/web/dist \
    MIGRATIONS_DIR=/app/migrations
COPY --from=backend --chown=nonroot:nonroot /quiz /app/quiz
COPY --from=web --chown=nonroot:nonroot /build/web/dist /app/web/dist
COPY --chown=nonroot:nonroot migrations /app/migrations
USER nonroot:nonroot
EXPOSE 8443
CMD ["/app/quiz"]
