package scoring

import "sort"

func Points(correct bool) int {
    if correct {
        return 100
    }

    return 0
}

type Entry struct {
    ID     string `json:"id"`
    Name   string `json:"name"`
    Avatar string `json:"avatar"`
    Score  int    `json:"score"`
    Rank   int    `json:"rank"`
}

func Rank(entries []Entry) []Entry {
    sort.Slice(entries, func(i, j int) bool {
        if entries[i].Score == entries[j].Score {
            return entries[i].ID < entries[j].ID
        }

        return entries[i].Score > entries[j].Score
    })

    for i := range entries {
        if i > 0 && entries[i].Score == entries[i-1].Score {
            entries[i].Rank = entries[i-1].Rank
        } else {
            entries[i].Rank = i + 1
        }
    }

    return entries
}
