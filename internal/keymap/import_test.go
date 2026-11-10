package keymap_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/firmware"
	"z-mapflow/internal/keymap"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

func setup(t *testing.T) (*devices.Registry, models.Project) {
	t.Helper()
	r, err := devices.NewRegistry(soflev2.NewDevice())
	if err != nil {
		t.Fatal(err)
	}
	s := project.Service{Registry: r, Root: t.TempDir()}
	p, err := s.New("sofle_v2")
	if err != nil {
		t.Fatal(err)
	}
	return r, p
}

func layer(name string, codes ...string) string {
	for len(codes) < 60 {
		codes = append(codes, "&trans")
	}
	return fmt.Sprintf("%s { bindings = <%s>; };", name, strings.Join(codes, " "))
}

func externalSource() string {
	return `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>
#include "keys_pt_abnt2.h"
#define NAV 1
#define LEFT 0 1 2
/ {
 behaviors {
  hrm: home_row { compatible = "zmk,behavior-hold-tap"; #binding-cells = <2>;
   tapping-term-ms = <230>; quick-tap-ms = <100>; flavor = "balanced";
   require-prior-idle-ms = <120>; hold-trigger-key-positions = <LEFT>; hold-trigger-on-release;
   bindings = <&kp>, <&kp>;
  };
  nav_hold: nav_hold { compatible = "zmk,behavior-hold-tap"; #binding-cells = <2>;
   tapping-term-ms = <200>; bindings = <&mo>, <&kp>;
  };
  dance: dance { compatible = "zmk,behavior-tap-dance"; #binding-cells = <0>;
   tapping-term-ms = <250>; bindings = <&kp A>, <&mo NAV>;
  };
  rotation: rotation { compatible = "zmk,behavior-sensor-rotate"; #sensor-binding-cells = <0>;
   bindings = <&kp C_VOL_UP>, <&kp C_VOL_DN>;
  };
 };
 macros {
  copy: copy { compatible = "zmk,behavior-macro"; #binding-cells = <0>; tap-ms = <20>; wait-ms = <10>;
   bindings = <&macro_press &kp LCTRL>, <&macro_tap &kp C &kp V>, <&macro_release &kp LCTRL>;
  };
 };
 combos { compatible = "zmk,combos";
  esc { timeout-ms = <40>; key-positions = <1 2>; bindings = <&copy>; layers = <NAV>; slow-release; };
 };
 keymap { compatible = "zmk,keymap"; ` +
		strings.Replace(layer("base_layer", "&hrm LCTRL A", "&lt NAV SPACE", "&copy", "&dance", "&kp PT_C_CEDILLA", "&nav_hold NAV TAB", "&mkp LCLK"), "bindings =", `display-name = "Base // ABNT2"; sensor-bindings = <&rotation &inc_dec_kp PG_UP PG_DN>; bindings =`, 1) +
		layer("navigation", "&mo 0", "&kp LC( LS( A ) )") + ` };
};
&mt { tapping-term-ms = <220>; flavor = "tap-preferred"; };
&lt { tapping-term-ms = <220>; flavor = "tap-preferred"; };
`
}

