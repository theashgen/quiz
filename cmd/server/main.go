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
    localHTTP := os.Getenv("LOCAL_HTTP") == "true"
    address := env("LISTEN_ADDR", "127.0.0.1:8443")

    if localHTTP && !loopbackAddress(address) {
        slog.Error("LOCAL_HTTP requires a numeric loopback LISTEN_ADDR")
        os.Exit(1)
    }

    scheme := "https"

    if localHTTP {
        scheme = "http"
    }

    ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer cancel()
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
		env("APP_ORIGIN", scheme+"://localhost:8443,"+scheme+"://localhost:5173,"+scheme+"://127.0.0.1:8443,"+scheme+"://127.0.0.1:5173"),
		env("STATIC_DIR", "web/dist"),
	)
    app.Run(ctx)
    handler := app.Handler()

    if localHTTP {
        handler = sessions.LocalHTTP(handler)
    }

    server := &http.Server{
        Addr:              address,
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
    slog.Info("quiz ready", "url", scheme+"://"+server.Addr)

    if localHTTP {
        err = server.ListenAndServe()
    } else {
        err = server.ListenAndServeTLS(env("TLS_CERT", ".local/certs/localhost.pem"), env("TLS_KEY", ".local/certs/localhost-key.pem"))
    }

    if err != nil && err != http.ErrServerClosed {
        slog.Error("server", "error", err)
        os.Exit(1)
    }
}
