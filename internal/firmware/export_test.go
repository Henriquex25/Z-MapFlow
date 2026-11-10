package firmware

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"z-mapflow/internal/keymap"
)

func TestKeymapBundlePreservesConfigAndProtectsCompanionFiles(t *testing.T) {
	r, p := fixture(t)
	p.Options.Locale = "pt-br"
	p.ExtraConfig = "CONFIG_ZMK_BLE_PASSKEY_ENTRY=y"
	p.Options.LayerTap.Flavor = "tap-preferred"
	files, e := Generate(p, r)
	if e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(t.TempDir(), "renamed.keymap")
	bundle := KeymapBundle(path, files)
	if len(bundle) != 4 {
		t.Fatalf("bundle: %+v", bundle)
	}
	if e = WriteKeymapBundle(path, bundle, false); e != nil {
		t.Fatal(e)
	}
	conf, e := os.ReadFile(strings.TrimSuffix(path, ".keymap") + ".conf")
	if e != nil {
		t.Fatal(e)
	}
	imported, e := keymap.Import(files[0].Content, p, r)
	if e != nil {
		t.Fatal(e)
	}
	imported, e = keymap.ImportConfig(string(conf), imported)
	if e != nil {
		t.Fatal(e)
	}
	if !strings.Contains(imported.ExtraConfig, "CONFIG_ZMK_BLE_PASSKEY_ENTRY=y") || imported.Options.BluetoothProfiles != p.Options.BluetoothProfiles {
		t.Fatal("config lost")
	}
	if _, e = os.Stat(filepath.Join(filepath.Dir(path), "keys_pt_abnt2.h")); e != nil {
		t.Fatal("localized header missing")
	}
	bundle[strings.TrimSuffix(path, ".keymap")+".conf"] = []byte("different")
	if e = WriteKeymapBundle(path, bundle, false); e == nil {
		t.Fatal("companion file overwritten without approval")
	}
	if e = WriteKeymapBundle(path, bundle, true); e != nil {
		t.Fatal(e)
	}
}

func TestExportIntoConfigPlacesMatrixAtRepositoryRoot(t *testing.T) {
	r, p := fixture(t)
	files, e := Generate(p, r)
	if e != nil {
		t.Fatal(e)
	}
	root := t.TempDir()
	path := filepath.Join(root, "config", "sofle.keymap")
	bundle := KeymapBundle(path, files)
	if _, ok := bundle[filepath.Join(root, "build.yaml")]; !ok {
		t.Fatal("matrix must be at the repository root")
	}
	if e = WriteKeymapBundle(path, bundle, false); e != nil {
		t.Fatal(e)
	}
	if _, e = keymap.ImportFile(path, p, r); e != nil {
		t.Fatal(e)
	}
}
