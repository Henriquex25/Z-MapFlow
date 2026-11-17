package main

import (
	"strings"
	"testing"
)

func TestFlashRejectsOverlappingOperationWithoutQueueingAnotherWrite(t *testing.T) {
	a := NewApp()
	a.operation.Lock()
	defer a.operation.Unlock()
	_, err := a.FlashFirmware("build", "right", "unused")
	if err == nil || !strings.Contains(err.Error(), "envio de firmware em andamento") {
		t.Fatalf("concurrent flash was not rejected: %v", err)
	}
}
