package version

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

func TestVersionMatchesSingleSource(t *testing.T) {
	data, err := os.ReadFile("VERSION")
	if err != nil {
		t.Fatal(err)
	}
	if Version != strings.TrimSpace(string(data)) || Current().Version != Version {
		t.Fatal("version differs from source")
	}
	if !regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`).MatchString(Version) {
		t.Fatal("invalid version", Version)
	}
}
