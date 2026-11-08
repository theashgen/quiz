package accounts

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"quiz/internal/content"
	"quiz/internal/sessions"
	"quiz/internal/storage"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const CookieName = "__Host-quiz_account"
const Lifetime = 7 * 24 * time.Hour

var ErrSignedOut = errors.New("Your account session expired. Please sign in again")
var ErrCredentials = errors.New("Email or password is incorrect")
var ErrDuplicate = errors.New("An account with that email already exists. Please sign in")

type ValidationError struct{ Message string }

func (err *ValidationError) Error() string { return err.Message }

type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	PlayerID  string    `json:"-"`
	ExpiresAt time.Time `json:"-"`
}

func NormalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(email)
	if err != nil || address.Address != email || len(email) > 254 || !strings.Contains(email, "@") {
		return "", &ValidationError{"Enter a valid email address"}
	}
	return email, nil
}

func token() (string, error) {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func digest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func cookieName(ctx context.Context) string {
	if sessions.IsLocalHTTP(ctx) {
		return "quiz_account_local"
	}
	return CookieName
}

func setCookie(w http.ResponseWriter, r *http.Request, value string, remove bool) {
	cookie := &http.Cookie{Name: cookieName(r.Context()), Value: value, Path: "/", HttpOnly: true, Secure: !sessions.IsLocalHTTP(r.Context()), SameSite: http.SameSiteLaxMode, MaxAge: int(Lifetime.Seconds()), Expires: time.Now().Add(Lifetime)}
	if remove {
		cookie.MaxAge = -1
		cookie.Expires = time.Unix(1, 0)
	}
	http.SetCookie(w, cookie)
}

func Current(ctx context.Context, store *storage.Store, r *http.Request) (*User, error) {
	cookie, err := r.Cookie(cookieName(ctx))
	if errors.Is(err, http.ErrNoCookie) {
		return nil, nil
	}
	if err != nil || len(cookie.Value) != 64 {
		return nil, ErrSignedOut
	}
	var user User
	err = store.DB.QueryRow(ctx, `SELECT a.id,a.name,a.email,a.role,a.player_id,s.expires_at FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp()`, digest(cookie.Value)).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.PlayerID, &user.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrSignedOut
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func Signup(ctx context.Context, store *storage.Store, name, email, password, role string) (*User, string, error) {
	name = strings.TrimSpace(name)
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 30 {
		return nil, "", &ValidationError{"Use a name between 1 and 30 characters"}
	}
	normalized, err := NormalizeEmail(email)
	if err != nil {
		return nil, "", err
	}
	if role != "teacher" && role != "student" {
		return nil, "", &ValidationError{"Choose teacher or student"}
	}
	encoded, err := HashPassword(password)
	if err != nil {
		return nil, "", err
	}
	sessionToken, err := token()
	if err != nil {
		return nil, "", err
	}
	playerToken, err := token()
	if err != nil {
		return nil, "", err
	}
	user := &User{ID: content.ID(), Name: name, Email: normalized, Role: role, PlayerID: content.ID()}
	tx, err := store.DB.Begin(ctx)
	if err != nil {
		return nil, "", err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, "INSERT INTO guest_sessions(id,token_hash,expires_at) VALUES($1,$2,$3)", user.PlayerID, digest(playerToken), time.Now().Add(sessions.Lifetime))
	if err == nil {
		_, err = tx.Exec(ctx, "INSERT INTO accounts(id,name,email,role,password_hash,player_id) VALUES($1,$2,$3,$4,$5,$6)", user.ID, user.Name, user.Email, user.Role, encoded, user.PlayerID)
	}
	var databaseError *pgconn.PgError
	if errors.As(err, &databaseError) && databaseError.Code == "23505" {
		return nil, "", ErrDuplicate
	}
	if err != nil {
		return nil, "", err
	}
	_, err = tx.Exec(ctx, "INSERT INTO account_sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)", digest(sessionToken), user.ID, time.Now().Add(Lifetime))
	if err != nil {
		return nil, "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, "", err
	}
	return user, sessionToken, nil
}

func Login(ctx context.Context, store *storage.Store, email, password string) (*User, string, error) {
	normalized, err := NormalizeEmail(email)
	if err != nil || len(password) > 1024 {
		return nil, "", ErrCredentials
	}
	var user User
	var encoded string
	err = store.DB.QueryRow(ctx, "SELECT id,name,email,role,player_id,password_hash FROM accounts WHERE email=$1", normalized).Scan(&user.ID, &user.Name, &user.Email, &user.Role, &user.PlayerID, &encoded)
	if errors.Is(err, pgx.ErrNoRows) {
		CheckPassword(password, "pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
		return nil, "", ErrCredentials
	}
	if err != nil {
		return nil, "", err
	}
	if !CheckPassword(password, encoded) {
		return nil, "", ErrCredentials
	}
	sessionToken, err := token()
	if err != nil {
		return nil, "", err
	}
	tx, err := store.DB.Begin(ctx)
	if err != nil {
		return nil, "", err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, "UPDATE guest_sessions SET expires_at=$1 WHERE id=$2", time.Now().Add(sessions.Lifetime), user.PlayerID)
	if err == nil {
		_, err = tx.Exec(ctx, "INSERT INTO account_sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)", digest(sessionToken), user.ID, time.Now().Add(Lifetime))
	}
	if err != nil {
		return nil, "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, "", err
	}
	return &user, sessionToken, nil
}

func Establish(ctx context.Context, store *storage.Store, w http.ResponseWriter, r *http.Request, value string) error {
	if err := Logout(ctx, store, w, r); err != nil {
		return err
	}
	setCookie(w, r, value, false)
	return nil
}

func Logout(ctx context.Context, store *storage.Store, w http.ResponseWriter, r *http.Request) error {
	if cookie, err := r.Cookie(cookieName(ctx)); err == nil {
		if _, err = store.DB.Exec(ctx, "DELETE FROM account_sessions WHERE token_hash=$1", digest(cookie.Value)); err != nil {
			return err
		}
	}
	setCookie(w, r, "", true)
	return nil
}

func Allow(ctx context.Context, store *storage.Store, r *http.Request, email string) (bool, error) {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	for _, budget := range []struct {
		key     string
		maximum int
	}{{"ip:" + host, 100}, {"email:" + strings.ToLower(strings.TrimSpace(email)), 10}} {
		var attempts int
		err := store.DB.QueryRow(ctx, `INSERT INTO auth_throttle(key,attempts,reset_at) VALUES($1,1,clock_timestamp()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_throttle.reset_at<=clock_timestamp() THEN 1 ELSE auth_throttle.attempts+1 END,reset_at=CASE WHEN auth_throttle.reset_at<=clock_timestamp() THEN clock_timestamp()+interval '15 minutes' ELSE auth_throttle.reset_at END RETURNING attempts`, digest(budget.key)).Scan(&attempts)
		if err != nil {
			return false, err
		}
		if attempts > budget.maximum {
			return false, nil
		}
	}
	return true, nil
}
