// Command loadtest exercises one real room through HTTPS and WebSockets.
package main

import (
    "bytes"
    "context"
    "crypto/tls"
    "encoding/json"
    "flag"
    "fmt"
    "net/http"
    "net/http/cookiejar"
    "net/url"
    "os"
    "quiz/internal/content"
    "quiz/internal/rooms"
    "quiz/internal/transport"
    "sort"
    "strings"
    "sync"
    "time"

    "github.com/coder/websocket"
    "github.com/coder/websocket/wsjson"
)

type robot struct {
    id        string
    points    int
    client    *http.Client
    conn      *websocket.Conn
    name      string
    mu        sync.Mutex
    sent      map[string]time.Time
    seen      map[string]bool
    latencies []float64
    answers   int
}

func main() {
    base := flag.String("url", "https://localhost:8443", "same-origin app URL")
    players := flag.Int("players", 150, "answering players, excluding host")
    insecure := flag.Bool("insecure-local", true, "allow this project's self-signed certificate, localhost only")
    timeout := flag.Duration("timeout", 2*time.Minute, "whole-run timeout")
    output := flag.String("output", "", "optional JSON report path")
    flag.Parse()
    u, e := url.Parse(*base)

    if e != nil {
        panic(e)
    }

    if *insecure && u.Hostname() != "localhost" && u.Hostname() != "127.0.0.1" {
        fatal(fmt.Errorf("-insecure-local is restricted to localhost"))
    }

    if *players < 1 {
        fatal(fmt.Errorf("players must be positive"))
    }

    ctx, cancel := context.WithTimeout(context.Background(), *timeout)
    defer cancel()
    newRobot := func(name string) *robot {
        jar, _ := cookiejar.New(nil)

        return &robot{
            client: &http.Client{
                Jar:     jar,
                Timeout: 15 * time.Second,
                Transport: &http.Transport{
                    TLSClientConfig:     &tls.Config{InsecureSkipVerify: *insecure},
                    MaxIdleConns:        200,
                    MaxIdleConnsPerHost: 20,
                },
            },
            name: name,
            sent: map[string]time.Time{},
            seen: map[string]bool{},
        }
    }
    post := func(r *robot, path string, body any, out any) error {
        b, _ := json.Marshal(body)
        req, e := http.NewRequestWithContext(ctx, "POST", *base+path, bytes.NewReader(b))

        if e != nil {
            return e
        }

        req.Header.Set("Origin", *base)
        req.Header.Set("Content-Type", "application/json")
        resp, e := r.client.Do(req)

        if e != nil {
            return e
        }

        defer resp.Body.Close()

        if resp.StatusCode >= 300 {
            var body any
            _ = json.NewDecoder(resp.Body).Decode(&body)

            return fmt.Errorf("%s: %d %v", path, resp.StatusCode, body)
        }

        if out != nil {
            return json.NewDecoder(resp.Body).Decode(out)
        }

        return nil
    }
    dial := func(r *robot, code string) error {
        var e error
        r.conn, _, e = websocket.Dial(ctx, strings.Replace(*base, "https:", "wss:", 1)+"/api/rooms/"+code+"/ws?mode=claim", &websocket.DialOptions{
            HTTPClient: r.client,
            HTTPHeader: http.Header{"Origin": []string{*base}},
        })

        if e == nil {
            r.conn.SetReadLimit(8 << 20)
        }

        return e
    }
    write := func(r *robot, c transport.Command) error {
        r.mu.Lock()
        defer r.mu.Unlock()

        return wsjson.Write(ctx, r.conn, c)
    }
    read := func(r *robot) (transport.Event, error) {
        var event transport.Event
        err := wsjson.Read(ctx, r.conn, &event)

        return event, err
    }
    host := newRobot("Load host")

    if os.Getenv("QUIZ_TEACHER_EMAIL") == "" || os.Getenv("QUIZ_TEACHER_PASSWORD") == "" {
        fatal(fmt.Errorf("set QUIZ_TEACHER_EMAIL and QUIZ_TEACHER_PASSWORD for a registered teacher before load testing"))
    }
    if e = post(host, "/api/auth/login", map[string]string{"email": os.Getenv("QUIZ_TEACHER_EMAIL"), "password": os.Getenv("QUIZ_TEACHER_PASSWORD")}, nil); e != nil {
        fatal(e)
    }

    if e = post(host, "/api/session", map[string]any{}, nil); e != nil {
        fatal(e)
    }

    setup := content.Setup{
        Source: "preset",
        Categories: []string{
            "Science",
            "History",
            "Computers",
            "General Knowledge",
        },
        Count:       5,
        Timer:       10,
        Name:        host.name,
        Avatar:      "🦉",
        Participate: false,
    }
    var created struct {
        Code string `json:"code"`
    }

    if e = post(host, "/api/rooms", setup, &created); e != nil {
        fatal(e)
    }

    if e = dial(host, created.Code); e != nil {
        fatal(e)
    }

    defer host.conn.CloseNow()
    var round string

    for round == "" {
        event, err := read(host)

        if err != nil {
            fatal(err)
        }

        if event.Snapshot != nil {
            round = event.Snapshot.RoundID
        }
    }

    bots := make([]*robot, *players)
    errorsCh := make(chan error, *players+1)
    var joins sync.WaitGroup
    limit := make(chan struct{}, 12)
    joinedAt := time.Now()

    for i := range bots {
        bots[i] = newRobot(fmt.Sprintf("Player %03d", i+1))
        joins.Add(1)
        go func(r *robot) {
            defer joins.Done()
            limit <- struct{}{}
            defer func() {
                <-limit
            }()

            if err := post(r, "/api/session", map[string]any{}, nil); err != nil {
                errorsCh <- err

                return
            }

            if err := post(r, "/api/rooms/"+created.Code+"/join", map[string]any{
                "name":   r.name,
                "avatar": "🦊",
            }, nil); err != nil {
                errorsCh <- err

                return
            }

            if err := dial(r, created.Code); err != nil {
                errorsCh <- err

                return
            }
        }(bots[i])
    }

    joins.Wait()

    if len(errorsCh) > 0 {
        fatal(<-errorsCh)
    }

    for _, r := range bots {
        defer r.conn.CloseNow()
    }

    results := make(chan rooms.Snapshot, *players)
    var readers sync.WaitGroup

    for _, r := range bots {
        readers.Add(1)
        go func(r *robot) {
            defer readers.Done()

            for {
                event, err := read(r)

                if err != nil {
                    errorsCh <- fmt.Errorf("%s: %w", r.name, err)

                    return
                }

                if event.Type == "error" || event.Type == "displaced" {
                    errorsCh <- fmt.Errorf("%s: %s", r.name, event.Error)

                    return
                }

                if event.Type == "ack" && event.Receipt != nil {
                    if start, ok := r.sent[event.RequestID]; ok {
                        if event.Receipt.Choice == nil || *event.Receipt.Choice != 0 {
                            errorsCh <- fmt.Errorf("%s: answer missed its deadline", r.name)

                            return
                        }

                        r.points += event.Receipt.Points
                        r.latencies = append(r.latencies, float64(time.Since(start).Microseconds())/1000)
                        delete(r.sent, event.RequestID)
                    }
                }

                if s := event.Snapshot; s != nil {
                    r.id = s.Me

                    if s.Status == "results" {
                        results <- *s

                        return
                    }

                    if p := s.Personal; p != nil && p.Phase == "question" && !r.seen[p.Question.ID] {
                        r.seen[p.Question.ID] = true
                        r.answers++
                        choice := 0
                        id := r.name + ":" + p.Question.ID
                        r.sent[id] = time.Now()
                        command := transport.Command{
                            Type:       "answer",
                            RequestID:  id,
                            RoundID:    s.RoundID,
                            QuestionID: p.Question.ID,
                            Choice:     &choice,
                        }

                        if err = write(r, command); err == nil {
                            err = write(r, command)
                        }

                        if err != nil {
                            errorsCh <- err

                            return
                        }
                    }
                }
            }
        }(r)
    }

    start := time.Now()

    if e = write(host, transport.Command{
        Type:      "start",
        RequestID: "start",
        RoundID:   round,
    }); e != nil {
        fatal(e)
    }

    // Consume the non-playing host's live updates too, rather than leaving backpressure untested.
    go func() {
        for {
            if _, err := read(host); err != nil {
                return
            }
        }
    }()
    done := make(chan struct{})
    go func() {
        readers.Wait()
        close(done)
    }()

    select {
    case <-done:
    case <-ctx.Done():
        fatal(ctx.Err())
    }

    close(results)

    if len(errorsCh) > 0 {
        fatal(<-errorsCh)
    }

    all := []float64{}
    answered := 0

    for _, r := range bots {
        all = append(all, r.latencies...)
        answered += r.answers
    }

    sort.Float64s(all)

    if len(all) == 0 {
        fatal(fmt.Errorf("no committed answer acknowledgements"))
    }

    expected := map[string]int{}

    for _, r := range bots {
        expected[r.id] = r.points
    }

    completed := 0

    for result := range results {
        completed++

        if result.Total != *players || result.Finished != *players || len(result.Leaderboard) != *players {
            fatal(fmt.Errorf("incomplete leaderboard"))
        }

        for _, entry := range result.Leaderboard {
            want, ok := expected[entry.ID]

            if !ok || entry.Score != want || entry.Score < 0 || entry.Score > 500 || entry.Score%100 != 0 {
                fatal(fmt.Errorf("invalid score: %+v", entry))
            }
        }
    }

    if completed != *players || answered != *players*5 || len(all) != *players*5 {
        fatal(fmt.Errorf("missing answers/receipts: completed=%d answers=%d receipts=%d", completed, answered, len(all)))
    }

    percentile := func(p float64) float64 {
        return all[int(float64(len(all)-1)*p)]
    }
    report := map[string]any{
        "at":                 time.Now().UTC().Format(time.RFC3339),
        "players":            *players,
        "hostPlaying":        false,
        "questions":          5,
        "completed":          completed,
        "uniqueAnswerAcks":   len(all),
        "answerMessagesSent": answered * 2,
        "joinSeconds":        start.Sub(joinedAt).Seconds(),
        "gameSeconds":        time.Since(start).Seconds(),
        "ackMs": map[string]float64{
            "p50": percentile(.5),
            "p95": percentile(.95),
            "p99": percentile(.99),
            "max": all[len(all)-1],
        },
        "scope": "One room, native Go synthetic clients, local HTTPS+WebSocket; no browser rendering or multi-room capacity claim",
    }
    b, _ := json.MarshalIndent(report, "", "  ")
    fmt.Println(string(b))

    if *output != "" {
        if e = os.WriteFile(*output, append(b, '\n'), 0644); e != nil {
            fatal(e)
        }
    }
}

func fatal(err error) {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(1)
}
