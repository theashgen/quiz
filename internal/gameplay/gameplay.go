package gameplay

import (
    "errors"
    "quiz/internal/content"
    "quiz/internal/scoring"
)

const RevealMS int64 = 2000

type Receipt struct {
    AttemptID  string `json:"attemptId"`
    QuestionID string `json:"questionId"`
    Choice     *int   `json:"choice"`
    Correct    int    `json:"correct"`
    Points     int    `json:"points"`
    AcceptedAt int64  `json:"acceptedAt"`
}

type Attempt struct {
    ID          string             `json:"id"`
    Order       []int              `json:"order"`
    Index       int                `json:"index"`
    Phase       string             `json:"phase"`
    Deadline    int64              `json:"deadline"`
    RevealUntil int64              `json:"revealUntil"`
    Score       int                `json:"score"`
    Answers     map[string]Receipt `json:"answers"`
}

func New(qs []content.Question, now int64, timer int) *Attempt {
    order := make([]int, len(qs))

    for i := range order {
        order[i] = i
    }

    content.Shuffle(order)

    return &Attempt{
        ID:       content.ID(),
        Order:    order,
        Phase:    "question",
        Deadline: now + int64(timer)*1000,
        Answers:  map[string]Receipt{},
    }
}

func (a *Attempt) Question(qs []content.Question) content.Question {
    return qs[a.Order[a.Index]]
}

func (a *Attempt) record(q content.Question, choice *int, at int64) Receipt {
    correct := choice != nil && *choice == q.Correct
    r := Receipt{
        AttemptID:  a.ID,
        QuestionID: q.ID,
        Choice:     choice,
        Correct:    q.Correct,
        Points:     scoring.Points(correct),
        AcceptedAt: at,
    }
    a.Answers[q.ID] = r
    a.Score += r.Points
    a.Phase = "reveal"
    a.RevealUntil = at + RevealMS

    return r
}

func (a *Attempt) Advance(qs []content.Question, now int64, timer int) bool {
    changed := false

    for a.Phase != "finished" {
        if a.Phase == "question" {
            if now < a.Deadline {
                break
            }

            a.record(a.Question(qs), nil, a.Deadline)
            changed = true
        }

        if a.Phase == "reveal" {
            if now < a.RevealUntil {
                break
            }

            start := a.RevealUntil
            a.Index++
            changed = true

            if a.Index == len(a.Order) {
                a.Phase = "finished"
                break
            }

            a.Phase = "question"
            a.Deadline = start + int64(timer)*1000
        }
    }

    return changed
}

func (a *Attempt) Answer(qs []content.Question, qid string, choice int, now int64) (Receipt, error) {
    if r, ok := a.Answers[qid]; ok {
        return r, nil
    }

    if choice < 0 || choice > 3 {
        return Receipt{}, errors.New("Choose one of four options")
    }

    if a.Phase != "question" || a.Question(qs).ID != qid {
        return Receipt{}, errors.New("That question is no longer active")
    }

    if now >= a.Deadline {
        return Receipt{}, errors.New("The question deadline has passed")
    }

    return a.record(a.Question(qs), &choice, now), nil
}
