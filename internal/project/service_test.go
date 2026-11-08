package project_test

import (
	"os"
	"path/filepath"
	"testing"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

func service(t *testing.T) *project.Service {
	t.Helper()
	r, e := devices.NewRegistry(soflev2.NewDevice())
	if e != nil {
		t.Fatal(e)
	}
	return &project.Service{Root: t.TempDir(), Registry: r}
}
func TestSaveReloadAndInvalidSavePreservesRevision(t *testing.T) {
	s := service(t)
	session, e := s.Load()
	if e != nil || session.HasSaved {
		t.Fatalf("new: %v", e)
	}
	p, e := s.Save(session.Project)
	if e != nil {
		t.Fatal(e)
	}
	if p.Revision == "" {
		t.Fatal("missing revision")
	}
	loaded, e := s.Load()
	if e != nil || !loaded.HasSaved || loaded.Project.Revision != p.Revision {
		t.Fatalf("load: %v", e)
	}
	p.Layout.Layers[0].Keys[0].Code = "&mo 99"
	if _, e = s.Save(p); e == nil {
		t.Fatal("invalid target accepted")
	}
	loaded, e = s.Load()
	if e != nil || loaded.Project.Layout.Layers[0].Keys[0].Code != "&kp ESC" {
		t.Fatal("invalid save replaced valid project")
	}
}
func TestLayerReferencesAndCorruptProject(t *testing.T) {
	s := service(t)
	p, _ := s.New("sofle_v2")
	layer := p.Layout.Layers[0]
	layer.ID = "second"
	layer.Name = "Second"
	p.Layout.Layers = append(p.Layout.Layers, layer)
	value, e := project.Resolve("&lt @{second} SPACE", p.Layout.Layers)
	if e != nil || value != "&lt 1 SPACE" {
		t.Fatal(value, e)
	}
	p.Layout.Layers[0], p.Layout.Layers[1] = p.Layout.Layers[1], p.Layout.Layers[0]
	value, e = project.Resolve("&lt @{second} SPACE", p.Layout.Layers)
	if e != nil || value != "&lt 0 SPACE" {
		t.Fatal(value, e)
	}
	if e = os.WriteFile(filepath.Join(s.Root, "project.json"), []byte("{"), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e = s.Load(); e == nil {
		t.Fatal("corrupt project silently reset")
	}
}
func TestValidationRejectsUnsafeAndCyclicResources(t *testing.T) {
	s := service(t)
	cases := map[string]func(*models.Project){"injection": func(p *models.Project) { p.Layout.Layers[0].Keys[0].Code = "&kp A>; / {};" }, "duplicate index": func(p *models.Project) { p.Layout.Layers[0].Keys[1].KeymapIndex = 0 }, "missing layer": func(p *models.Project) { p.Layout.Layers[0].Keys[0].Code = "&mo @{deleted}" }, "macro cycle": func(p *models.Project) {
		p.Layout.Macros = []models.Macro{{ID: "zm_cycle", Name: "cycle", Steps: []models.MacroStep{{Kind: "tap", Binding: "&zm_cycle"}}}}
	}, "sensor mismatch": func(p *models.Project) { p.Layout.Layers[0].Sensors[0].CodeClick = "&kp A" }}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			p, _ := s.New("sofle_v2")
			change(&p)
			if e := project.Validate(p, s.Registry); e == nil {
				t.Fatal("invalid project accepted")
			}
		})
	}
}
