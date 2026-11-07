FROM node:26.8.2-bookworm-slim AS web
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.27.3-bookworm AS backend
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ cmd/
COPY internal/ internal/
RUN CGO_ENABLED=0 go build -trimpath -o /quiz ./cmd/server

FROM debian:bookworm-slim
RUN groupadd -r quiz && useradd -r -g quiz quiz
WORKDIR /app
COPY --from=backend /quiz /app/quiz
COPY --from=web /build/web/dist /app/web/dist
COPY migrations /app/migrations
USER quiz
EXPOSE 8443
CMD ["/app/quiz"]
