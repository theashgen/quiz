-- name: CreateRoom :exec
INSERT INTO rooms (id, code, state)
VALUES ($1, $2, $3);

-- name: LockRoomState :one
SELECT state FROM rooms WHERE code = $1 FOR UPDATE;

-- name: DatabaseTime :one
SELECT clock_timestamp()::timestamptz AS observed_at;

-- name: InsertAcceptedAnswer :execrows
INSERT INTO accepted_answers (
    attempt_id, question_id, room_id, round_id, session_id, choice, points, accepted_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT DO NOTHING;

-- name: UpdateRoomState :exec
UPDATE rooms SET state = $1, updated_at = clock_timestamp() WHERE id = $2;

-- name: ListDueRoomCodes :many
SELECT code FROM rooms WHERE state->>'status' IN ('lobby', 'active');

-- name: ViewRoomState :one
SELECT state, clock_timestamp()::timestamptz AS observed_at FROM rooms WHERE code = $1;
