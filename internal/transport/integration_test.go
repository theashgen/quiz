package transport

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "net/http/cookiejar"
    "net/http/httptest"
    "net/url"
    "os"
    "path/filepath"
    "quiz/internal/content"
    "quiz/internal/rooms"
    "quiz/internal/sessions"
    "quiz/internal/storage"
    "strings"
    "sync"
    "testing"
    "time"

    "github.com/coder/websocket"
    "github.com/coder/websocket/wsjson"
    "github.com/jackc/pgx/v5/pgxpool"
)

func integrationStore(t *testing.T) *storage.Store {
    t.Helper()
    dsn := os.Getenv("TEST_DATABASE_URL")

    if dsn == "" {
        t.Skip("set TEST_DATABASE_URL to run PostgreSQL integration tests")
    }

    ctx := context.Background()
    base, err := pgxpool.New(ctx, dsn)

    if err != nil {
        t.Fatal(err)
    }

    schema := "test_" + content.ID()

    if _, err = base.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
        t.Fatal(err)
    }

    u, err := url.Parse(dsn)

    if err != nil {
        t.Fatal(err)
    }

    q := u.Query()
    q.Set("search_path", schema)
    u.RawQuery = q.Encode()
    redisURL := os.Getenv("TEST_REDIS_URL")

    if redisURL == "" {
        redisURL = "redis://localhost:56379/0"
    }

    s, err := storage.Open(ctx, u.String(), redisURL)

    if err != nil {
        t.Fatal(err)
    }

    if err = s.Migrate(ctx, filepath.Join("..", "..", "migrations")); err != nil {
        t.Fatal(err)
    }

    t.Cleanup(func() {
        s.Close()
        _, _ = base.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
        base.Close()
    })

    return s
}

func seedSession(t *testing.T, s *storage.Store, id string) {
    t.Helper()
    _, err := s.DB.Exec(context.Background(), "INSERT INTO guest_sessions(id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 day')", id, id)

    if err != nil {
        t.Fatal(err)
    }
}

func seededRoom(t *testing.T, s *storage.Store) *rooms.Room {
    t.Helper()
    seedSession(t, s, "host")
    seedSession(t, s, "player")
    q := []content.Question{
        {
            ID:   "q1",
            Text: "Q1",
            Options: []string{
                "A",
                "B",
                "C",
                "D",
            },
            Correct: 0,
        },
        {
            ID:   "q2",
            Text: "Q2",
            Options: []string{
                "A",
                "B",
                "C",
                "D",
            },
            Correct: 0,
        },
    }
    r := rooms.New("ABC123", "host", content.Setup{
        Source: "custom",
        Timer:  10,
        Name:   "Host",
        Avatar: "🦉",
    }, q, time.Now().UnixMilli(), false)
    _ = r.Join("player", "Player", "🐼")
    r.Members["host"].Owner = "host-tab"
    r.Members["player"].Owner = "tab"

    if err := r.Start(time.Now().UnixMilli()); err != nil {
        t.Fatal(err)
    }

    if err := s.Create(context.Background(), r); err != nil {
        t.Fatal(err)
    }

    return r
}

