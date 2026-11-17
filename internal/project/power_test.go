package project

import (
	"math"
	"testing"
)

func TestSleepMinutesConvertWithoutChangingFirmwareUnits(t *testing.T) {
	for _, tc := range []struct {
		minutes float64
		want    int
	}{
		{15, 900000}, {1.5, 90000}, {2.25, 135000}, {1.0 / 60, 1000}, {1440, 86400000}, {123456.0 / 60000, 123456},
	} {
		got, err := SleepTimeoutMilliseconds(tc.minutes)
		if err != nil || got != tc.want {
			t.Fatalf("%v minutes: got %d, %v; want %d ms", tc.minutes, got, err, tc.want)
		}
	}
	for _, minutes := range []float64{0, -1, 0.001, 1441, 1e308, math.NaN(), math.Inf(1), math.Inf(-1)} {
		if _, err := SleepTimeoutMilliseconds(minutes); err == nil {
			t.Fatalf("accepted %v minutes", minutes)
		}
	}
}
