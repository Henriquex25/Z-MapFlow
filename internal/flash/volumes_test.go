package flash

import (
	"os"
	"path/filepath"
	"testing"
	"z-mapflow/internal/models"
)

func TestInspectAndCopyOnSimulatedVolume(t *testing.T) {
	volume := t.TempDir()
	v := models.Variant{BootloaderBoards: []string{"nRF52840"}}
	if _, err := Inspect(volume, v); err == nil {
		t.Fatal("ordinary folder accepted")
	}
	if err := os.WriteFile(filepath.Join(volume, "INFO_UF2.TXT"), []byte("Model: nRF52840\nBoard-ID: nRF52840-SuperMini\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Inspect(volume, v); err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(t.TempDir(), "left.uf2")
	if err := os.WriteFile(source, []byte("verified by firmware service before copying"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := Copy(source, volume, "left.uf2", v); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(volume, "left.uf2"))
	if err != nil || len(got) == 0 {
		t.Fatal("not copied", err)
	}
	if err := Copy(source, volume, "../outside.uf2", v); err == nil {
		t.Fatal("path traversal accepted")
	}
	if _, err := Inspect(volume, models.Variant{BootloaderBoards: []string{"other"}}); err == nil {
		t.Fatal("incompatible bootloader accepted")
	}
}
