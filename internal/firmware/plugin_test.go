package firmware

import (
	"strings"
	"testing"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

type otherKeyboard struct{}

func (otherKeyboard) GetIdentifier() string { return "other" }
func (otherKeyboard) GetName() string       { return "Other keyboard" }
func (otherKeyboard) GetDefaultLayout() models.KeyboardLayout {
	return models.KeyboardLayout{Name: "Other keyboard", Layers: []models.LayerData{{ID: "base", Name: "Base", Keys: []models.KeyAction{{KeymapIndex: 0, Code: "&kp A"}, {KeymapIndex: 1, Code: "&custom"}}}}}
}
func (otherKeyboard) Descriptor() models.Plugin {
	return models.Plugin{ContractVersion: 1, ID: "other", Name: "Other keyboard", Version: "1", KeymapName: "other", KeyCount: 2, Width: 3, Height: 2, Positions: []models.Position{{ID: "first", KeymapIndex: 0, Width: 1, Height: 1}, {ID: "second", KeymapIndex: 1, Width: 1, Height: 1}}, ZMKRevision: "v0.3.0", BuildImage: "test", Variants: []models.Variant{{ID: "wired", Targets: []models.Target{{ID: "main", Board: "test", Artifact: "other.uf2"}}}}, Files: map[string]string{"boards/shields/other/other.overlay": "// hardware supplied by the plugin"}, Modules: []models.Module{{Name: "example", URL: "https://github.com/example/boards", Revision: "v1"}}, BindingArities: map[string]int{"custom": 0}}
}
func TestOtherKeyboardUsesSameCoreAndSuppliesFilesAndModules(t *testing.T) {
	r, e := devices.NewRegistry(otherKeyboard{})
	if e != nil {
		t.Fatal(e)
	}
	s := project.Service{Registry: r}
	p, e := s.New("other")
	if e != nil {
		t.Fatal(e)
	}
	files, e := Generate(p, r)
	if e != nil {
		t.Fatal(e)
	}
	found := map[string]string{}
	for _, f := range files {
		found[f.Name] = f.Content
	}
	if !strings.Contains(found["other.keymap"], "&custom") {
		t.Fatal("custom binding lost")
	}
	if !strings.Contains(found["west.yml"], "https://github.com/example/boards") {
		t.Fatal("module missing")
	}
	if found["boards/shields/other/other.overlay"] == "" {
		t.Fatal("plugin hardware file missing")
	}
}
