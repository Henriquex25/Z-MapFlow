package firmware

import (
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"z-mapflow/internal/keymap"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

func TestBuildSettingsRoundTripAndShellQuoting(t *testing.T) {
	r, p := fixture(t)
	d, _ := r.Get(p.PluginID)
	variant, _ := project.Variant(p, d.Descriptor())
	dir := t.TempDir()
	marker := filepath.Join(dir, "must-not-exist")
	value := "-DCONFIG_TEST_LABEL=\"a'b;$(touch " + marker + ")\""
	p.BuildTargets = []models.BuildTarget{{TargetID: variant.Targets[0].ID, Snippets: []string{"studio-rpc-usb-uart", "usb-logging"}, CMakeArgs: []string{"-DCONFIG_ZMK_STUDIO=y", value}}}
	if e := project.Validate(p, r); e != nil {
		t.Fatal(e)
	}
	files, e := Generate(p, r)
	if e != nil {
		t.Fatal(e)
	}
	var matrix string
	for _, f := range files {
		if f.Name == "build.yaml" {
			matrix = f.Content
		}
	}
	imported, e := keymap.ImportBuildMatrix(matrix, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if !reflect.DeepEqual(imported.BuildTargets, p.BuildTargets) {
		t.Fatalf("lost settings: %+v", imported.BuildTargets)
	}
	// Execute against a stub, verifying exact argv and no command substitution.
	fake := filepath.Join(dir, "west")
	if e = os.WriteFile(fake, []byte("#!/bin/sh\nprintf '%s\\n' \"$@\"\n"), 0700); e != nil {
		t.Fatal(e)
	}
	command := exec.Command("sh", "-c", TargetBuildCommand(p, variant, variant.Targets[0]))
	command.Env = append(os.Environ(), "PATH="+dir+":"+os.Getenv("PATH"))
	out, e := command.CombinedOutput()
	if e != nil {
		t.Fatalf("%s: %v", out, e)
	}
	if !strings.Contains(string(out), value+"\n") || !strings.Contains(string(out), "-S\nstudio-rpc-usb-uart\n") {
		t.Fatalf("arguments changed: %s", out)
	}
	if _, e = os.Stat(marker); !os.IsNotExist(e) {
		t.Fatal("shell expansion executed")
	}
	path := filepath.Join(dir, "sofle.keymap")
	if e = WriteKeymapBundle(path, KeymapBundle(path, files), false); e != nil {
		t.Fatal(e)
	}
	round, e := keymap.ImportFile(path, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if !reflect.DeepEqual(round.BuildTargets, p.BuildTargets) {
		t.Fatal("bundle lost build matrix")
	}
}
func TestRejectInvalidBuildSettings(t *testing.T) {
	r, base := fixture(t)
	for _, s := range []models.BuildTarget{
		{TargetID: "missing"},
		{TargetID: "left", Snippets: []string{"a;echo bad"}},
		{TargetID: "left", CMakeArgs: []string{"-DSHIELD=other"}},
		{TargetID: "left", CMakeArgs: []string{"-DCONFIG_ZMK_STUDIO=y", "-DCONFIG_ZMK_STUDIO=n"}},
		{TargetID: "left", CMakeArgs: []string{"--something"}},
	} {
		p := base
		p.BuildTargets = []models.BuildTarget{s}
		if e := project.Validate(p, r); e == nil {
			t.Fatalf("accepted %+v", s)
		}
	}
}
