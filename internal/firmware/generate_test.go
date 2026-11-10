package firmware

import (
	"context"
	"encoding/binary"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/keymap"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

func fixture(t *testing.T) (*devices.Registry, models.Project) {
	t.Helper()
	r, e := devices.NewRegistry(soflev2.NewDevice())
	if e != nil {
		t.Fatal(e)
	}
	s := project.Service{Root: t.TempDir(), Registry: r}
	p, _ := s.New("sofle_v2")
	p.Layout.Macros = []models.Macro{{ID: "zm_macro", Name: "Copy then paste", TapMs: 10, WaitMs: 10, Steps: []models.MacroStep{{Kind: "press", Binding: "&kp LCTRL"}, {Kind: "tap", Binding: "&kp C"}, {Kind: "release", Binding: "&kp LCTRL"}, {Kind: "wait", DurationMs: 20}, {Kind: "tap", Binding: "&kp LC(V)"}}}}
	p.Layout.Behaviors = []models.Behavior{{ID: "zm_hold", Name: "Ctrl Escape", Kind: "hold-tap", Bindings: []string{"&kp LCTRL", "&kp ESC"}, TappingTermMs: 200, Flavor: "balanced"}, {ID: "zm_dance", Name: "Dance", Kind: "tap-dance", Bindings: []string{"&kp A", "&kp B"}, TappingTermMs: 200}}
	p.Layout.Combos = []models.Combo{{ID: "zm_combo", Name: "Escape", Positions: []int{13, 14}, Binding: "&kp ESC", TimeoutMs: 50, LayerIDs: []string{"base"}}}
	p.Layout.Layers[0].Keys[0].Code = "&zm_macro"
	p.Layout.Layers[0].Keys[1].Code = "&zm_hold LCTRL ESC"
	p.Layout.Layers[0].Keys[2].Code = "&zm_dance"
	p, e = s.Save(p)
	if e != nil {
		t.Fatal(e)
	}
	return r, p
}
func TestGenerateDeterministicAndResolved(t *testing.T) {
	r, p := fixture(t)
	files, e := Generate(p, r)
	if e != nil {
		t.Fatal(e)
	}
	files2, e := Generate(p, r)
	if e != nil {
		t.Fatal(e)
	}
	for i, f := range files {
		if f != files2[i] {
			t.Fatal("generation is nondeterministic")
		}
	}
	keymap := files[0].Content
	for _, want := range []string{"#binding-cells = <2>", "bindings = <&kp>, <&kp>", "<&macro_press>, <&kp LCTRL>", "layers = <0 >", "&zm_sensor_0_0", "&zm_hold LCTRL ESC"} {
		if !strings.Contains(keymap, want) {
			t.Fatalf("missing %q", want)
		}
	}
	if strings.Contains(keymap, "@{") {
		t.Fatal("unresolved layer reference")
	}
}
func TestUF2Validation(t *testing.T) {
	path := filepath.Join(t.TempDir(), "test.uf2")
	block := uf2Block(0xADA52840)
	if e := os.WriteFile(path, block, 0600); e != nil {
		t.Fatal(e)
	}
	if e := ValidateUF2(path, 0xADA52840); e != nil {
		t.Fatal(e)
	}
	if e := ValidateUF2(path, 123); e == nil {
		t.Fatal("wrong family accepted")
	}
	if e := os.WriteFile(path, block[:511], 0600); e != nil {
		t.Fatal(e)
	}
	if e := ValidateUF2(path, 0); e == nil {
		t.Fatal("truncated UF2 accepted")
	}
}
func uf2Block(family uint32) []byte {
	b := make([]byte, 512)
	for offset, value := range map[int]uint32{0: 0x0A324655, 4: 0x9E5D5157, 8: 0x2000, 16: 256, 24: 1, 28: family, 508: 0x0AB16F30} {
		binary.LittleEndian.PutUint32(b[offset:], value)
	}
	return b
}

type fakeProvider struct{}

func (fakeProvider) Run(ctx context.Context, dir string, p models.Project, plugin models.Plugin, log func(string)) error {
	log("ZMAPFLOW_STAGE:left")
	v, _ := project.Variant(p, plugin)
	for _, target := range v.Targets {
		if e := os.WriteFile(filepath.Join(dir, "artifacts", target.Artifact), uf2Block(v.UF2Family), 0600); e != nil {
			return e
		}
	}
	return nil
}
func TestManagerSnapshotsArtifactsAndRestore(t *testing.T) {
	r, p := fixture(t)
	m := Manager{Root: t.TempDir(), Registry: r, Provider: fakeProvider{}}
	b, e := m.Start(context.Background(), p)
	if e != nil {
		t.Fatal(e)
	}
	p.Layout.Layers[0].Keys[3].Code = "&kp Z"
	for m.Current().Status == "running" {
		time.Sleep(time.Millisecond)
	}
	done := m.Current()
	if done.Status != "success" || len(done.Artifacts) != 2 {
		t.Fatalf("build: %+v", done)
	}
	path, _, saved, e := m.ArtifactPath(b.ID, "left")
	if e != nil {
		t.Fatal(e)
	}
	if saved.Layout.Layers[0].Keys[3].Code != "&kp N3" {
		t.Fatal("build snapshot changed")
	}
	restored := Manager{Root: m.Root, Registry: r}
	if e = restored.Restore(); e != nil || restored.Current().ID != b.ID {
		t.Fatal("restore failed", e)
	}
	if e = os.WriteFile(path, []byte("corrupted"), 0600); e != nil {
		t.Fatal(e)
	}
	if _, _, _, e = m.ArtifactPath(b.ID, "left"); e == nil {
		t.Fatal("corrupted artifact accepted")
	}
}

// Opt-in integration test compiles both real targets, including macros/combos/behaviors.
func TestDockerIntegration(t *testing.T) {
	if os.Getenv("ZMAPFLOW_DOCKER_TEST") != "1" {
		t.Skip("set ZMAPFLOW_DOCKER_TEST=1 to compile real ZMK firmware")
	}
	r, p := fixture(t)
	p.Options.Locale = "pt-br"
	p.Layout.Layers[0].Keys[4].Code = "&kp PT_C_CEDILLA"
	p.Layout.Behaviors[0].RequirePriorIdleMs = 100
	p.Layout.Behaviors[0].HoldTriggerPositions = []int{13, 14}
	p.Layout.Behaviors[0].HoldTriggerOnRelease = true
	if variant := os.Getenv("ZMAPFLOW_DOCKER_VARIANT"); variant != "" {
		p.VariantID = variant
	}
	if path := os.Getenv("ZMAPFLOW_DOCKER_KEYMAP"); path != "" {
		var err error
		p, err = keymap.ImportFile(path, p, r)
		if err != nil {
			t.Fatal(err)
		}
		p.ExtraConfig = strings.ReplaceAll(p.ExtraConfig, "CONFIG_ZMK_STUDIO=y", "")
		p.BuildTargets = []models.BuildTarget{{TargetID: "left", Snippets: []string{"studio-rpc-usb-uart"}, CMakeArgs: []string{"-DCONFIG_ZMK_STUDIO=y", "-DCONFIG_ZMK_USB=y"}}}
		// Exercise an inherited sensor before a configured sensor as well.
		p.Layout.Layers[1].Sensors[0].Inherited = true
	}
	service := project.Service{Root: t.TempDir(), Registry: r}
	var saveErr error
	p, saveErr = service.Save(p)
	if saveErr != nil {
		t.Fatal(saveErr)
	}
	m := Manager{Root: t.TempDir(), Registry: r}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Minute)
	defer cancel()
	_, e := m.Start(ctx, p)
	if e != nil {
		t.Fatal(e)
	}
	for m.Current().Status == "running" {
		select {
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(time.Second):
		}
	}
	b := m.Current()
	if b.Status != "success" {
		t.Fatalf("%s\n%s", b.Error, strings.Join(b.Logs, "\n"))
	}
	t.Logf("built %d firmware artifacts", len(b.Artifacts))
}

type waitingProvider struct{ started chan struct{} }

func (w waitingProvider) Run(ctx context.Context, _ string, _ models.Project, _ models.Plugin, _ func(string)) error {
	close(w.started)
	<-ctx.Done()
	return ctx.Err()
}
func TestCancelBuildCleansUpAndKeepsSnapshot(t *testing.T) {
	r, p := fixture(t)
	started := make(chan struct{})
	m := Manager{Root: t.TempDir(), Registry: r, Provider: waitingProvider{started: started}}
	b, e := m.Start(context.Background(), p)
	if e != nil {
		t.Fatal(e)
	}
	<-started
	if _, e = m.Start(context.Background(), p); e == nil {
		t.Fatal("concurrent build accepted")
	}
	m.Close()
	if m.Current().Status != "cancelled" {
		t.Fatal(m.Current().Status)
	}
	if _, e = os.Stat(filepath.Join(m.jobDir(b.ID), "project.json")); e != nil {
		t.Fatal("snapshot lost", e)
	}
}