func TestImportExternalResourcesAndStableReferences(t *testing.T) {
	r, base := setup(t)
	p, err := keymap.Import(externalSource(), base, r)
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Layout.Layers) != 2 || p.Layout.Layers[0].Name != "Base // ABNT2" {
		t.Fatalf("layers: %+v", p.Layout.Layers)
	}
	if len(p.Layout.Behaviors) != 3 || len(p.Layout.Macros) != 1 || len(p.Layout.Combos) != 1 {
		t.Fatalf("resources: %+v", p.Layout)
	}
	if p.Options.Locale != "pt-br" || !p.Options.Pointing || p.Options.TappingTermMs != 220 {
		t.Fatalf("options: %+v", p.Options)
	}
	if p.Layout.Layers[0].Keys[1].Code != "&lt @{layer_import_1} SPACE" {
		t.Fatal("layer tap lost stable reference")
	}
	if p.Layout.Layers[0].Keys[5].Code != "&"+p.Layout.Behaviors[1].ID+" @{layer_import_1} TAB" {
		t.Fatal("custom layer hold lost stable reference")
	}
	if p.Layout.Layers[1].Keys[1].Code != "&kp LC(LS(A))" {
		t.Fatal("nested modifier changed")
	}
	b := p.Layout.Behaviors[0]
	if b.RequirePriorIdleMs != 120 || len(b.HoldTriggerPositions) != 3 || !b.HoldTriggerOnRelease {
		t.Fatalf("home row: %+v", b)
	}
	m := p.Layout.Macros[0]
	if len(m.Steps) != 7 || m.Steps[0].Binding != "&macro_press" || m.Steps[4].Binding != "&kp V" || m.Steps[5].Binding != "&macro_release" {
		t.Fatalf("macro mode state: %+v", m)
	}
	if p.Layout.Combos[0].LayerIDs[0] != "layer_import_1" || !p.Layout.Combos[0].SlowRelease {
		t.Fatal("combo changed")
	}
	s := p.Layout.Layers[0].Sensors
	if s[0].CodeCW != "&kp C_VOL_UP" || s[1].CodeCCW != "&kp PG_DN" || s[0].CodeClick != p.Layout.Layers[0].Keys[s[0].ClickKeymapIndex].Code {
		t.Fatalf("encoders: %+v", s)
	}
	// Reordering layers must still resolve all imported references correctly.
	p.Layout.Layers[0], p.Layout.Layers[1] = p.Layout.Layers[1], p.Layout.Layers[0]
	files, err := firmware.Generate(p, r)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(files[0].Content, "&lt 0 SPACE") {
		t.Fatal("reorder changed layer destination")
	}
	if base.Layout.Layers[0].Keys[0].Code != "&kp ESC" {
		t.Fatal("import mutated baseline")
	}
}

func TestGeneratedKeymapRoundTripIncludingWaitsAndEncoders(t *testing.T) {
	r, p := setup(t)
	p.Layout.Macros = []models.Macro{{ID: "zm_copy", Name: "Copy", TapMs: 10, WaitMs: 15, Steps: []models.MacroStep{{Kind: "press", Binding: "&kp LCTRL"}, {Kind: "wait", DurationMs: 80}, {Kind: "tap", Binding: "&kp C"}, {Kind: "release", Binding: "&kp LCTRL"}}}}
	p.Layout.Layers[0].Keys[0].Code = "&zm_copy"
	p.Options.ModTap.TappingTermMs = 280
	for i := 0; i < 3; i++ {
		files, err := firmware.Generate(p, r)
		if err != nil {
			t.Fatal(err)
		}
		p, err = keymap.Import(files[0].Content, p, r)
		if err != nil {
			t.Fatalf("round trip %d: %v", i, err)
		}
		if p.Options.ModTap.TappingTermMs != 280 || len(p.Layout.Behaviors) != 0 || len(p.Layout.Macros) != 1 {
			t.Fatal("round trip duplicated resources or lost options")
		}
		m := p.Layout.Macros[0]
		if !hasWait(m.Steps, 80) {
			t.Fatalf("macro wait: %+v", m)
		}
	}
}

func TestDifferentDefaultOverridesRemainDistinct(t *testing.T) {
	r, p := setup(t)
	source := `/ { keymap { compatible = "zmk,keymap"; ` + layer("base", "&mt LCTRL A", "&lt 0 SPACE") + ` }; };
&mt { tapping-term-ms = <190>; hold-trigger-key-positions = <1 2>; };
&lt { tapping-term-ms = <290>; };`
	p, err := keymap.Import(source, p, r)
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Layout.Behaviors) != 1 || p.Options.ModTap.TappingTermMs != 190 || p.Options.LayerTap.TappingTermMs != 290 || p.Options.LayerTap.Flavor != "tap-preferred" {
		t.Fatal("overrides conflated")
	}
	for i := 0; i < 2; i++ {
		files, err := firmware.Generate(p, r)
		if err != nil {
			t.Fatal(err)
		}
		p, err = keymap.Import(files[0].Content, p, r)
		if err != nil {
			t.Fatal(err)
		}
		if len(p.Layout.Behaviors) != 1 {
			t.Fatal("duplicate overrides on reimport")
		}
	}
}

func TestRejectMalformedUnsupportedOrIncompatibleWithoutMutation(t *testing.T) {
	r, p := setup(t)
	valid := `/ { keymap { compatible = "zmk,keymap"; ` + layer("base") + ` }; };`
	cases := []string{
		"", strings.TrimSuffix(valid, ";"), strings.Replace(valid, "&trans", "&unknown", 1),
		strings.Replace(valid, "&trans ", "", 1),
		valid + ` &mt { tapping-term-ms = <0>; };`,
		"#if CONFIG_FOO\n" + valid + "\n#endif",
		"#include \"missing.dtsi\"\n" + valid,
		"#define A B\n#define B A\n" + strings.Replace(valid, "&trans", "&kp A", 1),
		strings.Replace(valid, "bindings =", `custom-flag; bindings =`, 1),
		valid + ` / { behaviors { sticky: sticky { compatible = "zmk,behavior-sticky-key"; }; }; };`,
	}
	for i, source := range cases {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			if _, err := keymap.Import(source, p, r); err == nil {
				t.Fatal("invalid source accepted")
			}
			if p.Layout.Layers[0].Keys[0].Code != "&kp ESC" {
				t.Fatal("failed import mutated baseline")
			}
		})
	}
}

