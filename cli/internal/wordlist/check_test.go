package wordlist

import (
	"fmt"
	"testing"
)

func TestWordlistSize(t *testing.T) {
	if len(Words) != 256 {
		t.Fatalf("expected 256 words, got %d", len(Words))
	}
}

func TestWordlistNoDuplicates(t *testing.T) {
	seen := map[string]int{}
	for i, w := range Words {
		if prev, ok := seen[w]; ok {
			t.Errorf("duplicate %q at index %d (first at %d)", w, i, prev)
		}
		seen[w] = i
	}
}

func TestGenerateCode(t *testing.T) {
	for i := 0; i < 20; i++ {
		code, err := GenerateCode()
		if err != nil {
			t.Fatal(err)
		}
		if code == "" {
			t.Fatal("empty code")
		}
		fmt.Printf("  code: %s\n", code)
	}
}