func TestTransactionalAnswersOwnershipRecovery(t *testing.T) {
    s := integrationStore(t)
    r := seededRoom(t, s)
    app := New(s, "https://example.test", "")
    ctx := context.Background()
    a := r.Current().Attempts["player"]
    qid := a.Question(r.Current().Questions).ID
    choice := 0
    command := Command{
        Type:       "answer",
        RoundID:    r.Current().ID,
        QuestionID: qid,
        Choice:     &choice,
    }
    var wg sync.WaitGroup
    errs := make(chan error, 40)

    for i := 0; i < 40; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            receipt, err := app.command(ctx, r.Code, "player", "tab", command)

            if err != nil {
                errs <- err
            } else if receipt.Points != 100 {
                errs <- fmt.Errorf("receipt: %+v", receipt)
            }
        }()
    }

    wg.Wait()
    close(errs)

    for err := range errs {
        t.Error(err)
    }

    var count, points int

    if err := s.DB.QueryRow(ctx, "SELECT count(*),sum(points) FROM accepted_answers").Scan(&count, &points); err != nil {
        t.Fatal(err)
    }

    if count != 1 || points != 100 {
        t.Fatalf("duplicate score: %d/%d", count, points)
    }

    recovered, _, err := s.Mutate(ctx, r.Code, nil)

    if err != nil {
        t.Fatal(err)
    }

    if recovered.Current().Attempts["player"].Score != 100 {
        t.Fatal("score did not persist")
    }

    // A different durable connection owner fences even commands already read by an old socket.
    _, _, err = s.Mutate(ctx, r.Code, func(room *rooms.Room, now int64) error {
        room.Members["player"].Owner = "new-tab"

        return nil
    })

    if err != nil {
        t.Fatal(err)
    }

    if _, err = app.command(ctx, r.Code, "player", "tab", command); err == nil {
        t.Fatal("stale tab was authorized")
    }

    if _, err = app.command(ctx, r.Code, "player", "new-tab", Command{
        Type:    "configure",
        RoundID: r.Current().ID,
    }); err == nil {
        t.Fatal("player gained host authority")
    }

    // Simulate durable timestamps left behind by an outage; next reconciliation catches up.
    _, _, err = s.Mutate(ctx, r.Code, func(room *rooms.Room, now int64) error {
        attempt := room.Current().Attempts["player"]
        attempt.RevealUntil = now - 14000

        return nil
    })

    if err != nil {
        t.Fatal(err)
    }

    recovered, _, err = s.Mutate(ctx, r.Code, nil)

    if err != nil || recovered.Status != "results" {
        t.Fatalf("outage catchup %v %+v", err, recovered)
    }

    if recovered.Current().Attempts["player"].Score != 100 {
        t.Fatal("catchup changed points")
    }

    if err = s.DB.QueryRow(ctx, "SELECT count(*) FROM accepted_answers").Scan(&count); err != nil || count != 2 {
        t.Fatal("timeout not durably recorded", err, count)
    }

    // A restarted service reads the same finished attempt without Redis or client state.
    restarted := New(s, "https://example.test", "")

    if _, err = restarted.command(ctx, r.Code, "player", "new-tab", command); err != nil {
        t.Fatal("committed retry lost across service restart", err)
    }

    prepare := Command{
        Type:    "prepare",
        RoundID: r.Current().ID,
    }

    if _, err = app.command(ctx, r.Code, "player", "new-tab", prepare); err == nil {
        t.Fatal("player could announce host preparation")
    }

    _, preparing, err := app.commandSnapshot(ctx, r.Code, "host", "host-tab", prepare)

    if err != nil || !preparing.PreparingNextQuiz {
        t.Fatal("host preparation was not announced", err)
    }

    recovered, now, err := s.Mutate(ctx, r.Code, nil)

    if err != nil || !recovered.Snapshot("player", now).PreparingNextQuiz {
        t.Fatal("waiting player did not receive durable preparation status", err)
    }

    _, cancelled, err := app.commandSnapshot(ctx, r.Code, "host", "host-tab", Command{
        Type:    "cancel_prepare",
        RoundID: r.Current().ID,
    })

    if err != nil || cancelled.PreparingNextQuiz {
        t.Fatal("returning to results did not clear preparation status", err)
    }

    if _, err = app.command(ctx, r.Code, "host", "host-tab", prepare); err != nil {
        t.Fatal(err)
    }

    _, lobby, err := app.commandSnapshot(ctx, r.Code, "host", "host-tab", Command{
        Type:    "configure",
        RoundID: r.Current().ID,
        Setup: &content.Setup{
            Source:     "preset",
            Categories: []string{"Science"},
            Count:      5,
            Timer:      10,
        },
    })

    if err != nil || lobby.Status != "lobby" || lobby.PreparingNextQuiz {
        t.Fatal("opening next lobby did not clear preparation status", err)
    }
}