func hasWait(steps []models.MacroStep, ms int) bool {
	for _, s := range steps {
		if s.Kind == "wait" && s.DurationMs == ms {
			return true
		}
	}
	return false
}

func TestImportExternalProject(t *testing.T) {
	path := os.Getenv("ZMAPFLOW_KEYMAP_TEST")
	if path == "" {
		t.Skip("set ZMAPFLOW_KEYMAP_TEST to a local .keymap")
	}
	r, p := setup(t)
	imported, e := keymap.ImportFile(path, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if len(imported.Layout.Layers) != 9 {
		t.Fatalf("layers: %d", len(imported.Layout.Layers))
	}
	if !strings.Contains(imported.ExtraConfig, "CONFIG_ZMK_STUDIO=y") {
		t.Fatal("Studio flag lost")
	}
	if imported.Headers["keys_pt_abnt2.h"] == "" {
		t.Fatal("language header lost")
	}
	for _, l := range imported.Layout.Layers {
		if len(l.Sensors) != 2 {
			t.Fatal("missing editable sensors")
		}
		if l.Name == "GAME 2" && (!l.Sensors[1].Inherited || l.Sensors[0].Inherited) {
			t.Fatal("partial sensor inheritance lost")
		}
		if l.Name == "NUM" && (!l.Sensors[0].Inherited || !l.Sensors[1].Inherited) {
			t.Fatal("empty sensor inheritance lost")
		}
	}
	files, e := firmware.Generate(imported, r)
	if e != nil {
		t.Fatal(e)
	}
	dir := t.TempDir()
	dest := filepath.Join(dir, "sofle.keymap")
	if e = firmware.WriteKeymapBundle(dest, firmware.KeymapBundle(dest, files), false); e != nil {
		t.Fatal(e)
	}
	again, e := keymap.ImportFile(dest, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if len(again.Layout.Layers) != 9 || len(again.Layout.Macros) != len(imported.Layout.Macros) || len(again.Layout.Behaviors) != len(imported.Layout.Behaviors) {
		t.Fatal("round trip lost resources")
	}
	t.Logf("Imported and round-tripped %d layers, %d macros, %d behaviors, %d headers", len(imported.Layout.Layers), len(imported.Layout.Macros), len(imported.Layout.Behaviors), len(imported.Headers))
}

func TestPartialSensorBindings(t *testing.T) {
	r, p := setup(t)
	source := "/ { keymap { compatible = \"zmk,keymap\"; " + strings.Replace(layer("base"), " };", " sensor-bindings = <&inc_dec_kp C_VOL_UP C_VOL_DN>; };", 1) + layer("nav") + " }; };"
	imported, e := keymap.Import(source, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if imported.Layout.Layers[0].Sensors[0].Inherited || !imported.Layout.Layers[0].Sensors[1].Inherited {
		t.Fatal("partial binding not inherited")
	}
	files, e := firmware.Generate(imported, r)
	if e != nil {
		t.Fatal(e)
	}
	if strings.Count(files[0].Content, "sensor-bindings =") != 1 || strings.Contains(files[0].Content, "zm_sensor_0_1") {
		t.Fatal("missing encoder became an opaque binding")
	}
}

func TestNativeBehaviorWithoutBindingsSerializesAnArray(t *testing.T) {
	r, p := setup(t)
	source := `/ { behaviors { caps: caps { compatible = "zmk,behavior-caps-word"; #binding-cells = <0>; }; }; keymap { compatible = "zmk,keymap"; ` + layer("base", "&caps") + ` }; };`
	imported, e := keymap.Import(source, p, r)
	if e != nil {
		t.Fatal(e)
	}
	data, e := json.Marshal(imported)
	if e != nil {
		t.Fatal(e)
	}
	if strings.Contains(string(data), `"bindings":null`) {
		t.Fatal("native behavior emitted null bindings to the frontend")
	}
}
