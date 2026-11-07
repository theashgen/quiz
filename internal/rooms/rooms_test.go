package rooms

import (
    "encoding/json"
    "quiz/internal/content"
    "strings"
    "testing"
)

func testRoom() *Room {
    return New("ABC123", "host", content.Setup{
        Source:      "preset",
        Timer:       10,
        Participate: true,
        Name:        "Host",
        Avatar:      "🦉",
    }, []content.Question{{
        ID:   "q",
        Text: "Question",
        Options: []string{
            "a",
            "b",
            "c",
            "d",
        },
        Correct: 2,
    }}, 0, false)
}

func TestRoomExpiryAndDisconnectedCompletion(t *testing.T) {
    r := testRoom()
    _ = r.Join("p", "Player", "🦊")
    r.Advance(LobbyMS - 1)

    if r.Status != "lobby" {
        t.Fatal("expired early")
    }

    r.Advance(LobbyMS)

    if r.Status != "expired" {
        t.Fatal("activity extended expiry")
    }

    r = testRoom()
    _ = r.Start(0)
    r.Advance(LobbyMS * 2)

    if r.Status != "results" {
        t.Fatal("active game never completed")
    }
}

func TestNoAnswerLeakAndRematchIsolation(t *testing.T) {
    r := testRoom()
    _ = r.Join("p", "Player", "🦊")
    _ = r.Start(0)
    s := r.Snapshot("p", 1)
    b, _ := json.Marshal(s)

    if strings.Contains(string(b), "correct") || strings.Contains(string(b), "answers") {
        t.Fatal("correct answer leaked before reveal")
    }

    if e := r.Join("late", "Late", "🐸"); e == nil {
        t.Fatal("late join accepted")
    }

    if e := r.Join("p", "Other", "🐸"); e != nil {
        t.Fatal("existing player could not reconnect")
    }

    r.Advance(12000)
    r.Members["p"].Replay = true
    old := r.Current().ID

    if e := r.Configure(content.Setup{
        Source: "custom",
        Timer:  10,
    }, r.Current().Questions, 13000); e != nil {
        t.Fatal(e)
    }

    if r.Current().ID == old || len(r.Current().Attempts) != 0 || r.Members["host"].Enrolled || !r.Members["p"].Enrolled || r.ExpiresAt != 613000 {
        t.Fatal("rematch roster/history wrong")
    }

    if r.Rounds[0].Attempts["p"].Phase != "finished" {
        t.Fatal("history lost")
    }

    if e := r.Join("new", "New", "🐸"); e != nil {
        t.Fatal("new rematch join rejected")
    }
}
