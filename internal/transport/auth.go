package transport

import (
	"context"
	"errors"
	"net/http"
	"quiz/internal/accounts"
	"time"

	"github.com/gorilla/mux"
)

func (s *Server) authRoutes(router *mux.Router) {
	router.HandleFunc("/api/auth/me", func(w http.ResponseWriter, r *http.Request) {
		user, err := accounts.Current(r.Context(), s.Store, r)
		if errors.Is(err, accounts.ErrSignedOut) {
			if err := accounts.Logout(r.Context(), s.Store, w, r); err != nil {
				fail(w, 503, errors.New("Account service unavailable"))
				return
			}
			write(w, 200, map[string]any{"user": nil})
			return
		}
		if err != nil {
			fail(w, 503, errors.New("Account service unavailable. Please try again"))
			return
		}
		write(w, 200, map[string]any{"user": user})
	}).Methods(http.MethodGet)
	router.HandleFunc("/api/auth/signup", s.authenticate).Methods(http.MethodPost)
	router.HandleFunc("/api/auth/login", s.authenticate).Methods(http.MethodPost)
	router.HandleFunc("/api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		if err := accounts.Logout(r.Context(), s.Store, w, r); err != nil {
			fail(w, 503, errors.New("Could not sign out. Please try again"))
			return
		}
		write(w, 200, map[string]any{"user": nil})
	}).Methods(http.MethodPost)
}

func (s *Server) authenticate(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	var input struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8<<10)
	if err := decode(w, r, &input); err != nil {
		fail(w, 400, errors.New("Invalid account details or request exceeds 8 KiB"))
		return
	}
	if len(input.Email) > 254 || len(input.Password) > 1024 || len(input.Name) > 120 {
		fail(w, 400, errors.New("Account details exceed the allowed length"))
		return
	}
	allowed, err := accounts.Allow(ctx, s.Store, r, input.Email)
	if err != nil {
		fail(w, 503, errors.New("Account service unavailable. Please try again"))
		return
	}
	if !allowed {
		w.Header().Set("Retry-After", "900")
		fail(w, 429, errors.New("Too many attempts. Please try again in 15 minutes"))
		return
	}
	select {
	case s.authSlots <- struct{}{}:
		defer func() { <-s.authSlots }()
	default:
		fail(w, 429, errors.New("Sign-in is busy. Please try again shortly"))
		return
	}
	var user *accounts.User
	var value string
	status := http.StatusOK
	if r.URL.Path == "/api/auth/signup" {
		user, value, err = accounts.Signup(ctx, s.Store, input.Name, input.Email, input.Password, input.Role)
		status = http.StatusCreated
	} else {
		user, value, err = accounts.Login(ctx, s.Store, input.Email, input.Password)
	}
	if err != nil {
		var validation *accounts.ValidationError
		switch {
		case errors.Is(err, accounts.ErrCredentials):
			fail(w, 401, err)
		case errors.Is(err, accounts.ErrDuplicate):
			fail(w, 409, err)
		case errors.As(err, &validation):
			fail(w, 400, err)
		default:
			fail(w, 503, errors.New("Could not complete sign-in. Please try again"))
		}
		return
	}
	if err = accounts.Establish(ctx, s.Store, w, r, value); err != nil {
		fail(w, 503, errors.New("Could not start your account session"))
		return
	}
	write(w, status, map[string]any{"user": user})
}

func (s *Server) teacher(w http.ResponseWriter, r *http.Request) bool {
	user, err := accounts.Current(r.Context(), s.Store, r)
	if err != nil && !errors.Is(err, accounts.ErrSignedOut) {
		fail(w, 503, errors.New("Account service unavailable"))
		return false
	}
	if user == nil {
		fail(w, 401, errors.New("Sign in as a teacher to create and host quizzes"))
		return false
	}
	if user.Role != "teacher" {
		fail(w, 403, errors.New("Only teacher accounts can create and host quizzes"))
		return false
	}
	return true
}
