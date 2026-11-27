package firmware

import (
	"encoding/json"
	"testing"
	"z-mapflow/internal/models"
)

func TestFlashAdviceDistinguishesBindingsFromPeripheralInputs(t *testing.T) {
	r, base := fixture(t)
	base.VariantID = "nice_nano_v2_dongle"
	d, _ := r.Get(base.PluginID)
	hashes := func(p models.Project) map[string]string {
		t.Helper()
		files, err := Generate(p, r)
		if err != nil {
			t.Fatal(err)
		}
		return Fingerprints(p, BuildProfile(p, d.Descriptor()), files)
	}
	original := hashes(base)
	clone := func() models.Project {
		data, _ := json.Marshal(base)
		var p models.Project
		json.Unmarshal(data, &p)
		return p
	}
	key := clone()
	key.Revision = "new"
	key.SavedAt = "tomorrow"
	key.Layout.Layers[0].Keys[4].Code = "&kp X"
	key.Layout.Layers[0].Name = "New name"
	h := hashes(key)
	if h["dongle"] == original["dongle"] {
		t.Fatal("central ignored binding change")
	}
	if h["left"] != original["left"] || h["right"] != original["right"] {
		t.Fatal("binding-only change required peripheral flash")
	}
	if base.Layout.Layers[0].Keys[4].Code == "&kp X" {
		t.Fatal("hashing mutated source")
	}
	logging := clone()
	logging.BuildTargets = []models.BuildTarget{{TargetID: "dongle", Snippets: []string{"zmk-usb-logging"}}}
	h = hashes(logging)
	if h["dongle"] == original["dongle"] || h["left"] != original["left"] {
		t.Fatal("target-only logging affected wrong devices")
	}
	for name, change := range map[string]func(*models.Project){
		"sleep":   func(p *models.Project) { p.Options.Sleep = !p.Options.Sleep },
		"sync":    func(p *models.Project) { p.Options.PeripheralStatusSync = !p.Options.PeripheralStatusSync },
		"raw dts": func(p *models.Project) { p.ExtraDTS = "// changed hardware code" },
		"macro":   func(p *models.Project) { p.Layout.Macros[0].TapMs++ },
		"sensor":  func(p *models.Project) { p.Layout.Layers[0].Sensors[0].CodeCW = "&kp C_VOL_DN" },
	} {
		t.Run(name, func(t *testing.T) {
			p := clone()
			change(&p)
			h := hashes(p)
			if h["left"] == original["left"] {
				t.Fatal("peripheral-affecting/uncertain change was ignored")
			}
		})
	}
}
