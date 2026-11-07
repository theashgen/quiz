package sessions

import (
    "context"
    "crypto/rand"
    "crypto/sha256"
    "encoding/hex"
    "encoding/json"
    "errors"
    "net/http"
    "quiz/internal/content"
    "quiz/internal/storage"
    "time"

    "github.com/jackc/pgx/v5"
)

var ErrRequired = errors.New("Start a guest session first")

var ErrExpired = errors.New("Your guest session expired; return home")

const CookieName = "__Host-quiz_guest"

const Lifetime = 30 * 24 * time.Hour

type localHTTPKey struct{}

func LocalHTTP(next http.Handler) http.Handler {
    return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
        ctx := context.WithValue(request.Context(), localHTTPKey{}, true)
        next.ServeHTTP(response, request.WithContext(ctx))
    })
}

func cookieName(ctx context.Context) string {
    if local, _ := ctx.Value(localHTTPKey{}).(bool); local {
        return "quiz_guest_local"
    }

    return CookieName
}

func hash(token string) string {
    d := sha256.Sum256([]byte(token))

    return hex.EncodeToString(d[:])
}

type lookup struct {
    ID        string    `json:"id"`
    ExpiresAt time.Time `json:"expiresAt"`
}

func Get(ctx context.Context, s *storage.Store, r *http.Request) (string, error) {
    c, err := r.Cookie(cookieName(ctx))

    if err != nil {
        return "", ErrRequired
    }

    key := "session:" + hash(c.Value)
    cacheCtx, cancel := context.WithTimeout(ctx, 10*time.Millisecond)
    cached, cacheErr := s.Redis.Get(cacheCtx, key).Bytes()
    cancel()
    var session lookup

    if cacheErr == nil && json.Unmarshal(cached, &session) == nil && session.ID != "" && time.Now().Before(session.ExpiresAt) {
        return session.ID, nil
    }

    err = s.DB.QueryRow(ctx, "SELECT id,expires_at FROM guest_sessions WHERE token_hash=$1 AND expires_at>clock_timestamp()", hash(c.Value)).Scan(&session.ID, &session.ExpiresAt)

    if errors.Is(err, pgx.ErrNoRows) {
        return "", ErrExpired
    }

    if err != nil {
        return "", err
    }

    ttl := min(30*time.Second, time.Until(session.ExpiresAt))

    if ttl > 0 {
        b, _ := json.Marshal(session)
        cacheCtx, cancel = context.WithTimeout(ctx, 10*time.Millisecond)
        _ = s.Redis.Set(cacheCtx, key, b, ttl).Err()
        cancel()
    }

    return session.ID, nil
}

func Expires(ctx context.Context, s *storage.Store, id string) (time.Time, error) {
    var expires time.Time
    err := s.DB.QueryRow(ctx, "SELECT expires_at FROM guest_sessions WHERE id=$1 AND expires_at>clock_timestamp()", id).Scan(&expires)

    return expires, err
}

func Ensure(ctx context.Context, s *storage.Store, w http.ResponseWriter, r *http.Request) (string, error) {
    if id, err := Get(ctx, s, r); err == nil {
        return id, nil
    }

    var bytes [32]byte

    if _, err := rand.Read(bytes[:]); err != nil {
        return "", err
    }

    token := hex.EncodeToString(bytes[:])
    id := content.ID()
    _, err := s.DB.Exec(ctx, "INSERT INTO guest_sessions(id,token_hash,expires_at) VALUES($1,$2,$3)", id, hash(token), time.Now().Add(Lifetime))

    if err != nil {
        return "", err
    }

    name := cookieName(ctx)
    http.SetCookie(w, &http.Cookie{
        Name:     name,
        Value:    token,
        Path:     "/",
        MaxAge:   int(Lifetime.Seconds()),
        Expires:  time.Now().Add(Lifetime),
        HttpOnly: true,
        Secure:   name == CookieName,
        SameSite: http.SameSiteLaxMode,
    })

    return id, nil
}
