package project_test

import (
	"strings"
	"testing"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

func TestNativeDefaultsAndLegacyMigration(t *testing.T) {
	s := service(t)
	p, _ := s.New("sofle_v2")
	if p.SchemaVersion != 2 || p.Options.ModTap.Flavor != "hold-preferred" || p.Options.LayerTap.Flavor != "tap-preferred" {
		t.Fatal("native defaults conflated")
	}
	old := p
	old.SchemaVersion = 1
	old.Options.ModTap = nil
	old.Options.LayerTap = nil
	old.Options.Flavor = "balanced"
	old.Options.TappingTermMs = 310
	old.Revision = "oldhash"
	migrated := project.Migrate(old)
	if migrated.Options.ModTap.Flavor != "balanced" || migrated.Options.LayerTap.Flavor != "balanced" || migrated.Options.LayerTap.TappingTermMs != 310 {
		t.Fatal("legacy behavior changed")
	}
	if old.Options.LayerTap != nil || old.SchemaVersion != 1 || migrated.Revision == old.Revision {
		t.Fatal("migration mutated source or kept stale revision")
	}
	if again := project.Migrate(migrated); again.Revision != migrated.Revision {
		t.Fatal("migration not idempotent")
	}
}
func TestMacroDelayHasExactlyOneWaitEventAndRestoresState(t *testing.T) {
	m := models.Macro{Name: "delay", TapMs: 20, WaitMs: 15, Steps: []models.MacroStep{{Kind: "control", Binding: "&macro_release"}, {Kind: "wait", DurationMs: 100}, {Kind: "binding", Binding: "&kp A"}}}
	b, e := project.MacroBindings(m)
	if e != nil {
		t.Fatal(e)
	}
	got := strings.Join(b, "|")
	if got != "&macro_release|&macro_wait_time 100|&macro_press|&none|&macro_wait_time 15|&macro_release|&kp A" {
		t.Fatal(got)
	}
}
func TestMacroLimitsUseExpandedBindingsAndNestedQueue(t *testing.T) {
	m := models.Macro{ID: "zm_long", Name: "Long"}
	for i := 0; i < 200; i++ {
		m.Steps = append(m.Steps, models.MacroStep{Kind: "tap", Binding: "&kp A"})
	}
	if _, err := project.MacroBindings(m); err != nil {
		t.Fatal(err)
	}
	p := models.Project{Layout: models.KeyboardLayout{Macros: []models.Macro{m, {ID: "zm_outer", Steps: []models.MacroStep{{Kind: "tap", Binding: "&zm_long"}, {Kind: "tap", Binding: "&zm_long"}}}}}}
	if size := project.MacroQueueSize(p); size < 800 {
		t.Fatalf("nested queue undersized: %d", size)
	}
	for i := 0; i < 60; i++ {
		m.Steps = append(m.Steps, models.MacroStep{Kind: "tap", Binding: "&kp A"})
	}
	if _, err := project.MacroBindings(m); err == nil {
		t.Fatal("more than 256 generated bindings accepted")
	}
	bad := models.Macro{ParameterCount: 1, Steps: []models.MacroStep{{Kind: "control", Binding: "&macro_param_2to1"}}}
	if _, err := project.MacroBindings(bad); err == nil {
		t.Fatal("missing macro parameter accepted")
	}
}
func TestExpressionsGenericHoldTapAndParameterizedLayerRoutes(t *testing.T) {
	s := service(t)
	p, _ := s.New("sofle_v2")
	l := p.Layout.Layers[0]
	l.ID = "nav"
	l.Name = "Nav"
	p.Layout.Layers = append(p.Layout.Layers, l)
	p.Layout.Behaviors = []models.Behavior{{ID: "zm_toggle", Name: "Hold or toggle", Kind: "hold-tap", TappingTermMs: 200, QuickTapMs: -1, RequirePriorIdleMs: -1, Flavor: "balanced", Bindings: []string{"&mo", "&tog"}}, {ID: "zm_caps", Name: "Caps", Kind: "hold-tap", TappingTermMs: 200, Flavor: "balanced", Bindings: []string{"&kp", "&caps_word"}}}
	p.Layout.Macros = []models.Macro{{ID: "zm_layer", Name: "Param", ParameterCount: 1, Steps: []models.MacroStep{{Kind: "control", Binding: "&macro_param_1to1"}, {Kind: "press", Binding: "&mo MACRO_PLACEHOLDER"}, {Kind: "control", Binding: "&macro_pause_for_release"}, {Kind: "control", Binding: "&macro_param_1to1"}, {Kind: "release", Binding: "&mo MACRO_PLACEHOLDER"}}}}
	for i, c := range []string{"&zm_toggle @{nav} @{nav}", "&zm_caps CAPS 0", "&zm_layer @{nav}", "&rgb_ug RGB_COLOR_HSB(128, 100, 100)", "&bt BT_DISC 0"} {
		p.Layout.Layers[0].Keys[i].Code = c
	}
	if e := project.Validate(p, s.Registry); e != nil {
		t.Fatal(e)
	}
	for _, code := range []string{"&kp A>; / {};", "&kp LC(A", "&kp A\n&bootloader", "&rgb_ug RGB_COLOR_HSB_CMD"} {
		p.Layout.Layers[0].Keys[0].Code = code
		if e := project.Validate(p, s.Registry); e == nil {
			t.Fatalf("invalid binding accepted: %s", code)
		}
	}
}

func TestCyclesThroughBuiltinOverridesAndProfileFeatures(t *testing.T) {
	s := service(t)
	p, _ := s.New("sofle_v2")
	p.Layout.Macros = []models.Macro{{ID: "zm_cycle", Name: "Cycle", ParameterCount: 1, Steps: []models.MacroStep{{Kind: "tap", Binding: "&sk LSHFT"}}}}
	p.Layout.Behaviors = []models.Behavior{{ID: "zm_override", Name: "Override", Kind: "sticky-key", Target: "sk", Bindings: []string{"&zm_cycle"}}}
	if err := project.Validate(p, s.Registry); err == nil {
		t.Fatal("recursive composition through builtin override accepted")
	}
	p.Layout.Macros = nil
	p.Layout.Behaviors = []models.Behavior{{ID: "zm_lock", Name: "Lock", Kind: "toggle-layer", Properties: map[string]string{"locking": ""}}}
	if err := project.Validate(p, s.Registry); err != nil {
		t.Fatal(err)
	}
	p.VariantID = "nice_nano_v2_legacy"
	if err := project.Validate(p, s.Registry); err == nil {
		t.Fatal("layer locking offered by incompatible profile")
	}
}
