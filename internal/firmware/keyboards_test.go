package firmware

import (
	"context"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/lily58"
	"z-mapflow/internal/devices/silakka54"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/keymap"
	"z-mapflow/internal/project"
)

func supportedRegistry(t *testing.T) *devices.Registry {
	t.Helper()
	r, err := devices.NewRegistry(soflev2.NewDevice(), lily58.NewDevice(), silakka54.NewWirelessDevice(), silakka54.NewWiredDevice())
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestIncludedKeyboardsPersistAndRoundTripNativeBindings(t *testing.T) {
	r := supportedRegistry(t)
	for _, descriptor := range r.List() {
		t.Run(descriptor.ID, func(t *testing.T) {
			s := project.Service{Root: t.TempDir(), Registry: r}
			p, err := s.New(descriptor.ID)
			if err != nil {
				t.Fatal(err)
			}
			p.Layout.Layers[0].Keys[0].Code = "&kp LC(A)"
			p, err = s.Save(p)
			if err != nil {
				t.Fatal(err)
			}
			loaded, err := s.Load()
			if err != nil || !reflect.DeepEqual(p, loaded.Project) {
				t.Fatalf("project changed after reload: %v", err)
			}
			files, err := Generate(p, r)
			if err != nil {
				t.Fatal(err)
			}
			for _, f := range files {
				if f.Name != descriptor.KeymapName+".keymap" {
					continue
				}
				imported, err := keymap.Import(f.Content, p, r)
				if err != nil {
					t.Fatal(err)
				}
				for i, key := range p.Layout.Layers[0].Keys {
					if key.Code != imported.Layout.Layers[0].Keys[i].Code {
						t.Fatalf("binding %d changed", i)
					}
				}
				for i, sensor := range p.Layout.Layers[0].Sensors {
					actual := imported.Layout.Layers[0].Sensors[i]
					if sensor.CodeCW != actual.CodeCW || sensor.CodeCCW != actual.CodeCCW || sensor.CodeClick != actual.CodeClick {
						t.Fatal("encoder bindings changed")
					}
				}
			}
		})
	}
}

func TestWirelessSilakkaPreservesLily58SlotsWithoutDrawingPhantomKeys(t *testing.T) {
	r := supportedRegistry(t)
	d, _ := r.Get("silakka54_wireless")
	plugin := d.Descriptor()
	hidden := map[int]bool{}
	visible := 0
	for _, pos := range plugin.Positions {
		if pos.Hidden {
			hidden[pos.KeymapIndex] = true
		} else {
			visible++
		}
	}
	if visible != 54 || !reflect.DeepEqual(hidden, map[int]bool{42: true, 43: true, 53: true, 54: true}) {
		t.Fatalf("incorrect physical switches: %d, %v", visible, hidden)
	}
	s := project.Service{Registry: r}
	p, _ := s.New(plugin.ID)
	// Preserve even an existing non-empty binding in an unpopulated matrix slot.
	p.Layout.Layers[0].Keys[53].Code = "&kp F24"
	files, err := Generate(p, r)
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range files {
		if f.Name != "lily58.keymap" {
			continue
		}
		imported, err := keymap.Import(f.Content, p, r)
		if err != nil {
			t.Fatal(err)
		}
		if len(imported.Layout.Layers[0].Keys) != 58 || imported.Layout.Layers[0].Keys[53].Code != "&kp F24" {
			t.Fatal("Lily58 binding indices were shifted or lost")
		}
	}
}

func TestLily58ImportsStockSensorBindingsWithoutInventingAClick(t *testing.T) {
	r := supportedRegistry(t)
	s := project.Service{Registry: r}
	p, _ := s.New("lily58")
	codes := make([]string, 58)
	for i := range codes {
		codes[i] = "&kp A"
	}
	source := "#include <behaviors.dtsi>\n#include <dt-bindings/zmk/keys.h>\n/ { keymap { compatible = \"zmk,keymap\"; base { bindings = <" + strings.Join(codes, " ") + ">; sensor-bindings = <&inc_dec_kp C_VOL_UP C_VOL_DN>; }; }; };"
	imported, err := keymap.Import(source, p, r)
	if err != nil {
		t.Fatal(err)
	}
	sensor := imported.Layout.Layers[0].Sensors[0]
	if sensor.ClickKeymapIndex != -1 || sensor.CodeClick != "" || sensor.CodeCW != "&kp C_VOL_UP" || sensor.CodeCCW != "&kp C_VOL_DN" {
		t.Fatalf("incorrect optional encoder: %+v", sensor)
	}
	imported.Layout.Layers[0].Sensors[0].CodeClick = "&kp B"
	if project.Validate(imported, r) == nil {
		t.Fatal("invented encoder click accepted")
	}
}

func TestWiredSilakkaRejectsUnsupportedSleepAndEmitsHardwareFiles(t *testing.T) {
	r := supportedRegistry(t)
	s := project.Service{Registry: r}
	p, _ := s.New("silakka54_wired")
	if p.Options.Sleep || p.Options.Display {
		t.Fatal("unsupported defaults")
	}
	p.Layout.Layers[0].Keys[0].Code = "&bt BT_CLR"
	if project.Validate(p, r) == nil {
		t.Fatal("Bluetooth accepted on wired hardware")
	}
	p.Layout.Layers[0].Keys[0].Code = "&kp A"
	p.Options.Sleep = true
	if project.Validate(p, r) == nil {
		t.Fatal("unsupported RP2040 deep sleep accepted")
	}
	p.Options.Sleep = false
	files, err := Generate(p, r)
	if err != nil {
		t.Fatal(err)
	}
	found := map[string]string{}
	for _, f := range files {
		found[f.Name] = f.Content
	}
	if strings.Contains(found["silakka54_wired.conf"], "CONFIG_ZMK_IDLE_SLEEP_TIMEOUT=") {
		t.Fatal("unsupported sleep timeout generated")
	}
	for _, path := range []string{"Kconfig.shield", "Kconfig.defconfig", "silakka54_wired.dtsi", "silakka54_wired_left.overlay", "silakka54_wired_right.overlay"} {
		if found["boards/shields/silakka54_wired/"+path] == "" {
			t.Fatalf("missing custom hardware file %s", path)
		}
	}
}

// Build all new keyboard halves against their actual pinned ZMK hardware.
func TestNewKeyboardsDockerIntegration(t *testing.T) {
	if os.Getenv("ZMAPFLOW_DOCKER_TEST") != "1" {
		t.Skip("set ZMAPFLOW_DOCKER_TEST=1 for real firmware builds")
	}
	r := supportedRegistry(t)
	for _, id := range []string{"lily58", "silakka54_wireless", "silakka54_wired"} {
		t.Run(id, func(t *testing.T) {
			s := project.Service{Root: t.TempDir(), Registry: r}
			p, err := s.New(id)
			if err != nil {
				t.Fatal(err)
			}
			if id == "silakka54_wireless" {
				// Exercise the native reservation retained from common Studio configs.
				p.ExtraDTS = "/ { keymap { extra_1 { status = \"reserved\"; }; }; };"
			}
			p, err = s.Save(p)
			if err != nil {
				t.Fatal(err)
			}
			m := Manager{Root: t.TempDir(), Registry: r}
			ctx, cancel := context.WithTimeout(context.Background(), 40*time.Minute)
			defer cancel()
			if _, err = m.Start(ctx, p); err != nil {
				t.Fatal(err)
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
			if len(b.Artifacts) != 2 {
				t.Fatalf("expected two halves, got %d", len(b.Artifacts))
			}
			for _, artifact := range b.Artifacts {
				if _, _, _, err = m.ArtifactPath(b.ID, artifact.TargetID); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}

func TestWirelessSilakkaPreservesTrailingStudioReservations(t *testing.T) {
	r := supportedRegistry(t)
	s := project.Service{Registry: r}
	p, _ := s.New("silakka54_wireless")
	codes := make([]string, 58)
	for i := range codes {
		codes[i] = "&kp A"
	}
	source := "/ { keymap { compatible = \"zmk,keymap\"; base { bindings = <" + strings.Join(codes, " ") + ">; }; extra_1 { status = \"reserved\"; }; extra_2 { status = \"reserved\"; }; }; };"
	imported, err := keymap.Import(source, p, r)
	if err != nil {
		t.Fatal(err)
	}
	if len(imported.Layout.Layers) != 1 || !strings.Contains(imported.ExtraDTS, "extra_1") || !strings.Contains(imported.ExtraDTS, "reserved") {
		t.Fatal("Studio slots were dropped or treated as active layers")
	}
	files, err := Generate(imported, r)
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range files {
		if f.Name != "lily58.keymap" {
			continue
		}
		again, err := keymap.Import(f.Content, imported, r)
		if err != nil {
			t.Fatal(err)
		}
		if len(again.Layout.Layers) != 1 || strings.Count(again.ExtraDTS, "extra_1") != 1 {
			t.Fatal("reserved layers changed on a second import")
		}
	}
	interleaved := strings.Replace(source, "base {", "reserved_before { status = \"reserved\"; }; base {", 1)
	if _, err := keymap.Import(interleaved, p, r); err == nil {
		t.Fatal("interleaved reserved slot silently moved")
	}
}
