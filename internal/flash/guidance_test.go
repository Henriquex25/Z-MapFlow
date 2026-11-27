package flash

import (
	"testing"
	"z-mapflow/internal/models"
)

func TestGuidanceTracksDevicesIndependentlyAndInvalidatesBeforeFailedWrites(t *testing.T) {
	s := &FirmwareHistory{Root: t.TempDir()}
	v := models.Variant{Targets: []models.Target{{ID: "central", Name: "Central"}, {ID: "left", Name: "Left"}, {ID: "reset", Kind: "settings-reset"}}}
	hashes := map[string]string{"central": "C1", "left": "L1"}
	advice := func(migration bool) []Recommendation {
		t.Helper()
		r, e := s.Advice("keyboard", v, hashes, migration)
		if e != nil {
			t.Fatal(e)
		}
		return r
	}
	if r := advice(false); len(r) != 2 || !r[0].Update || !r[1].Update {
		t.Fatal("unknown devices not recommended")
	}
	if e := s.Record("keyboard", "left", "L1"); e != nil {
		t.Fatal(e)
	}
	s = &FirmwareHistory{Root: s.Root} // App restart.
	if r := advice(false); !r[0].Update || r[1].Update {
		t.Fatal("peripheral transfer lost")
	}
	hashes["central"] = "C2"
	if r := advice(false); !r[0].Update || r[1].Update {
		t.Fatal("central-only update changed peripheral advice")
	}
	if r := advice(true); !r[0].Update || !r[1].Update {
		t.Fatal("migration bypass")
	}
	if e := s.Record("keyboard", "left", ""); e != nil {
		t.Fatal(e)
	}
	if !advice(false)[1].Update {
		t.Fatal("failed/interrupted write retained old confidence")
	}
	s.Record("keyboard", "left", "L1")
	if e := s.Forget("keyboard"); e != nil {
		t.Fatal(e)
	}
	if !advice(false)[1].Update {
		t.Fatal("external flash retained old confidence")
	}
	if r, e := s.Advice("keyboard", v, nil, false); e != nil || !r[1].Update {
		t.Fatal("old build got optimistic advice")
	}
	if e := s.Record("../other", "left", "L1"); e == nil {
		t.Fatal("unconfined history path")
	}
}
