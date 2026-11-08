package devices

import (
	"fmt"
	"regexp"
	"strings"
	"z-mapflow/internal/models"
	"z-mapflow/internal/storage"
)

// KeyboardDevice is implemented only by keyboard plugins, never by the editor.
type KeyboardDevice interface {
	GetIdentifier() string
	GetName() string
	GetDefaultLayout() models.KeyboardLayout
	Descriptor() models.Plugin
}
type Registry struct {
	devices map[string]KeyboardDevice
	order   []string
}

func NewRegistry(plugins ...KeyboardDevice) (*Registry, error) {
	r := &Registry{devices: map[string]KeyboardDevice{}}
	for _, p := range plugins {
		d := p.Descriptor()
		if d.ContractVersion != 1 || d.ID == "" || d.ID != p.GetIdentifier() || len(d.Variants) == 0 {
			return nil, fmt.Errorf("contrato inválido no plugin %q", d.ID)
		}
		if _, ok := r.devices[d.ID]; ok {
			return nil, fmt.Errorf("plugin duplicado: %s", d.ID)
		}
		if len(d.Positions) != d.KeyCount {
			return nil, fmt.Errorf("geometria incompleta: %s", d.ID)
		}
		for name := range d.Files {
			if !storage.SafeRelative(name) || name == "west.yml" || name == d.KeymapName+".keymap" || name == d.KeymapName+".conf" || name == "keys_pt_abnt2.h" {
				return nil, fmt.Errorf("arquivo inválido no plugin %s: %s", d.ID, name)
			}
		}
		moduleNames := map[string]bool{"zmk": true}
		for _, module := range d.Modules {
			if module.Name == "" || moduleNames[module.Name] || !storage.SafeRelative(module.Name) || strings.Contains(module.Name, "/") || module.Revision == "" || !strings.HasPrefix(module.URL, "https://") {
				return nil, fmt.Errorf("módulo inválido no plugin %s", d.ID)
			}
			moduleNames[module.Name] = true
		}
		for name, arity := range d.BindingArities {
			if name == "" || arity < 0 || arity > 2 {
				return nil, fmt.Errorf("binding inválido no plugin %s", d.ID)
			}
		}
		if d.KeyCount < 1 || d.Width <= 0 || d.Height <= 0 {
			return nil, fmt.Errorf("dimensões inválidas no plugin %s", d.ID)
		}
		identifier := regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
		seenVariants := map[string]bool{}
		for _, v := range d.Variants {
			if !identifier.MatchString(v.ID) || seenVariants[v.ID] || len(v.Targets) == 0 {
				return nil, fmt.Errorf("variante inválida no plugin %s", d.ID)
			}
			seenVariants[v.ID] = true
			targets := map[string]bool{}
			artifacts := map[string]bool{}
			for _, target := range v.Targets {
				if !identifier.MatchString(target.ID) || targets[target.ID] || !storage.SafeRelative(target.Artifact) || strings.Contains(target.Artifact, "/") || !strings.HasSuffix(target.Artifact, ".uf2") || artifacts[target.Artifact] || target.Board == "" {
					return nil, fmt.Errorf("alvo inválido no plugin %s", d.ID)
				}
				targets[target.ID] = true
				artifacts[target.Artifact] = true
			}
		}
		positionIDs := map[string]bool{}
		seen := map[int]bool{}
		for _, pos := range d.Positions {
			if pos.ID == "" || positionIDs[pos.ID] || pos.Width <= 0 || pos.Height <= 0 {
				return nil, fmt.Errorf("posição inválida no plugin %s", d.ID)
			}
			positionIDs[pos.ID] = true
			if pos.KeymapIndex < 0 || pos.KeymapIndex >= d.KeyCount || seen[pos.KeymapIndex] {
				return nil, fmt.Errorf("índice físico inválido no plugin %s", d.ID)
			}
			seen[pos.KeymapIndex] = true
		}
		r.devices[d.ID] = p
		r.order = append(r.order, d.ID)
	}
	return r, nil
}
func (r *Registry) Get(id string) (KeyboardDevice, error) {
	p, ok := r.devices[id]
	if !ok {
		return nil, fmt.Errorf("plugin não encontrado: %s", id)
	}
	return p, nil
}
func (r *Registry) List() []models.Plugin {
	result := make([]models.Plugin, 0, len(r.order))
	for _, id := range r.order {
		result = append(result, r.devices[id].Descriptor())
	}
	return result
}
