package gameplay

import (
    "quiz/internal/content"
    "testing"
)

func qs() []content.Question {
    return []content.Question{
        {
            ID:      "one",
            Correct: 2,
        },
        {
            ID:      "two",
            Correct: 1,
        },
        {
            ID:      "three",
            Correct: 0,
        },
    }
}

func TestAnswerRetryAndDeadlineBoundary(t *testing.T) {
    questions := qs()
    a := New(questions, 1000, 10)
    q := a.Question(questions)
    choice := q.Correct
    receipt, err := a.Answer(questions, q.ID, choice, 10999)

    if err != nil || receipt.Points != 100 {
        t.Fatalf("answer: %+v %v", receipt, err)
    }

    again, err := a.Answer(questions, q.ID, (choice+1)%4, 20000)

    if err != nil || again != receipt || a.Score != 100 {
        t.Fatal("retry changed accepted result")
    }

    b := New(questions, 1000, 10)
    b.Advance(questions, 11000, 10)
    r, err := b.Answer(questions, b.Question(questions).ID, b.Question(questions).Correct, 11000)

    if err != nil || r.Points != 0 || r.Choice != nil {
        t.Fatal("deadline equality must preserve timeout")
    }
}

func TestIndependentProgressAndReveal(t *testing.T) {
    questions := qs()
    a := New(questions, 0, 10)
    b := New(questions, 0, 10)
    _, _ = a.Answer(questions, a.Question(questions).ID, 0, 3000)
    a.Advance(questions, 4999, 10)

    if a.Phase != "reveal" || a.Index != 0 {
        t.Fatal("reveal ended early")
    }

    a.Advance(questions, 5000, 10)
    b.Advance(questions, 5000, 10)

    if a.Index != 1 || a.Deadline != 15000 || b.Index != 0 || b.Deadline != 10000 {
        t.Fatal("players did not progress independently")
    }
}

func TestOutageCatchUpIncludesEveryReveal(t *testing.T) {
    questions := qs()
    a := New(questions, 0, 10)
    a.Advance(questions, 23999, 10)

    if a.Index != 1 || a.Phase != "reveal" {
        t.Fatalf("unexpected catchup: %+v", a)
    }

    a.Advance(questions, 24000, 10)

    if a.Index != 2 || a.Deadline != 34000 {
        t.Fatal("outage granted time or skipped reveal")
    }

    a.Advance(questions, 36000, 10)

    if a.Phase != "finished" || len(a.Answers) != 3 || a.Score != 0 {
        t.Fatal("disconnected attempt did not finish")
    }

    for _, r := range a.Answers {
        if r.AcceptedAt%12000 != 10000 {
            t.Fatal("timeouts used recovery time")
        }
    }
}

func TestAllPlayersReceiveSameSet(t *testing.T) {
    questions := qs()
    orders := map[string]bool{}

    for i := 0; i < 50; i++ {
        a := New(questions, 0, 10)
        seen := map[int]bool{}

        for _, idx := range a.Order {
            seen[idx] = true
        }

        if len(seen) != len(questions) {
            t.Fatal("order omitted or duplicated question")
        }

        key := ""

        for _, idx := range a.Order {
            key += string(rune('0' + idx))
        }

        orders[key] = true
    }

    if len(orders) < 2 {
        t.Fatal("orders were not independently randomized")
    }
}
