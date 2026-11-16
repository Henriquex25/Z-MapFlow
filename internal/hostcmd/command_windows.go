package hostcmd

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

func configure(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
}

func resolve(name string) string {
	if name != "docker" {
		return name
	}
	if found, err := exec.LookPath("docker.exe"); err == nil {
		return found
	}
	// Desktop apps opened from Start can inherit an older PATH. Check Docker's
	// standard machine-wide and per-user locations without invoking a shell.
	for _, candidate := range []string{
		filepath.Join(os.Getenv("ProgramFiles"), "Docker", "Docker", "resources", "bin", "docker.exe"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "DockerDesktop", "resources", "bin", "docker.exe"),
	} {
		if filepath.IsAbs(candidate) {
			if stat, err := os.Stat(candidate); err == nil && stat.Mode().IsRegular() {
				return candidate
			}
		}
	}
	return name
}
