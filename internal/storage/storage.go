package storage

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "os"
    "path/filepath"
    "quiz/internal/gameplay"
    "quiz/internal/rooms"
    "strings"
    "time"

    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/redis/go-redis/v9"
)

var ErrNotFound = errors.New("Room not found")

type Store struct {
    DB    *pgxpool.Pool
    Redis *redis.Client
}

func Open(ctx context.Context, dbURL, redisURL string) (*Store, error) {
    cfg, err := pgxpool.ParseConfig(dbURL)

    if err != nil {
        return nil, err
    }

    cfg.MaxConns = 30
    db, err := pgxpool.NewWithConfig(ctx, cfg)

    if err != nil {
        return nil, err
    }

    if err = db.Ping(ctx); err != nil {
        db.Close()

        return nil, err
    }

    opts, err := redis.ParseURL(redisURL)

    if err != nil {
        db.Close()

        return nil, err
    }

    opts.DialTimeout = time.Second
    opts.ReadTimeout = time.Second
    opts.WriteTimeout = time.Second
    opts.MaxRetries = 0
    opts.ContextTimeoutEnabled = true

    return &Store{
        DB:    db,
        Redis: redis.NewClient(opts),
    }, nil
}

func (s *Store) Close() {
    s.DB.Close()
    _ = s.Redis.Close()
}

func (s *Store) Migrate(ctx context.Context, dir string) error {
    tx, err := s.DB.Begin(ctx)

    if err != nil {
        return err
    }

    defer tx.Rollback(ctx)

    if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(81390994)"); err != nil {
        return err
    }

    if _, err = tx.Exec(ctx, "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY)"); err != nil {
        return err
    }

    files, err := filepath.Glob(filepath.Join(dir, "*.sql"))

    if err != nil {
        return err
    }

    for _, path := range files {
        var applied bool

        if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)", filepath.Base(path)).Scan(&applied); err != nil {
            return err
        }

        if applied {
            continue
        }

        b, e := os.ReadFile(path)

        if e != nil {
            return e
        }

        if _, err = tx.Exec(ctx, string(b)); err != nil {
            return fmt.Errorf("migration %s: %w", path, err)
        }

        if _, err = tx.Exec(ctx, "INSERT INTO schema_migrations(version) VALUES($1)", filepath.Base(path)); err != nil {
            return err
        }
    }

    return tx.Commit(ctx)
}

func (s *Store) Create(ctx context.Context, r *rooms.Room) error {
    b, err := json.Marshal(r)

    if err != nil {
        return err
    }

    _, err = s.DB.Exec(ctx, "INSERT INTO rooms(id,code,state) VALUES($1,$2,$3)", r.ID, r.Code, b)

    return err
}

type AnswerRecord struct {
    RoomID, RoundID, SessionID string
    Receipt                    gameplay.Receipt
}

func receipts(r *rooms.Room) map[string]AnswerRecord {
    m := map[string]AnswerRecord{}

    for _, q := range r.Rounds {
        for sid, a := range q.Attempts {
            for qid, receipt := range a.Answers {
                m[a.ID+":"+qid] = AnswerRecord{
                    r.ID,
                    q.ID,
                    sid,
                    receipt,
                }
            }
        }
    }

    return m
}

