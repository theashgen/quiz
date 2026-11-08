package accounts

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"strings"
	"unicode/utf8"
)

const iterations = 600000

func HashPassword(password string) (string, error) {
	if !utf8.ValidString(password) || utf8.RuneCountInString(password) < 12 || len(password) > 1024 {
		return "", &ValidationError{"Use a password with at least 12 characters and at most 1024 bytes"}
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	derived, err := pbkdf2.Key(sha256.New, password, salt, iterations, 32)
	if err != nil {
		return "", err
	}
	return "pbkdf2-sha256$600000$" + base64.RawStdEncoding.EncodeToString(salt) + "$" + base64.RawStdEncoding.EncodeToString(derived), nil
}

func CheckPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2-sha256" || parts[1] != "600000" || len(password) > 1024 {
		return false
	}
	salt, saltErr := base64.RawStdEncoding.DecodeString(parts[2])
	expected, keyErr := base64.RawStdEncoding.DecodeString(parts[3])
	if saltErr != nil || keyErr != nil || len(salt) != 16 || len(expected) != 32 {
		return false
	}
	derived, err := pbkdf2.Key(sha256.New, password, salt, iterations, 32)
	return err == nil && subtle.ConstantTimeCompare(derived, expected) == 1
}
