-- name: GetCurrentAccount :one
SELECT a.id, a.name, a.email, a.role, a.player_id, s.expires_at
FROM account_sessions s
JOIN accounts a ON a.id = s.account_id
WHERE s.token_hash = $1 AND s.expires_at > clock_timestamp();

-- name: CreateAccount :exec
INSERT INTO accounts (id, name, email, role, password_hash, player_id)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: CreateAccountSession :exec
INSERT INTO account_sessions (token_hash, account_id, expires_at)
VALUES ($1, $2, $3);

-- name: GetAccountByEmail :one
SELECT id, name, email, role, player_id, password_hash FROM accounts WHERE email = $1;

-- name: DeleteAccountSession :exec
DELETE FROM account_sessions WHERE token_hash = $1;

-- name: IncrementAuthThrottle :one
INSERT INTO auth_throttle (key, attempts, reset_at)
VALUES ($1, 1, clock_timestamp() + interval '15 minutes')
ON CONFLICT (key) DO UPDATE SET
    attempts = CASE WHEN auth_throttle.reset_at <= clock_timestamp()
        THEN 1 ELSE auth_throttle.attempts + 1 END,
    reset_at = CASE WHEN auth_throttle.reset_at <= clock_timestamp()
        THEN clock_timestamp() + interval '15 minutes' ELSE auth_throttle.reset_at END
RETURNING attempts;
