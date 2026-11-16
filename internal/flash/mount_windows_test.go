package flash

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestNativeWindowsLocalDrives(t *testing.T) {
	paths, err := mountPaths()
	if err != nil {
		t.Fatal(err)
	}
	want := filepath.VolumeName(t.TempDir()) + `\`
	for _, path := range paths {
		if strings.EqualFold(path, want) {
			return
		}
	}
	t.Fatalf("temporary volume %q not found among %v", want, paths)
}
