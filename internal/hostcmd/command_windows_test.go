package hostcmd

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestWindowsDockerDesktopLookupWithoutUpdatedPATH(t *testing.T) {
	t.Setenv("PATH", "")
	t.Setenv("ProgramFiles", t.TempDir())
	t.Setenv("LOCALAPPDATA", t.TempDir())
	path := filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "DockerDesktop", "resources", "bin", "docker.exe")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("stub"), 0600); err != nil {
		t.Fatal(err)
	}
	cmd := CommandContext(context.Background(), "docker", "info")
	if cmd.Path != path {
		t.Fatalf("resolved %q, want %q", cmd.Path, path)
	}
	if cmd.SysProcAttr == nil || !cmd.SysProcAttr.HideWindow || cmd.SysProcAttr.CreationFlags&0x08000000 == 0 {
		t.Fatal("host command can flash a console window")
	}
}
