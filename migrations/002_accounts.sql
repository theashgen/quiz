CREATE TABLE accounts (
    id text PRIMARY KEY,
    name text NOT NULL,
    email text UNIQUE NOT NULL CHECK (email = lower(email)),
    role text NOT NULL CHECK (role IN ('teacher', 'student')),
    password_hash text NOT NULL,
    player_id text UNIQUE NOT NULL REFERENCES guest_sessions(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE account_sessions (
    token_hash text PRIMARY KEY,
    account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);
CREATE INDEX account_sessions_expiry ON account_sessions(expires_at);
CREATE TABLE auth_throttle (
    key text PRIMARY KEY,
    attempts integer NOT NULL,
    reset_at timestamptz NOT NULL
);
