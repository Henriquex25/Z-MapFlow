package firmware

import (
	"reflect"
	"strings"
	"testing"
	"z-mapflow/internal/keymap"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

func TestSofleDongleKeepsLayoutAndBuildsThreeDevicesPlusReset(t *testing.T) {
	r, p := fixture(t)
	before := p.Layout
	p.VariantID = "nice_nano_v2_dongle"
	d, _ := r.Get(p.PluginID)
	v, err := project.Variant(p, d.Descriptor())
	if err != nil {
		t.Fatal(err)
	}
	if len(v.Targets) != 4 || v.Targets[0].Role != "central" || v.Targets[0].Kind != "dongle" || v.Targets[1].Role != "peripheral" || v.Targets[2].Role != "peripheral" || v.Targets[3].Kind != "settings-reset" {
		t.Fatal("wrong topology")
	}
	files, err := Generate(p, r)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, f := range files {
		got[f.Name] = f.Content
	}
	if !strings.Contains(got["sofle.conf"], "CONFIG_BT_MAX_CONN=7") || !strings.Contains(got["sofle.conf"], "CONFIG_BT_MAX_PAIRED=7") {
		t.Fatal("two peripheral slots not reserved")
	}
	overlay := got["boards/shields/sofle_dongle/sofle_dongle.overlay"]
	if !strings.Contains(overlay, "zmk,kscan-mock") || !strings.Contains(overlay, "sensors = <&left_encoder &right_encoder>") || strings.Contains(overlay, "gpio") {
		t.Fatal("missing remote sensor metadata or physical pins attached to receiver")
	}
	if strings.Contains(got["sofle.keymap"], "&left_encoder { status = \"okay\";") {
		t.Fatal("physical encoders enabled on dongle")
	}
	imported, err := keymap.ImportBuildMatrix(got["build.yaml"], p, r)
	if err != nil {
		t.Fatal(err)
	}
	if err := project.Validate(imported, r); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(before, p.Layout) {
		t.Fatal("changing hardware altered keymap")
	}
	regular := p
	regular.VariantID = "nice_nano_v2"
	normal, err := Generate(regular, r)
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range normal {
		if strings.Contains(f.Name, "sofle_dongle") {
			t.Fatal("dongle files leaked into normal profile")
		}
		if f.Name == "sofle.conf" && !strings.Contains(f.Content, "CONFIG_BT_MAX_CONN=6") {
			t.Fatal("standard connection budget changed")
		}
	}
}

func TestDongleRequiredRolesCannotBeOverridden(t *testing.T) {
	r, p := fixture(t)
	p.VariantID = "nice_nano_v2_dongle"
	p.BuildTargets = []models.BuildTarget{{TargetID: "left", CMakeArgs: []string{"-DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=y"}}}
	if project.Validate(p, r) == nil {
		t.Fatal("peripheral promoted to central")
	}
	p.BuildTargets[0].CMakeArgs = []string{"-DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=n"}
	if err := project.Validate(p, r); err != nil {
		t.Fatal(err)
	}
	d, _ := r.Get(p.PluginID)
	v, _ := project.Variant(p, d.Descriptor())
	cmd := TargetBuildCommand(p, v, v.Targets[1])
	if strings.Count(cmd, "-DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=n") != 1 {
		t.Fatal("duplicate managed flag")
	}
}
