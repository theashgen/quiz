package storage

import (
    "context"
    "encoding/json"
    "errors"
    "os"
    "quiz/internal/db"
    "quiz/internal/gameplay"
    "quiz/internal/rooms"
    "strings"
    "time"

    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/jackc/pgx/v5/stdlib"
    "github.com/pressly/goose/v3"
    "github.com/pressly/goose/v3/lock"
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
    // Coordinate with any old instance still using the original migration runner.
    locker, err := lock.NewPostgresSessionLocker(lock.WithLockID(81390994))

    if err != nil {
        return err
    }

    migrationDB := stdlib.OpenDBFromPool(s.DB)
    defer migrationDB.Close()

    provider, err := goose.NewProvider(goose.DialectPostgres, migrationDB, os.DirFS(dir), goose.WithSessionLocker(locker))

    if err != nil {
        return err
    }

    _, err = provider.Up(ctx)
    return err
}

func (s *Store) Queries() *db.Queries {
    return db.New(s.DB)
}

func (s *Store) Create(ctx context.Context, r *rooms.Room) error {
    b, err := json.Marshal(r)

    if err != nil {
        return err
    }

    return s.Queries().CreateRoom(ctx, db.CreateRoomParams{ID: r.ID, Code: r.Code, State: b})
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
    queries := s.Queries().WithTx(tx)
    raw, err := queries.LockRoomState(ctx, strings.ToUpper(code))

    if errors.Is(err, pgx.ErrNoRows) {
        return nil, 0, ErrNotFound
    }

    if err != nil {
        return nil, 0, err
    }

    now, err := queries.DatabaseTime(ctx)

    if err != nil {
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
            inserted, err := queries.InsertAcceptedAnswer(ctx, db.InsertAcceptedAnswerParams{
                AttemptID:  p.AttemptID,
                QuestionID: p.QuestionID,
                RoomID:     r.ID,
                RoundID:    a.RoundID,
                SessionID:  a.SessionID,
                Choice:     p.Choice,
                Points:     p.Points,
                AcceptedAt: time.UnixMilli(p.AcceptedAt),
            })

            if err != nil {
                return nil, 0, err
            }

            if inserted != 1 {
                return nil, 0, errors.New("Durable answer conflict; transaction aborted")
            }
        }

        if err = queries.UpdateRoomState(ctx, db.UpdateRoomStateParams{State: after, ID: r.ID}); err != nil {
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
    codes, err := s.Queries().ListDueRoomCodes(ctx)

    if err != nil {
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

    row, err := s.Queries().ViewRoomState(ctx, code)

    if errors.Is(err, pgx.ErrNoRows) {
        return nil, 0, ErrNotFound
    }

    if err != nil {
        return nil, 0, err
    }

    var room rooms.Room

    if err = json.Unmarshal(row.State, &room); err != nil {
        return nil, 0, err
    }

    cacheCtx, cancel = context.WithTimeout(ctx, 10*time.Millisecond)
    _ = s.Redis.Set(cacheCtx, "room:"+code, row.State, 200*time.Millisecond).Err()
    cancel()

    return &room, row.ObservedAt.UnixMilli(), nil
}
