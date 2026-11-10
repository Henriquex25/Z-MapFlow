package keymap_test

import (
	"strings"
	"testing"
	"z-mapflow/internal/firmware"
	"z-mapflow/internal/keymap"
	"z-mapflow/internal/project"
)

func TestPartialDefaultsAndHeaderConfigurationSurvive(t *testing.T) {
	r, p := setup(t)
	source := `#define ZMK_POINTING_DEFAULT_MOVE_VAL 1500
#include <dt-bindings/zmk/pointing.h>
#include <behaviors.dtsi>
/ { keymap { compatible = "zmk,keymap"; ` + layer("base", "&lt 0 A", "&mmv MOVE_UP") + ` }; };
&lt { tapping-term-ms = <250>; };`
	p, e := keymap.Import(source, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if p.Options.LayerTap.Flavor != "tap-preferred" || p.Options.ModTap.Flavor != "hold-preferred" || p.Options.LayerTap.TappingTermMs != 250 {
		t.Fatal("partial overrides lost inheritance")
	}
	for i := 0; i < 3; i++ {
		files, e := firmware.Generate(p, r)
		if e != nil {
			t.Fatal(e)
		}
		code := files[0].Content
		define := strings.Index(code, "#define ZMK_POINTING_DEFAULT_MOVE_VAL 1500")
		include := strings.Index(code, "#include <dt-bindings/zmk/pointing.h>")
		if define < 0 || define > include || strings.Count(code, "#include <behaviors.dtsi>") != 1 {
			t.Fatal("preamble changed header semantics")
		}
		p, e = keymap.Import(code, p, r)
		if e != nil {
			t.Fatal(e)
		}
	}
}

func TestFullCompositionAndNativeExtensionsRoundTrip(t *testing.T) {
	r, p := setup(t)
	source := `#include <behaviors.dtsi>
#include <input/processors.dtsi>
#define LOWER 1
#define RAISE 2
/ {
 behaviors {
  mo_tog: mo_tog { compatible = "zmk,behavior-hold-tap"; #binding-cells = <2>; tapping-term-ms = <200>; flavor = "balanced"; bindings = <&mo>, <&tog>; retro-tap; hold-while-undecided; };
  morph: morph { compatible = "zmk,behavior-mod-morph"; #binding-cells = <0>; bindings = <&kp BSPC>, <&kp DEL>; mods = <(MOD_LSFT|MOD_RSFT)>; keep-mods = <MOD_RSFT>; };
  sticky: sticky { compatible = "zmk,behavior-sticky-key"; #binding-cells = <1>; bindings = <&mo>; release-after-ms = <1200>; lazy; };
  custom: custom { compatible = "zmk,behavior-key-press"; #binding-cells = <1>; };
 };
 macros {
  layer_macro: layer_macro { compatible = "zmk,behavior-macro-one-param"; #binding-cells = <1>; tap-ms = <20>; wait-ms = <0>;
   bindings = <&macro_param_1to1 &macro_press &mo MACRO_PLACEHOLDER>, <&macro_pause_for_release>, <&macro_param_1to1 &macro_release &mo MACRO_PLACEHOLDER>;
  };
 };
 combos { compatible = "zmk,combos"; esc { key-positions = <0 1>; bindings = <&morph>; timeout-ms = <40>; require-prior-idle-ms = <150>; }; };
 conditional_layers { compatible = "zmk,conditional-layers"; adjust { if-layers = <LOWER RAISE>; then-layer = <3>; }; };
 input_processors { custom_processor: custom_processor { compatible = "zmk,input-processor-scaler"; #input-processor-cells = <2>; type = <2>; codes = <0 1>; }; };
 keymap { compatible = "zmk,keymap"; ` + layer("base", "&mo_tog LOWER RAISE", "&morph", "&layer_macro RAISE", "&sticky LOWER", "&custom A", "&rgb_ug RGB_COLOR_HSB(128,100,100)") + layer("lower") + layer("raise") + layer("adjust") + ` };
};
&sk { lazy; /delete-property/ ignore-modifiers; };
&caps_word { continue-list = <UNDERSCORE MINUS>; };
&key_repeat { usage-pages = <HID_USAGE_KEY HID_USAGE_CONSUMER>; };
&mmv_input_listener { input-processors = <&zip_xy_scaler 3 2>; scroller { layers = <LOWER>; input-processors = <&zip_xy_to_scroll_mapper>; process-next; }; };
&sensors { left { triggers-per-rotation = <18>; }; right { triggers-per-rotation = <24>; }; };
&left_encoder { status = "disabled"; };
`
	p, e := keymap.Import(source, p, r)
	if e != nil {
		t.Fatal(e)
	}
	if len(p.Layout.ConditionalLayers) != 1 || len(p.Layout.InputProcessors) != 2 || p.Layout.Combos[0].RequirePriorIdleMs == nil {
		t.Fatal("resources lost")
	}
	if p.Layout.Layers[0].Keys[0].Code != "&"+p.Layout.Behaviors[0].ID+" @{layer_import_1} @{layer_import_2}" {
		t.Fatal("generic hold tap layer parameters lost")
	}
	if p.Layout.Layers[0].Keys[2].Code != "&"+p.Layout.Macros[0].ID+" @{layer_import_2}" {
		t.Fatal("macro layer parameter lost")
	}
	if p.Layout.Layers[0].Keys[3].Code != "&"+p.Layout.Behaviors[2].ID+" @{layer_import_1}" {
		t.Fatal("sticky layer parameter lost")
	}
	if p.Layout.Layers[0].Sensors[0].TriggersPerRotation != 18 {
		t.Fatal("encoder resolution lost")
	}
	p.Layout.Layers[1], p.Layout.Layers[2] = p.Layout.Layers[2], p.Layout.Layers[1]
	if e = project.Validate(p, r); e != nil {
		t.Fatal(e)
	}
	var previous string
	for i := 0; i < 3; i++ {
		files, e := firmware.Generate(p, r)
		if e != nil {
			t.Fatal(e)
		}
		code := files[0].Content
		for _, want := range []string{"zmk,behavior-macro-one-param", "&macro_pause_for_release", "zmk,conditional-layers", "require-prior-idle-ms = <150>", "input-processors = <&zip_xy_scaler 3 2", "triggers-per-rotation = <18>", "/delete-property/ ignore-modifiers;", "status = \"disabled\"", "input_processors {"} {
			if !strings.Contains(code, want) {
				t.Fatalf("missing %q", want)
			}
		}
		if i > 1 && previous != code {
			a, b := strings.Split(previous, "\n"), strings.Split(code, "\n")
			for n := 0; n < len(a) && n < len(b); n++ {
				if a[n] != b[n] {
					t.Fatalf("round trip changed line %d: %q -> %q", n, a[n], b[n])
				}
			}
			t.Fatal("native source length changed")
		}
		previous = code
		p, e = keymap.Import(code, p, r)
		if e != nil {
			t.Fatalf("round trip %d: %v", i, e)
		}
	}
}
