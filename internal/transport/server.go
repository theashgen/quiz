package transport

import (
    "context"
    "crypto/rand"
    "encoding/json"
    "errors"
    "io"
    "log/slog"
    "math/big"
    "net/http"
    "os"
    "path/filepath"
    "quiz/internal/content"
    "quiz/internal/gameplay"
    "quiz/internal/rooms"
    "quiz/internal/sessions"
    "quiz/internal/storage"
    "strings"
    "sync"
    "time"

    "github.com/coder/websocket"
    "github.com/coder/websocket/wsjson"
    "github.com/gorilla/mux"
)

type Server struct {
    Store     *storage.Store
    Origins   []string
    Static    string
    mu        sync.Mutex
    listeners map[string]map[chan struct{}]bool
}

func New(s *storage.Store, origins, static string) *Server {
    return &Server{
        Store:     s,
        Origins:   strings.Split(origins, ","),
        Static:    static,
        listeners: map[string]map[chan struct{}]bool{},
    }
}

func (s *Server) allowed(r *http.Request) bool {
    o := r.Header.Get("Origin")

    for _, v := range s.Origins {
        if o == v {
            return true
        }
    }

    return false
}

func write(w http.ResponseWriter, status int, v any) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, err error) {
    write(w, status, map[string]string{"error": err.Error()})
}

func decode(w http.ResponseWriter, r *http.Request, v any) error {
    r.Body = http.MaxBytesReader(w, r.Body, 8<<20)
    d := json.NewDecoder(r.Body)
    d.DisallowUnknownFields()

    if err := d.Decode(v); err != nil {
        return errors.New("Invalid JSON or request exceeds 8 MiB")
    }

    var extra any

    if err := d.Decode(&extra); err != io.EOF {
        return errors.New("Expected a single JSON object")
    }

    return nil
}

func (s *Server) Handler() http.Handler {
    router := mux.NewRouter()
    router.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
        ctx, cancel := context.WithTimeout(r.Context(), time.Second)
        defer cancel()

        if err := s.Store.DB.Ping(ctx); err != nil {
            fail(w, 503, errors.New("PostgreSQL unavailable"))

            return
        }

        redisOK := s.Store.Redis.Ping(ctx).Err() == nil
        write(w, 200, map[string]any{
            "ok":    true,
            "redis": redisOK,
        })
    }).Methods(http.MethodGet, http.MethodHead)
    router.HandleFunc("/api/catalog", func(w http.ResponseWriter, r *http.Request) {
        write(w, 200, map[string]any{
            "categories": content.Categories(),
            "avatars":    content.Avatars,
            "lengths": []int{
                5,
                10,
                15,
            },
            "timers":     []int{10},
            "provenance": "Original development trivia; not a finalized content catalog.",
        })
    }).Methods(http.MethodGet, http.MethodHead)
    router.HandleFunc("/api/session", func(w http.ResponseWriter, r *http.Request) {
        id, err := sessions.Ensure(r.Context(), s.Store, w, r)

        if err != nil {
            fail(w, 503, errors.New("Unable to start session"))

            return
        }

        write(w, 200, map[string]string{"id": id})
    }).Methods(http.MethodPost)
    router.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
        s.create(w, r, false)
    }).Methods(http.MethodPost)
    router.HandleFunc("/api/solo", func(w http.ResponseWriter, r *http.Request) {
        s.create(w, r, true)
    }).Methods(http.MethodPost)
    router.HandleFunc("/api/rooms/{code}/join", s.join).Methods(http.MethodPost)
    router.HandleFunc("/api/rooms/{code}", s.snapshot).Methods(http.MethodGet, http.MethodHead)
    router.HandleFunc("/api/rooms/{code}/ws", s.socket).Methods(http.MethodGet, http.MethodHead)
    router.PathPrefix("/api/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        fail(w, 404, errors.New("Endpoint not found"))
    })
    router.PathPrefix("/").HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if r.Method != "GET" && r.Method != "HEAD" {
            http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)

            return
        }

        if s.Static == "" {
            http.NotFound(w, r)

            return
        }

        path := filepath.Join(s.Static, filepath.Clean("/"+r.URL.Path))

        if info, err := os.Stat(path); err == nil && !info.IsDir() {
            http.ServeFile(w, r, path)

            return
        }

        if strings.Contains(filepath.Base(r.URL.Path), ".") {
            http.NotFound(w, r)

            return
        }

        http.ServeFile(w, r, filepath.Join(s.Static, "index.html"))
    })

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", "no-store")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("Referrer-Policy", "same-origin")
        w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'")

        if r.Method != "GET" && !s.allowed(r) {
            fail(w, 403, errors.New("Request origin is not allowed"))

            return
        }

        router.ServeHTTP(w, r)
    })
}

