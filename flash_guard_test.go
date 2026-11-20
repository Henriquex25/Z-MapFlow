package main

import (
	"context"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/firmware"
	"z-mapflow/internal/flash"
	"z-mapflow/internal/project"
	"z-mapflow/internal/storage"
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

func TestNativeFlashMethodsCannotBypassRequiredTopologyReset(t *testing.T) {
	r, err := devices.NewRegistry(soflev2.NewDevice())
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	service := &project.Service{Root: root, Registry: r}
	p, err := service.New("sofle_v2")
	if err != nil {
		t.Fatal(err)
	}
	p.VariantID = "nice_nano_v2_dongle"
	dir := filepath.Join(root, "builds", "123")
	data := make([]byte, 512)
	for offset, value := range map[int]uint32{0: 0x0A324655, 4: 0x9E5D5157, 8: 0x2000, 16: 256, 24: 1, 28: 0xADA52840, 508: 0x0AB16F30} {
		binary.LittleEndian.PutUint32(data[offset:], value)
	}
	source := filepath.Join(dir, "artifacts", "left.uf2")
	if err = os.MkdirAll(filepath.Dir(source), 0700); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(source, data, 0600); err != nil {
		t.Fatal(err)
	}
	sum, err := firmware.HashFile(source)
	if err != nil {
		t.Fatal(err)
	}
	b := firmware.Build{ID: "123", PluginID: p.PluginID, VariantID: p.VariantID, Status: "success", Artifacts: []firmware.Artifact{{TargetID: "left", Name: "left.uf2", SHA256: sum, Size: 512}, {TargetID: "settings_reset", Name: "reset.uf2", Size: 512}}}
	for path, value := range map[string]interface{}{filepath.Join(dir, "project.json"): p, filepath.Join(dir, "result.json"): b} {
		if err = storage.AtomicJSON(path, value); err != nil {
			t.Fatal(err)
		}
	}
	a := NewApp()
	a.ctx = context.Background()
	a.registry = r
	a.projects = service
	a.builds = &firmware.Manager{Root: root, Registry: r}
	a.topologies = &flash.TopologyStore{Root: root}
	if _, err = a.SetInstalledTopology("123", "nice_nano_v2"); err != nil {
		t.Fatal(err)
	}
	destination := t.TempDir()
	if err = os.WriteFile(filepath.Join(destination, "INFO_UF2.TXT"), []byte("Board-ID: nRF52840-nicenano\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = a.FlashFirmware("123", "left", destination); err == nil || !strings.Contains(err.Error(), "resetting") {
		t.Fatal("legacy native method bypassed reset", err)
	}
	if _, err = a.FlashDevice("123", "left", destination, false); err == nil || !strings.Contains(err.Error(), "resetting") {
		t.Fatal("guided native method bypassed reset", err)
	}
	if _, err = a.FlashFirmware("123", "settings_reset", destination); err == nil {
		t.Fatal("reset without physical device was accepted")
	}
	entries, err := os.ReadDir(destination)
	if err != nil || len(entries) != 1 {
		t.Fatal("blocked operation touched simulated bootloader", err)
	}
}

func TestUndoSetupCannotRunDuringAnActiveUSBOperation(t *testing.T) {
	a := NewApp()
	a.operation.Lock()
	defer a.operation.Unlock()
	if _, err := a.UndoFlashSetupSelection("build"); err == nil || !strings.Contains(err.Error(), "envio de firmware em andamento") {
		t.Fatalf("undo was allowed during a transfer: %v", err)
	}
}

func TestSkipCleanupCannotRunDuringAnActiveUSBOperation(t *testing.T) {
	a := NewApp()
	a.operation.Lock()
	defer a.operation.Unlock()
	if _, err := a.SkipRetiredReset("build", "dongle"); err == nil || !strings.Contains(err.Error(), "envio de firmware em andamento") {
		t.Fatalf("skip was allowed during a transfer: %v", err)
	}
}