func TestHTTPWebSocketSessionAndTakeover(t *testing.T) {
    store := integrationStore(t)
    app := New(store, "", "")
    server := httptest.NewTLSServer(app.Handler())
    defer server.Close()
    app.Origins = []string{server.URL}
    client := server.Client()
    jar, _ := cookiejar.New(nil)
    client.Jar = jar
    request := func(path string, body string) *http.Response {
        t.Helper()
        req, _ := http.NewRequest("POST", server.URL+path, strings.NewReader(body))
        req.Header.Set("Origin", server.URL)
        req.Header.Set("Content-Type", "application/json")
        response, e := client.Do(req)

        if e != nil {
            t.Fatal(e)
        }

        return response
    }
    response := request("/api/session", "{}")
    cookies := response.Cookies()
    response.Body.Close()

    if len(cookies) != 1 || !cookies[0].HttpOnly || !cookies[0].Secure || cookies[0].SameSite != http.SameSiteLaxMode || cookies[0].Name != sessions.CookieName {
        t.Fatal("insecure guest cookie")
    }

    response = request("/api/auth/signup", `{"name":"Host","email":"host@example.com","password":"a strong test passphrase","role":"teacher"}`)
    if response.StatusCode != http.StatusCreated {
        t.Fatal("teacher signup failed", response.StatusCode)
    }
    response.Body.Close()
    response = request("/api/rooms", `{"source":"preset","categories":["Science"],"count":5,"timer":10,"participate":true,"name":"Host","avatar":"🦉"}`)
    var created struct{ Code string }
    _ = json.NewDecoder(response.Body).Decode(&created)
    response.Body.Close()

    if created.Code == "" {
        t.Fatal("create failed")
    }

    response = request("/api/rooms/"+strings.ToLower(created.Code)+"/join", `{"name":"Host","avatar":"🦉"}`)
    var joined struct{ Code string }
    err := json.NewDecoder(response.Body).Decode(&joined)
    response.Body.Close()

    if err != nil || response.StatusCode != http.StatusOK || joined.Code != created.Code {
        t.Fatalf("join route failed: status=%d code=%q error=%v", response.StatusCode, joined.Code, err)
    }

    ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
    defer cancel()
    dial := func(mode, owner string) *websocket.Conn {
        t.Helper()
        headers := http.Header{"Origin": []string{server.URL}}
        c, _, e := websocket.Dial(ctx, strings.Replace(server.URL, "https:", "wss:", 1)+"/api/rooms/"+created.Code+"/ws?mode="+mode+"&owner="+owner, &websocket.DialOptions{
            HTTPClient: client,
            HTTPHeader: headers,
        })

        if e != nil {
            t.Fatal(e)
        }

        t.Cleanup(func() {
            c.CloseNow()
        })

        return c
    }
    read := func(c *websocket.Conn) Event {
        t.Helper()
        var e Event

        if err := wsjson.Read(ctx, c, &e); err != nil {
            t.Fatal(err)
        }

        return e
    }
    firstNonce := "11111111-1111-4111-8111-111111111111"
    first := dial("claim", firstNonce)
    owned := read(first)

    if owned.Type != "owned" {
        t.Fatalf("ownership: %+v", owned)
    }

    snap := read(first)

    if snap.Snapshot == nil {
        t.Fatal("no snapshot")
    }

    sameClaim := dial("claim", firstNonce)

    if e := read(sameClaim); e.Type != "owned" || e.Owner != owned.Owner {
        t.Fatalf("claim retry changed ownership: %+v", e)
    }

    second := dial("claim", "")
    newOwned := read(second)

    if newOwned.Owner == owned.Owner {
        t.Fatal("owner not rotated")
    }

    oldClaimRetry := dial("claim", firstNonce)

    if e := read(oldClaimRetry); e.Type != "displaced" {
        t.Fatalf("lost-ack retry reclaimed ownership: %+v", e)
    }

    resumedOld := dial("resume", owned.Owner)

    if e := read(resumedOld); e.Type != "displaced" {
        t.Fatalf("stale reconnect must stop: %+v", e)
    }

    choice := 0
    _, err = app.command(ctx, created.Code, snap.Snapshot.Me, owned.Owner, Command{
        Type:    "start",
        RoundID: snap.Snapshot.RoundID,
        Choice:  &choice,
    })

    if err == nil {
        t.Fatal("displaced host could start")
    }

    req, _ := http.NewRequest("POST", server.URL+"/api/session", strings.NewReader("{}"))
    req.Header.Set("Origin", "https://evil.test")
    resp, err := client.Do(req)

    if err != nil {
        t.Fatal(err)
    }

    resp.Body.Close()

    if resp.StatusCode != 403 {
        t.Fatal("cross-origin mutation allowed")
    }

    // Room codes alone never identify the existing participant.
    outsider := &http.Client{Transport: server.Client().Transport}
    resp, err = outsider.Get(server.URL + "/api/rooms/" + created.Code)

    if err != nil {
        t.Fatal(err)
    }

    resp.Body.Close()

    if resp.StatusCode != 401 {
        t.Fatal("code granted authority")
    }

    // A fresh HTTP/WebSocket service restores the cookie identity and the original deadline.
    _, started, err := app.commandSnapshot(ctx, created.Code, snap.Snapshot.Me, newOwned.Owner, Command{
        Type:    "start",
        RoundID: snap.Snapshot.RoundID,
    })

    if err != nil {
        t.Fatal(err)
    }

    deadline := started.Personal.Deadline
    questionID := started.Personal.Question.ID
    first.CloseNow()
    second.CloseNow()
    sameClaim.CloseNow()
    server.Close()
    restarted := New(store, "", "")
    next := httptest.NewTLSServer(restarted.Handler())
    defer next.Close()
    restarted.Origins = []string{next.URL}
    restoredClient := next.Client()
    restoredClient.Jar = client.Jar
    resp, err = restoredClient.Get(next.URL + "/api/rooms/" + created.Code)

    if err != nil {
        t.Fatal(err)
    }

    var restored rooms.Snapshot
    err = json.NewDecoder(resp.Body).Decode(&restored)
    resp.Body.Close()

    if err != nil {
        t.Fatal(err)
    }

    if restored.Me != snap.Snapshot.Me || restored.Personal == nil || restored.Personal.Deadline != deadline || restored.Personal.Question.ID != questionID {
        t.Fatal("service restart reset identity or question deadline")
    }

    restoredWS, _, err := websocket.Dial(ctx, strings.Replace(next.URL, "https:", "wss:", 1)+"/api/rooms/"+created.Code+"/ws?mode=resume&owner="+newOwned.Owner, &websocket.DialOptions{
        HTTPClient: restoredClient,
        HTTPHeader: http.Header{"Origin": []string{next.URL}},
    })

    if err != nil {
        t.Fatal(err)
    }

    defer restoredWS.CloseNow()

    if event := read(restoredWS); event.Type != "owned" || event.Owner != newOwned.Owner {
        t.Fatal("same-owner resume failed")
    }
}