func (s *Server) identity(w http.ResponseWriter, r *http.Request) (string, bool) {
    id, err := sessions.Get(r.Context(), s.Store, r)

    if err != nil {
        if errors.Is(err, sessions.ErrRequired) || errors.Is(err, sessions.ErrExpired) {
            fail(w, 401, err)
        } else {
            fail(w, 503, errors.New("Guest session service unavailable; reconnecting"))
        }

        return "", false
    }

    return id, true
}

func roomCode() string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    b := make([]byte, 6)

    for i := range b {
        n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))

        if err != nil {
            panic(err)
        }

        b[i] = alphabet[n.Int64()]
    }

    return string(b)
}

func (s *Server) create(w http.ResponseWriter, r *http.Request, solo bool) {
    id, ok := s.identity(w, r)

    if !ok {
        return
    }

    var setup content.Setup

    if err := decode(w, r, &setup); err != nil {
        fail(w, 400, err)

        return
    }

    if solo {
        setup.Name = "You"
        setup.Avatar = content.Avatars[0]
        setup.Participate = true
    }

    name, avatar, err := content.Identity(setup.Name, setup.Avatar)

    if err != nil {
        fail(w, 400, err)

        return
    }

    setup.Name = name
    setup.Avatar = avatar
    qs, err := content.Build(setup, solo)

    if err != nil {
        fail(w, 400, err)

        return
    }

    for i := 0; i < 8; i++ {
        room := rooms.New(roomCode(), id, setup, qs, time.Now().UnixMilli(), solo)

        if solo {
            _ = room.Start(time.Now().UnixMilli())
        }

        if err = s.Store.Create(r.Context(), room); err == nil {
            write(w, 201, map[string]string{"code": room.Code})

            return
        }
    }

    slog.Error("create room", "error", err)
    fail(w, 503, errors.New("Room creation unavailable; retry shortly"))
}

func (s *Server) join(w http.ResponseWriter, r *http.Request) {
    id, ok := s.identity(w, r)

    if !ok {
        return
    }

    var in struct {
        Name   string `json:"name"`
        Avatar string `json:"avatar"`
    }

    if err := decode(w, r, &in); err != nil {
        fail(w, 400, err)

        return
    }

    code := strings.ToUpper(mux.Vars(r)["code"])
    _, _, err := s.Store.Mutate(r.Context(), code, func(room *rooms.Room, now int64) error {
        if _, exists := room.Members[id]; exists {
            return nil
        }

        name, avatar, e := content.Identity(in.Name, in.Avatar)

        if e != nil {
            return e
        }

        return room.Join(id, name, avatar)
    })

    if err != nil {
        fail(w, 400, err)

        return
    }

    write(w, 200, map[string]string{"code": code})
}

func (s *Server) snapshot(w http.ResponseWriter, r *http.Request) {
    id, ok := s.identity(w, r)

    if !ok {
        return
    }

    room, now, err := s.Store.Mutate(r.Context(), mux.Vars(r)["code"], func(room *rooms.Room, now int64) error {
        if room.Members[id] == nil {
            return errors.New("Join this room first")
        }

        return nil
    })

    if err != nil {
        if errors.Is(err, storage.ErrNotFound) {
            fail(w, 404, err)
        } else if room == nil {
            fail(w, 503, errors.New("Session state unavailable; reconnecting"))
        } else {
            fail(w, 403, err)
        }

        return
    }

    write(w, 200, room.Snapshot(id, now))
}

type Command struct {
    Type       string         `json:"type"`
    RequestID  string         `json:"requestId"`
    RoundID    string         `json:"roundId"`
    QuestionID string         `json:"questionId"`
    Choice     *int           `json:"choice"`
    Setup      *content.Setup `json:"setup,omitempty"`
}

type Event struct {
    Type      string            `json:"type"`
    RequestID string            `json:"requestId,omitempty"`
    Owner     string            `json:"owner,omitempty"`
    Snapshot  *rooms.Snapshot   `json:"snapshot,omitempty"`
    Receipt   *gameplay.Receipt `json:"receipt,omitempty"`
    Error     string            `json:"error,omitempty"`
}

func (s *Server) command(ctx context.Context, code, id, owner string, c Command) (*gameplay.Receipt, error) {
    receipt, _, err := s.commandSnapshot(ctx, code, id, owner, c)

    return receipt, err
}

