package keymap_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"z-mapflow/internal/firmware"
	"z-mapflow/internal/keymap"
)

func TestCustomLanguageHeadersBundledRecursively(t *testing.T) {
	r, p := setup(t)
	dir := t.TempDir()
	headers := map[string]string{
		"keys_es.h":     "#pragma once\n#include \"lang/common.h\"\n#define ES_NTIL SEMI\n",
		"lang/common.h": "#pragma once\n#include <dt-bindings/zmk/keys.h>\n#define ES_EXCL LS(N1)\n",
	}
	for name, data := range headers {
		dest := filepath.Join(dir, name)
		os.MkdirAll(filepath.Dir(dest), 0700)
		if e := os.WriteFile(dest, []byte(data), 0600); e != nil {
			t.Fatal(e)
		}
	}
	source := "#include \"keys_es.h\"\n/ {keymap {compatible = \"zmk,keymap\"; " + layer("base", "&kp ES_NTIL") + "};};"
	path := filepath.Join(dir, "sofle.keymap")
	os.WriteFile(path, []byte(source), 0600)
	p, e := keymap.ImportFile(path, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if p.Headers["lang/common.h"] != headers["lang/common.h"] {
		t.Fatal("dependency lost")
	}
	files, e := firmware.Generate(p, r)
	if e != nil {
		t.Fatal(e)
	}
	dest := filepath.Join(t.TempDir(), "sofle.keymap")
	if e = firmware.WriteKeymapBundle(dest, firmware.KeymapBundle(dest, files), false); e != nil {
		t.Fatal(e)
	}
	again, e := keymap.ImportFile(dest, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if again.Headers["keys_es.h"] != headers["keys_es.h"] || again.Layout.Layers[0].Keys[0].Code != "&kp ES_NTIL" {
		t.Fatal("custom aliases changed")
	}
}
func TestHeaderPathsAndMissingFiles(t *testing.T) {
	root := t.TempDir()
	outside := filepath.Join(t.TempDir(), "outside.h")
	os.WriteFile(outside, []byte("#define XX_A A"), 0600)
	if e := os.Symlink(outside, filepath.Join(root, "escape.h")); e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"../outside.h", "/etc/passwd", "missing.h", "escape.h"} {
		if _, e := keymap.LoadHeaders(root, "#include \""+name+"\""); e == nil {
			t.Fatalf("accepted %s", name)
		}
	}
	r, p := setup(t)
	if _, e := keymap.Import("#include \"missing.h\"\n/ {keymap {compatible = \"zmk,keymap\"; "+layer("base")+"};};", p, r); e == nil || !strings.Contains(e.Error(), "include") {
		t.Fatal("missing header silently accepted")
	}
}
