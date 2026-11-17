package project

import (
	"fmt"
	"math"
)

const (
	MinSleepTimeoutMs = 1000
	MaxSleepTimeoutMs = 86400000
)

// SleepTimeoutMilliseconds keeps the UI unit independent from the existing
// project format and CONFIG_ZMK_IDLE_SLEEP_TIMEOUT, both of which use ms.
func SleepTimeoutMilliseconds(minutes float64) (int, error) {
	milliseconds := math.Round(minutes * 60000)
	if math.IsNaN(milliseconds) || math.IsInf(milliseconds, 0) || milliseconds < MinSleepTimeoutMs || milliseconds > MaxSleepTimeoutMs {
		return 0, fmt.Errorf("Use a sleep timeout between 1 second and 24 hours.")
	}
	return int(milliseconds), nil
}
