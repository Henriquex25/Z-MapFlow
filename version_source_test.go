package main

import (
	"os"
	"strings"
	"testing"
	"z-mapflow/internal/version"
)

func TestEmbeddedVersionReachesApplicationInfo(t *testing.T) {
	source, err := os.ReadFile("VERSION")
	if err != nil {
		t.Fatal(err)
	}
	if appVersion != string(source) {
		t.Fatal("embedded VERSION differs from source")
	}
	want := strings.TrimSpace(string(source))
	if version.Version != want || NewApp().GetAppInfo().Version != want {
		t.Fatal("application info does not use embedded root VERSION")
	}
}