// Mutate commits recovery even if a command is rejected. Callbacks must validate before mutation.
func (s *Store) Mutate(ctx context.Context, code string, fn func(*rooms.Room, int64) error) (*rooms.Room, int64, error) {
    tx, err := s.DB.BeginTx(ctx, pgx.TxOptions{})

    if err != nil {
        return nil, 0, err
    }

    defer tx.Rollback(ctx)
    var raw []byte
    err = tx.QueryRow(ctx, "SELECT state FROM rooms WHERE code=$1 FOR UPDATE", strings.ToUpper(code)).Scan(&raw)

    if errors.Is(err, pgx.ErrNoRows) {
        return nil, 0, ErrNotFound
    }

    if err != nil {
        return nil, 0, err
    }

    var now time.Time

    if err = tx.QueryRow(ctx, "SELECT clock_timestamp()").Scan(&now); err != nil {
        return nil, 0, err
    }

    ms := now.UnixMilli()
    var r rooms.Room

    if err = json.Unmarshal(raw, &r); err != nil {
        return nil, 0, err
    }

    before := receipts(&r)
    r.Advance(ms)
    var commandErr error

    if fn != nil {
        commandErr = fn(&r, ms)
    }

    after, err := json.Marshal(&r)

    if err != nil {
        return nil, 0, err
    }

    changed := string(after) != string(raw)

    // PostgreSQL jsonb changes whitespace/key order, so compare decoded canonical JSON.
    var old rooms.Room
    _ = json.Unmarshal(raw, &old)
    canonical, _ := json.Marshal(&old)
    changed = string(canonical) != string(after)

    if changed {
        r.Revision++
        after, err = json.Marshal(&r)

        if err != nil {
            return nil, 0, err
        }

        for key, a := range receipts(&r) {
            if _, ok := before[key]; ok {
                continue
            }

            p := a.Receipt
            tag, e := tx.Exec(ctx, "INSERT INTO accepted_answers(attempt_id,question_id,room_id,round_id,session_id,choice,points,accepted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING", p.AttemptID, p.QuestionID, r.ID, a.RoundID, a.SessionID, p.Choice, p.Points, time.UnixMilli(p.AcceptedAt))

            if e != nil {
                return nil, 0, e
            }

            if tag.RowsAffected() != 1 {
                return nil, 0, errors.New("Durable answer conflict; transaction aborted")
            }
        }

        if _, err = tx.Exec(ctx, "UPDATE rooms SET state=$1,updated_at=clock_timestamp() WHERE id=$2", after, r.ID); err != nil {
            return nil, 0, err
        }
    }

    if err = tx.Commit(ctx); err != nil {
        return nil, 0, err
    }

    if changed {
        s.Notify(ctx, code)
    }

    return &r, ms, commandErr
}

func (s *Store) Notify(ctx context.Context, code string) {
    cacheCtx, cancel := context.WithTimeout(ctx, 150*time.Millisecond)
    defer cancel()

    // Internal aggregate cache is never sent directly; transport builds a personal, redacted snapshot.
    pipe := s.Redis.Pipeline()
    pipe.Del(cacheCtx, "room:"+code)
    pipe.Publish(cacheCtx, "quiz:updates", code)
    _, _ = pipe.Exec(cacheCtx)
}

func (s *Store) Due(ctx context.Context) error {
    rows, err := s.DB.Query(ctx, "SELECT code FROM rooms WHERE state->>'status' IN ('lobby','active')")

    if err != nil {
        return err
    }

    codes := []string{}

    for rows.Next() {
        var c string

        if err = rows.Scan(&c); err != nil {
            rows.Close()

            return err
        }

        codes = append(codes, c)
    }

    rows.Close()

    if err = rows.Err(); err != nil {
        return err
    }

    for _, code := range codes {
        if _, _, err = s.Mutate(ctx, code, nil); err != nil {
            return err
        }
    }

    return nil
}

// View is a committed, read-only view for live rendering. The worker and commands reconcile deadlines.
func (s *Store) View(ctx context.Context, code string) (*rooms.Room, int64, error) {
    code = strings.ToUpper(code)
    cacheCtx, cancel := context.WithTimeout(ctx, 10*time.Millisecond)
    raw, cacheErr := s.Redis.Get(cacheCtx, "room:"+code).Bytes()
    cancel()

    if cacheErr == nil {
        var room rooms.Room

        if json.Unmarshal(raw, &room) == nil {
            return &room, time.Now().UnixMilli(), nil
        }
    }

    var now time.Time
    err := s.DB.QueryRow(ctx, "SELECT state,clock_timestamp() FROM rooms WHERE code=$1", code).Scan(&raw, &now)

    if errors.Is(err, pgx.ErrNoRows) {
        return nil, 0, ErrNotFound
    }

    if err != nil {
        return nil, 0, err
    }

    var room rooms.Room

    if err = json.Unmarshal(raw, &room); err != nil {
        return nil, 0, err
    }

    cacheCtx, cancel = context.WithTimeout(ctx, 10*time.Millisecond)
    _ = s.Redis.Set(cacheCtx, "room:"+code, raw, 200*time.Millisecond).Err()
    cancel()

    return &room, now.UnixMilli(), nil
}
