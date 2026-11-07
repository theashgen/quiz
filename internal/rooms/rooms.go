package rooms

import (
    "errors"
    "quiz/internal/content"
    "quiz/internal/gameplay"
    "quiz/internal/scoring"
    "sort"
)

const LobbyMS int64 = 10 * 60 * 1000

type Member struct {
    ID         string          `json:"id"`
    Name       string          `json:"name"`
    Avatar     string          `json:"avatar"`
    Owner      string          `json:"owner"`
    SeenOwners map[string]bool `json:"seenOwners"`
    Enrolled   bool            `json:"enrolled"`
    Replay     bool            `json:"replay"`
}

type Round struct {
    ID        string                       `json:"id"`
    Source    string                       `json:"source"`
    Timer     int                          `json:"timer"`
    Questions []content.Question           `json:"questions"`
    Attempts  map[string]*gameplay.Attempt `json:"attempts"`
    StartedAt int64                        `json:"startedAt"`
}

type Room struct {
    Revision          uint64             `json:"revision"`
    ID                string             `json:"id"`
    Code              string             `json:"code"`
    Host              string             `json:"host"`
    Solo              bool               `json:"solo"`
    Status            string             `json:"status"`
    PreparingNextQuiz bool               `json:"preparingNextQuiz"`
    ExpiresAt         int64              `json:"expiresAt"`
    Members           map[string]*Member `json:"members"`
    Rounds            []*Round           `json:"rounds"`
}

func (r *Room) Current() *Round {
    return r.Rounds[len(r.Rounds)-1]
}

func New(code, host string, s content.Setup, qs []content.Question, now int64, solo bool) *Room {
    r := &Room{
        ID:        content.ID(),
        Code:      code,
        Host:      host,
        Solo:      solo,
        Status:    "lobby",
        ExpiresAt: now + LobbyMS,
        Members:   map[string]*Member{},
        Rounds: []*Round{{
            ID:        content.ID(),
            Source:    s.Source,
            Timer:     s.Timer,
            Questions: qs,
            Attempts:  map[string]*gameplay.Attempt{},
        }},
    }
    r.Members[host] = &Member{
        ID:       host,
        Name:     s.Name,
        Avatar:   s.Avatar,
        Enrolled: s.Participate || solo,
    }

    return r
}

func (r *Room) Advance(now int64) bool {
    if r.Status == "lobby" && now >= r.ExpiresAt {
        r.Status = "expired"

        return true
    }

    if r.Status != "active" {
        return false
    }

    changed := false
    finished := 0
    q := r.Current()

    for _, a := range q.Attempts {
        if a.Advance(q.Questions, now, q.Timer) {
            changed = true
        }

        if a.Phase == "finished" {
            finished++
        }
    }

    if finished == len(q.Attempts) {
        r.Status = "results"
        changed = true
    }

    return changed
}

func (r *Room) Start(now int64) error {
    if r.Status != "lobby" {
        return errors.New("This lobby cannot be started")
    }

    q := r.Current()

    for id, m := range r.Members {
        if m.Enrolled {
            q.Attempts[id] = gameplay.New(q.Questions, now, q.Timer)
        }
    }

    if len(q.Attempts) == 0 {
        return errors.New("At least one answering player must join")
    }

    q.StartedAt = now
    r.Status = "active"

    return nil
}

func (r *Room) Join(id, name, avatar string) error {
    if _, ok := r.Members[id]; ok {
        return nil
    }

    if r.Status != "lobby" || r.Solo {
        return errors.New("New players can only join an open multiplayer lobby")
    }

    r.Members[id] = &Member{
        ID:       id,
        Name:     name,
        Avatar:   avatar,
        Enrolled: true,
    }

    return nil
}

func (r *Room) Configure(s content.Setup, qs []content.Question, now int64) error {
    if r.Status != "results" {
        return errors.New("Wait until everyone finishes before configuring another quiz")
    }

    for id, m := range r.Members {
        m.Enrolled = m.Replay
        m.Replay = false

        if id == r.Host {
            m.Enrolled = s.Participate && s.Source == "preset"
        }
    }

    r.Rounds = append(r.Rounds, &Round{
        ID:        content.ID(),
        Source:    s.Source,
        Timer:     s.Timer,
        Questions: qs,
        Attempts:  map[string]*gameplay.Attempt{},
    })
    r.Status = "lobby"
    r.PreparingNextQuiz = false
    r.ExpiresAt = now + LobbyMS

    return nil
}

