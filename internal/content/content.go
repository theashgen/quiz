package content

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"slices"
	"strings"
	"unicode/utf8"
)

type Question struct {
	ID       string   `json:"id"`
	Category string   `json:"category,omitempty"`
	Text     string   `json:"text"`
	Options  []string `json:"options"`
	Correct  int      `json:"correct"`
}

type Setup struct {
	Source      string     `json:"source"`
	Categories  []string   `json:"categories"`
	Count       int        `json:"count"`
	Timer       int        `json:"timer"`
	Participate bool       `json:"participate"`
	Name        string     `json:"name"`
	Avatar      string     `json:"avatar"`
	Questions   []Question `json:"questions,omitempty"`
}

var legacyAvatars = []string{
	"🦉",
	"🦊",
	"🐼",
	"🐸",
	"🐙",
	"🐯",
}

var Avatars = func() []string {
	avatars := make([]string, 58)
	for index := range avatars {
		avatars[index] = fmt.Sprintf("memoji-%d", index+1)
	}
	return avatars
}()

func ID() string {
	var b [16]byte

	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}

	return hex.EncodeToString(b[:])
}

func Shuffle[T any](a []T) {
	for i := len(a) - 1; i > 0; i-- {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))

		if err != nil {
			panic(err)
		}

		j := int(n.Int64())
		a[i], a[j] = a[j], a[i]
	}
}

func Identity(name, avatar string) (string, string, error) {
	name = strings.TrimSpace(name)

	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 30 || strings.ContainsAny(name, "\n\r\t") {
		return "", "", errors.New("Choose a name of 1–30 characters")
	}

	if !slices.Contains(Avatars, avatar) && !slices.Contains(legacyAvatars, avatar) {
		return "", "", errors.New("Choose an available avatar")
	}

	return name, avatar, nil
}

func Build(s Setup, solo bool) ([]Question, error) {
	if s.Timer != 10 {
		return nil, errors.New("This build supports the confirmed 10-second timer")
	}

	if solo && s.Source != "preset" {
		return nil, errors.New("Solo play uses preset quizzes only")
	}

	if s.Source == "custom" {
		if s.Participate {
			return nil, errors.New("Custom creators host and cannot answer")
		}

		if len(s.Questions) == 0 {
			return nil, errors.New("Add at least one question")
		}

		qs := make([]Question, len(s.Questions))

		for i, q := range s.Questions {
			q.ID = ID()
			q.Category = ""
			q.Text = strings.TrimSpace(q.Text)

			if q.Text == "" || utf8.RuneCountInString(q.Text) > 2000 || len(q.Options) != 4 || q.Correct < 0 || q.Correct > 3 {
				return nil, errors.New("Each question needs text, four options, and one correct answer (text limit: 2,000 characters)")
			}

			q.Options = slices.Clone(q.Options)
			seen := map[string]bool{}

			for j, o := range q.Options {
				o = strings.TrimSpace(o)

				if o == "" || utf8.RuneCountInString(o) > 500 || seen[strings.ToLower(o)] {
					return nil, errors.New("Options must be distinct and contain 1–500 characters")
				}

				seen[strings.ToLower(o)] = true
				q.Options[j] = o
			}

			qs[i] = q
		}

		return qs, nil
	}

	if s.Source != "preset" {
		return nil, errors.New("Choose preset or custom questions")
	}

	if s.Count != 5 && s.Count != 10 && s.Count != 15 {
		return nil, errors.New("Choose 5, 10, or 15 questions")
	}

	if len(s.Categories) == 0 {
		return nil, errors.New("Choose at least one category")
	}

	cats := Categories()

	for _, c := range s.Categories {
		if _, ok := cats[c]; !ok {
			return nil, errors.New("Unknown category")
		}
	}

	qs := []Question{}

	for _, q := range Seed {
		if slices.Contains(s.Categories, q.Category) {
			qs = append(qs, q)
		}
	}

	if len(qs) < s.Count {
		return nil, errors.New("Not enough development questions for that selection")
	}

	Shuffle(qs)
	qs = qs[:s.Count]

	for i := range qs {
		qs[i].ID = ID()
	}

	return qs, nil
}

func Categories() map[string]int {
	m := map[string]int{}

	for _, q := range Seed {
		m[q.Category]++
	}

	return m
}
