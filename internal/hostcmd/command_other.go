//go:build !windows

package hostcmd

import "os/exec"

func configure(*exec.Cmd)        {}
func resolve(name string) string { return name }
