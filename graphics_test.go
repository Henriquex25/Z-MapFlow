package main

import (
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"testing"
)

func TestLinuxWebviewAllowsAccelerationAndExplicitDriverFallback(t *testing.T) {
	t.Setenv("ZMAPFLOW_DISABLE_GPU", "")
	if webviewGpuPolicy() != linux.WebviewGpuPolicyAlways {
		t.Fatal("default acceleration was disabled")
	}
	t.Setenv("ZMAPFLOW_DISABLE_GPU", "1")
	if webviewGpuPolicy() != linux.WebviewGpuPolicyNever {
		t.Fatal("explicit driver fallback ignored")
	}
}