func (s *Server) commandSnapshot(ctx context.Context, code, id, owner string, c Command) (*gameplay.Receipt, *rooms.Snapshot, error) {
    var receipt *gameplay.Receipt
    room, now, err := s.Store.Mutate(ctx, code, func(r *rooms.Room, now int64) error {
        m := r.Members[id]

        if m == nil || m.Owner != owner {
            return errors.New("This session is active in another tab")
        }

        if r.Status == "expired" {
            return errors.New("This lobby expired before it started")
        }

        if c.RoundID != r.Current().ID {
            return errors.New("This command belongs to an earlier quiz")
        }

        switch c.Type {
        case "answer":
            a := r.Current().Attempts[id]
            if a == nil {
                return errors.New("You are hosting without answering")
            }
            if c.Choice == nil {
                return errors.New("Choose an answer")
            }
            result, e := a.Answer(r.Current().Questions, c.QuestionID, *c.Choice, now)
            if e != nil {
                return e
            }
            receipt = &result
        case "start":
            if id != r.Host {
                return errors.New("Only the original host can start")
            }
            return r.Start(now)
        case "replay":
            if r.Solo {
                return errors.New("Start another solo quiz from the homepage")
            }
            if r.Status == "results" {
                m.Replay = true
            } else if r.Status == "lobby" {
                if id == r.Host && r.Current().Source == "custom" {
                    return errors.New("Custom creators cannot answer")
                }

                m.Enrolled = true
            } else {
                return errors.New("Wait for final results to request replay")
            }
        case "prepare", "cancel_prepare":
            if id != r.Host || r.Solo {
                return errors.New("Only the multiplayer host can prepare the next quiz")
            }
            if r.Status != "results" {
                return errors.New("Wait until everyone finishes before preparing another quiz")
            }
            r.PreparingNextQuiz = c.Type == "prepare"
        case "configure":
            if id != r.Host || r.Solo {
                return errors.New("Only the multiplayer host can configure the next quiz")
            }
            if c.Setup == nil {
                return errors.New("Quiz configuration missing")
            }
            qs, e := content.Build(*c.Setup, false)
            if e != nil {
                return e
            }
            return r.Configure(*c.Setup, qs, now)
        default:
            return errors.New("Unknown command")
        }

        return nil
    })

    if err != nil {
        return receipt, nil, err
    }

    snapshot := room.Snapshot(id, now)

    return receipt, &snapshot, nil
}

func (s *Server) subscribe(code string) chan struct{} {
    ch := make(chan struct{}, 1)
    s.mu.Lock()
    defer s.mu.Unlock()

    if s.listeners[code] == nil {
        s.listeners[code] = map[chan struct{}]bool{}
    }

    s.listeners[code][ch] = true

    return ch
}

func (s *Server) unsubscribe(code string, ch chan struct{}) {
    s.mu.Lock()
    defer s.mu.Unlock()
    delete(s.listeners[code], ch)

    if len(s.listeners[code]) == 0 {
        delete(s.listeners, code)
    }
}

func (s *Server) signal(code string) {
    s.mu.Lock()
    defer s.mu.Unlock()

    for ch := range s.listeners[code] {
        select {
        case ch <- struct{}{}:
        default:
        }
    }
}

func (s *Server) Run(ctx context.Context) {
    go func() {
        tick := time.NewTicker(100 * time.Millisecond)
        defer tick.Stop()

        for {
            select {
            case <-ctx.Done():
                return
            case <-tick.C:
                work, cancel := context.WithTimeout(ctx, 5*time.Second)
                err := s.Store.Due(work)
                cancel()
                if err != nil && ctx.Err() == nil {
                    slog.Warn("deadline reconciliation", "error", err)
                }
            }
        }
    }()
    go func() {
        sub := s.Store.Redis.Subscribe(ctx, "quiz:updates")
        defer sub.Close()

        for {
            select {
            case <-ctx.Done():
                return
            case msg, ok := <-sub.Channel():
                if !ok {
                    return
                }
                s.signal(msg.Payload)
            }
        }
    }()
}

