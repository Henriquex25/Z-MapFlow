//go:build !linux && !windows

package updates

func WaitForParent(args []string) error { return nil }
