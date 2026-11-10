package main

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"quiz/internal/sessions"
	"quiz/internal/storage"
	"quiz/internal/transport"
	"syscall"
	"time"
)

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}

	return d
}

func loopbackAddress(address string) bool {
	host, _, err := net.SplitHostPort(address)

	return err == nil && net.ParseIP(host).IsLoopback()
}

func main() {
	config, err := loadConfig()

	if err != nil {
		slog.Error("configuration", "error", err)
		os.Exit(1)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	slog.Info("database configuration", "database_url_configured", os.Getenv("DATABASE_URL") != "", "redis_url_configured", os.Getenv("REDIS_URL") != "")
	store, err := storage.Open(ctx, env("DATABASE_URL", "postgres://quiz:local-quiz-only@localhost:55432/quiz?sslmode=disable"), env("REDIS_URL", "redis://localhost:56379/0"))

	if err != nil {
		slog.Error("database startup", "error", err)
		os.Exit(1)
	}

	defer store.Close()

	if err = store.Migrate(ctx, env("MIGRATIONS_DIR", "migrations")); err != nil {
		slog.Error("migrations", "error", err)
		os.Exit(1)
	}

	app := transport.New(
		store,
		config.origin,
		env("STATIC_DIR", "web/dist"),
	)
	app.Run(ctx)
	handler := app.Handler()

	if config.localHTTP {
		handler = sessions.LocalHTTP(handler)
	}

	server := &http.Server{
		Addr:              config.address,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	go func() {
		<-ctx.Done()
		stop, c := context.WithTimeout(context.Background(), 5*time.Second)
		defer c()
		_ = server.Shutdown(stop)
	}()
	slog.Info("quiz ready", "address", server.Addr, "origin", config.origin)

	if config.localHTTP || config.behindProxy {
		err = server.ListenAndServe()
	} else {
		err = server.ListenAndServeTLS(env("TLS_CERT", ".local/certs/localhost.pem"), env("TLS_KEY", ".local/certs/localhost-key.pem"))
	}

	if err != nil && err != http.ErrServerClosed {
		slog.Error("server", "error", err)
		os.Exit(1)
	}
}
