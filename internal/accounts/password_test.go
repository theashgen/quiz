package accounts

import (
	"strings"
	"testing"
)

func TestPasswordHashAndValidation(t *testing.T) {
	password := "A long test passphrase 2026"
	first, err := HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	second, err := HashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	if first == second || strings.Contains(first, password) {
		t.Fatal("password hashing must use independent salts")
	}
	if !CheckPassword(password, first) || CheckPassword("incorrect password", first) || CheckPassword(password, "broken hash") {
		t.Fatal("password verification failed")
	}
	for _, value := range []string{"short", strings.Repeat("x", 1025)} {
		if _, err := HashPassword(value); err == nil {
			t.Fatal("invalid password accepted")
		}
	}
}

func TestEmailNormalization(t *testing.T) {
	email, err := NormalizeEmail("  Teacher@Example.COM  ")
	if err != nil || email != "teacher@example.com" {
		t.Fatal(email, err)
	}
	for _, value := range []string{"bad", "Name <teacher@example.com>", "a@example.com\r\nBCC: evil@example.com"} {
		if _, err := NormalizeEmail(value); err == nil {
			t.Fatal("invalid email accepted")
		}
	}
}
