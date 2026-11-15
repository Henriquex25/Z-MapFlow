package version

import (
	"os"
	"strings"
	"testing"
)

func TestVersionMatchesSingleSource(t *testing.T) {
	data, err := os.ReadFile("../../VERSION")
	if err != nil {
		t.Fatal(err)
	}
	original := Version
	t.Cleanup(func() { Version = original })
	if err := Set(string(data)); err != nil {
		t.Fatal(err)
	}
	if Version != strings.TrimSpace(string(data)) || Current().Version != Version {
		t.Fatal("version differs from source")
	}
}

func TestInvalidVersionPreservesInitializedValue(t *testing.T) {
	original := Version
	t.Cleanup(func() { Version = original })
	if err := Set(" 1.2.3\n"); err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{"", "dev", "v1.2.3", "01.2.3", "1.2", "1.2.3-beta.1", "1.2.3+build"} {
		if err := Set(value); err == nil || Version != "1.2.3" {
			t.Fatalf("invalid version %q changed initialized value: %q, err=%v", value, Version, err)
		}
	}
}
