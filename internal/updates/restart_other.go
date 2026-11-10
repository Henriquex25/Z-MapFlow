//go:build !linux

package updates

func WaitForParent(args []string) error { return nil }
