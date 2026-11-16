// Package hostcmd starts host tools without flashing console windows on Windows.
package hostcmd

import (
	"context"
	"os/exec"
)

func Command(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(resolve(name), args...)
	configure(cmd)
	return cmd
}

func CommandContext(ctx context.Context, name string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, resolve(name), args...)
	configure(cmd)
	return cmd
}
