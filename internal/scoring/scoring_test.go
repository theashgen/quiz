package scoring

import "testing"

func TestCompetitionRanking(t *testing.T) {
    r := Rank([]Entry{
        {
            ID:    "d",
            Score: 0,
        },
        {
            ID:    "b",
            Score: 200,
        },
        {
            ID:    "a",
            Score: 200,
        },
        {
            ID:    "c",
            Score: 100,
        },
    })

    for i, want := range []int{
        1,
        1,
        3,
        4,
    } {
        if r[i].Rank != want {
            t.Fatalf("rank %d: %+v", i, r)
        }
    }

    if Points(true) != 100 || Points(false) != 0 {
        t.Fatal("wrong score policy")
    }
}
