//go:build !windows

package updates

import "context"

func applyPlatformUpdate(ctx context.Context, staged, target, version string, sum []byte, restart func(string) error) (bool, error) {
	return replaceAndRestart(ctx, staged, target, version, sum, restart)
}

func HandleHelper([]string) (bool, error) { return false, nil }
