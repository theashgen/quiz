-- name: CreateGuestSession :exec
INSERT INTO guest_sessions (id, token_hash, expires_at)
VALUES ($1, $2, $3);

-- name: UpdateGuestSessionExpiry :exec
UPDATE guest_sessions SET expires_at = $1 WHERE id = $2;

-- name: GetActiveGuestSession :one
SELECT id, expires_at FROM guest_sessions
WHERE token_hash = $1 AND expires_at > clock_timestamp();

-- name: GetActiveGuestSessionExpiry :one
SELECT expires_at FROM guest_sessions
WHERE id = $1 AND expires_at > clock_timestamp();
