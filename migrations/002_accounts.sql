-- +goose Up
-- Existing installations may already have these objects from the original runner.
CREATE TABLE IF NOT EXISTS accounts (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text UNIQUE NOT NULL CHECK (email = lower(email)),
    role text NOT NULL CHECK (role IN ('teacher', 'student')),
    password_hash text NOT NULL,
    player_id text UNIQUE NOT NULL REFERENCES guest_sessions(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS account_sessions (
    token_hash text PRIMARY KEY,
    account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS account_sessions_expiry ON account_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_throttle (
    key text PRIMARY KEY,
    attempts integer NOT NULL,
    reset_at timestamptz NOT NULL
);

-- +goose Down
DROP TABLE auth_throttle;
DROP TABLE account_sessions;
DROP TABLE accounts;
