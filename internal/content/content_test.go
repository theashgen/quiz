package content

import "testing"

func TestMemojiCatalogAndLegacyIdentities(t *testing.T) {
	if len(Avatars) != 58 {
		t.Fatalf("expected 58 Memojis, got %d", len(Avatars))
	}
	seen := map[string]bool{}
	for _, avatar := range Avatars {
		if seen[avatar] {
			t.Fatalf("duplicate avatar %q", avatar)
		}
		seen[avatar] = true
		if _, _, err := Identity("Player", avatar); err != nil {
			t.Fatalf("catalog avatar %q rejected: %v", avatar, err)
		}
	}
	for _, avatar := range []string{"🦉", "🦊", "🐼", "🐸", "🐙", "🐯"} {
		if _, _, err := Identity("Returning player", avatar); err != nil {
			t.Fatalf("legacy avatar %q rejected: %v", avatar, err)
		}
	}
	for _, avatar := range []string{"", "memoji-0", "memoji-59", "memoji-01", "../1.webp", "https://example.com/avatar.png"} {
		if _, _, err := Identity("Player", avatar); err == nil {
			t.Fatalf("invalid avatar %q accepted", avatar)
		}
	}
}

func TestPresetAndCustomValidation(t *testing.T) {
	for c := range Categories() {
		for _, n := range []int{
			5,
			10,
			15,
		} {
			q, e := Build(Setup{
				Source:     "preset",
				Categories: []string{c},
				Count:      n,
				Timer:      10,
			}, false)

			if e != nil || len(q) != n {
				t.Fatalf("%s/%d %v", c, n, e)
			}
		}
	}

	s := Setup{
		Source: "custom",
		Timer:  10,
		Questions: []Question{{
			Text: "Q",
			Options: []string{
				"a",
				"b",
				"c",
				"d",
			},
			Correct: 0,
		}},
	}

	if _, e := Build(s, false); e != nil {
		t.Fatal(e)
	}

	s.Participate = true

	if _, e := Build(s, false); e == nil {
		t.Fatal("custom creator allowed to answer")
	}

	s.Participate = false
	s.Questions[0].Options[3] = " A "

	if _, e := Build(s, false); e == nil {
		t.Fatal("duplicate options accepted")
	}

	if _, e := Build(s, true); e == nil {
		t.Fatal("custom solo accepted")
	}
}