type PublicMember struct {
    ID       string `json:"id"`
    Name     string `json:"name"`
    Avatar   string `json:"avatar"`
    Host     bool   `json:"host"`
    Playing  bool   `json:"playing"`
    Finished bool   `json:"finished"`
    Replay   bool   `json:"replay"`
}

type PublicQuestion struct {
    ID      string   `json:"id"`
    Text    string   `json:"text"`
    Options []string `json:"options"`
}

type Personal struct {
    Phase       string            `json:"phase"`
    Number      int               `json:"number"`
    Total       int               `json:"total"`
    Deadline    int64             `json:"deadline"`
    RevealUntil int64             `json:"revealUntil"`
    Question    *PublicQuestion   `json:"question,omitempty"`
    Receipt     *gameplay.Receipt `json:"receipt,omitempty"`
    Score       *int              `json:"score,omitempty"`
}

type Snapshot struct {
    Revision          uint64          `json:"revision"`
    Code              string          `json:"code"`
    RoundID           string          `json:"roundId"`
    Status            string          `json:"status"`
    Source            string          `json:"source"`
    Solo              bool            `json:"solo"`
    ServerTime        int64           `json:"serverTime"`
    ExpiresAt         int64           `json:"expiresAt"`
    Me                string          `json:"me"`
    IsHost            bool            `json:"isHost"`
    Enrolled          bool            `json:"enrolled"`
    Members           []PublicMember  `json:"members"`
    Total             int             `json:"total"`
    Finished          int             `json:"finished"`
    ReplayCount       int             `json:"replayCount"`
    PreparingNextQuiz bool            `json:"preparingNextQuiz"`
    Personal          *Personal       `json:"personal,omitempty"`
    Leaderboard       []scoring.Entry `json:"leaderboard,omitempty"`
}

func (r *Room) Snapshot(id string, now int64) Snapshot {
    q := r.Current()
    s := Snapshot{
        Revision:   r.Revision,
        Code:       r.Code,
        RoundID:    q.ID,
        Status:     r.Status,
        Source:     q.Source,
        Solo:       r.Solo,
        ServerTime: now,
        ExpiresAt:  r.ExpiresAt,
        Me:         id,
        IsHost:     r.Host == id,
        Enrolled:   r.Members[id].Enrolled,
        Members:    []PublicMember{},
        Total:      len(q.Attempts),
    }
    s.PreparingNextQuiz = r.Status == "results" && r.PreparingNextQuiz

    for mid, m := range r.Members {
        a := q.Attempts[mid]
        finished := a != nil && a.Phase == "finished"

        if finished {
            s.Finished++
        }

        if m.Replay {
            s.ReplayCount++
        }

        s.Members = append(s.Members, PublicMember{
            ID:       mid,
            Name:     m.Name,
            Avatar:   m.Avatar,
            Host:     mid == r.Host,
            Playing:  m.Enrolled,
            Finished: finished,
            Replay:   m.Replay,
        })

        if r.Status == "results" && a != nil {
            s.Leaderboard = append(s.Leaderboard, scoring.Entry{
                ID:     mid,
                Name:   m.Name,
                Avatar: m.Avatar,
                Score:  a.Score,
            })
        }
    }

    sort.Slice(s.Members, func(i, j int) bool {
        return s.Members[i].ID < s.Members[j].ID
    })

    if r.Status == "results" {
        s.Leaderboard = scoring.Rank(s.Leaderboard)
    }

    if a := q.Attempts[id]; a != nil {
        p := &Personal{
            Phase:       a.Phase,
            Number:      a.Index + 1,
            Total:       len(a.Order),
            Deadline:    a.Deadline,
            RevealUntil: a.RevealUntil,
        }

        if a.Phase == "finished" {
            p.Number = p.Total
            score := a.Score
            p.Score = &score
        } else {
            question := a.Question(q.Questions)
            p.Question = &PublicQuestion{
                ID:      question.ID,
                Text:    question.Text,
                Options: question.Options,
            }

            if a.Phase == "reveal" {
                receipt := a.Answers[question.ID]
                p.Receipt = &receipt
            }
        }

        s.Personal = p
    }

    return s
}