func TestAnswerInsertFailureRollsBackAndRedisLossIsNonAuthoritative(t *testing.T) {
    s := integrationStore(t)
    r := seededRoom(t, s)
    app := New(s, "https://example.test", "")
    ctx := context.Background()
    choice := 0
    qid := r.Current().Attempts["player"].Question(r.Current().Questions).ID
    command := Command{
        Type:       "answer",
        RoundID:    r.Current().ID,
        QuestionID: qid,
        Choice:     &choice,
    }

    if _, err := s.DB.Exec(ctx, "ALTER TABLE accepted_answers ADD CONSTRAINT injected_failure CHECK(false) NOT VALID"); err != nil {
        t.Fatal(err)
    }

    if _, err := app.command(ctx, r.Code, "player", "tab", command); err == nil {
        t.Fatal("uncommitted answer acknowledged")
    }

    recovered, _, err := s.Mutate(ctx, r.Code, nil)

    if err != nil {
        t.Fatal(err)
    }

    attempt := recovered.Current().Attempts["player"]

    if attempt.Score != 0 || len(attempt.Answers) != 0 || attempt.Phase != "question" {
        t.Fatal("failed insertion left partial progress")
    }

    if _, err = s.DB.Exec(ctx, "ALTER TABLE accepted_answers DROP CONSTRAINT injected_failure"); err != nil {
        t.Fatal(err)
    }

    // Closing this test's Redis client forces all cache updates to fail.
    _ = s.Redis.Close()
    receipt, err := app.command(ctx, r.Code, "player", "tab", command)

    if err != nil || receipt.Points != 100 {
        t.Fatalf("Redis failure rejected durable answer: %+v %v", receipt, err)
    }

    retry, err := app.command(ctx, r.Code, "player", "tab", command)

    if err != nil || retry.Points != 100 {
        t.Fatal("retry lost without Redis", err)
    }

    recovered, _, err = s.Mutate(ctx, r.Code, nil)

    if err != nil || recovered.Current().Attempts["player"].Score != 100 {
        t.Fatal("Redis loss changed durable score", err)
    }
}