func (s *Server) socket(w http.ResponseWriter, r *http.Request) {
    if !s.allowed(r) {
        fail(w, 403, errors.New("WebSocket origin is not allowed"))

        return
    }

    id, ok := s.identity(w, r)

    if !ok {
        return
    }

    expires, sessionErr := sessions.Expires(r.Context(), s.Store, id)

    if sessionErr != nil {
        fail(w, 503, errors.New("Your guest session is unavailable or expired"))

        return
    }

    code := strings.ToUpper(mux.Vars(r)["code"])
    mode := r.URL.Query().Get("mode")
    owner := r.URL.Query().Get("owner")

    if mode != "claim" && mode != "resume" {
        fail(w, 400, errors.New("Choose claim or resume"))

        return
    }

    if mode == "claim" {
        if owner == "" {
            owner = content.ID()
        } else if len(owner) != 36 {
            fail(w, 400, errors.New("Invalid tab nonce"))

            return
        }
    }

    _, _, err := s.Store.Mutate(r.Context(), code, func(room *rooms.Room, now int64) error {
        m := room.Members[id]

        if m == nil {
            return errors.New("Join this room first")
        }

        if mode == "resume" && m.Owner != owner {
            return errors.New("This session is active in another tab")
        }

        if mode == "claim" {
            if m.SeenOwners == nil {
                m.SeenOwners = map[string]bool{}
            }

            if m.SeenOwners[owner] && m.Owner != owner {
                return errors.New("This session is active in another tab")
            }

            m.Owner = owner
            m.SeenOwners[owner] = true
        }

        return nil
    })

    if err != nil {
        if err.Error() == "This session is active in another tab" {
            c, e := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})

            if e == nil {
                defer c.CloseNow()
                _ = wsjson.Write(r.Context(), c, Event{
                    Type:  "displaced",
                    Error: err.Error(),
                })
                _ = c.Close(websocket.StatusPolicyViolation, "tab replaced")
            }

            return
        }

        fail(w, 409, err)

        return
    }

    conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{InsecureSkipVerify: true})

    if err != nil {
        return
    }

    defer conn.CloseNow()
    conn.SetReadLimit(8 << 20)
    ctx, cancel := context.WithDeadline(r.Context(), expires)
    defer cancel()
    send := func(e Event) error {
        c, stop := context.WithTimeout(ctx, 5*time.Second)
        defer stop()

        return wsjson.Write(c, conn, e)
    }

    if send(Event{
        Type:  "owned",
        Owner: owner,
    }) != nil {
        return
    }

    notices := s.subscribe(code)
    defer s.unsubscribe(code, notices)
    commands := make(chan Command, 8)
    readErr := make(chan error, 1)
    go func() {
        for {
            var c Command

            if err := wsjson.Read(ctx, conn, &c); err != nil {
                readErr <- err

                return
            }

            select {
            case commands <- c:
            case <-ctx.Done():
                return
            }
        }
    }()
    tick := time.NewTicker(200 * time.Millisecond)
    defer tick.Stop()
    dirty := true
    last := time.Time{}

    for {
        if dirty && time.Since(last) >= 200*time.Millisecond {
            room, now, e := s.Store.View(ctx, code)

            if e != nil {
                _ = send(Event{
                    Type:  "error",
                    Error: "Connection lost; reconnecting",
                })

                return
            }

            m := room.Members[id]

            if m == nil || m.Owner != owner {

                // Cache invalidation races cannot revoke a valid durable claim.
                room, now, e = s.Store.Mutate(ctx, code, nil)

                if e != nil {
                    return
                }

                m = room.Members[id]
            }

            if m == nil || m.Owner != owner {
                _ = send(Event{
                    Type:  "displaced",
                    Error: "This session is active in another tab",
                })
                _ = conn.Close(websocket.StatusPolicyViolation, "tab replaced")

                return
            }

            snapshot := room.Snapshot(id, now)

            if send(Event{
                Type:     "snapshot",
                Snapshot: &snapshot,
            }) != nil {
                return
            }

            dirty = false
            last = time.Now()
            cacheCtx, stop := context.WithTimeout(ctx, 50*time.Millisecond)
            _ = s.Store.Redis.Set(cacheCtx, "presence:"+code+":"+id, owner, 3*time.Second).Err()
            stop()
        }

        select {
        case <-ctx.Done():
            return
        case <-readErr:
            return
        case <-notices:
            dirty = true
        case <-tick.C:
            if time.Since(last) >= time.Second {
                dirty = true
            }
        case c := <-commands:
            receipt, snapshot, e := s.commandSnapshot(ctx, code, id, owner, c)
            if e != nil {
                if send(Event{
                    Type:      "error",
                    RequestID: c.RequestID,
                    Error:     e.Error(),
                }) != nil {
                    return
                }
            } else {
                if send(Event{
                    Type:      "ack",
                    RequestID: c.RequestID,
                    Receipt:   receipt,
                    Snapshot:  snapshot,
                }) != nil {
                    return
                }

                s.signal(code)
            }
            dirty = true
        }
    }
}
