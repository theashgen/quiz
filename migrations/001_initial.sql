CREATE TABLE IF NOT EXISTS guest_sessions (
    id text PRIMARY KEY,
    token_hash text UNIQUE NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS rooms (
    id text PRIMARY KEY,
    code text UNIQUE NOT NULL,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS rooms_due ON rooms ((state->>'status'));
CREATE TABLE IF NOT EXISTS accepted_answers (
    attempt_id text NOT NULL,
    question_id text NOT NULL,
    room_id text NOT NULL REFERENCES rooms(id),
    round_id text NOT NULL,
    session_id text NOT NULL REFERENCES guest_sessions(id),
    choice integer CHECK (choice BETWEEN 0 AND 3),
    points integer NOT NULL CHECK (points IN (0,100)),
    accepted_at timestamptz NOT NULL,
    PRIMARY KEY (attempt_id, question_id)
);
