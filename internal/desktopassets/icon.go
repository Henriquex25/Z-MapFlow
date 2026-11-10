// Package desktopassets maintains application-owned launcher assets on Linux.
package desktopassets

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"z-mapflow/internal/storage"
)

// RefreshIcon updates an installed launcher after a binary-only app update.
// Development binaries and custom installation paths do not write launcher files.
func RefreshIcon(icon []byte) error {
	if runtime.GOOS != "linux" {
		return nil
	}
	dataDir := os.Getenv("XDG_DATA_HOME")
	if dataDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return err
		}
		dataDir = filepath.Join(home, ".local", "share")
	}
	if !filepath.IsAbs(dataDir) {
		return nil
	}
	installed := filepath.Join(dataDir, "z-mapflow", "z-mapflow")
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	target, err := filepath.EvalSymlinks(installed)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if filepath.Clean(executable) != target {
		return nil
	}
	filename := filepath.Join(dataDir, "z-mapflow", "appicon.png")
	current, err := os.ReadFile(filename)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if bytes.Equal(current, icon) {
		return nil
	}
	return storage.AtomicWrite(filename, icon)
}
