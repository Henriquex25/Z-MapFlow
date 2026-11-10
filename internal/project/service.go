package project

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
	"z-mapflow/internal/storage"
)

type Service struct {
	Root     string
	Registry *devices.Registry
}

func (s *Service) path() string { return filepath.Join(s.Root, "project.json") }
func (s *Service) New(pluginID string) (models.Project, error) {
	d, err := s.Registry.Get(pluginID)
	if err != nil {
		return models.Project{}, err
	}
	p := d.Descriptor()
	return models.Project{SchemaVersion: SchemaVersion, PluginID: p.ID, PluginVersion: p.Version, VariantID: p.Variants[0].ID, Layout: d.GetDefaultLayout(), Options: models.Options{ModTap: NativeHoldTap("hold-preferred"), LayerTap: NativeHoldTap("tap-preferred"), Locale: "us", Display: hasCapability(p, "display"), Pointing: hasCapability(p, "pointing"), TappingTermMs: 200, QuickTapMs: 0, Flavor: "hold-preferred", BluetoothProfiles: 5, Sleep: true, SleepTimeoutMs: 900000}}, nil
}
func (s *Service) Load() (models.Session, error) {
	data, err := os.ReadFile(s.path())
	hasSaved := true
	var p models.Project
	if errors.Is(err, os.ErrNotExist) {
		all := s.Registry.List()
		if len(all) == 0 {
			return models.Session{}, fmt.Errorf("nenhum plugin instalado")
		}
		p, err = s.New(all[0].ID)
		hasSaved = false
	} else if err == nil {
		err = json.Unmarshal(data, &p)
	}
	if err != nil {
		return models.Session{}, fmt.Errorf("não foi possível abrir a configuração: %w", err)
	}
	p = Migrate(p)
	if err = Validate(p, s.Registry); err != nil {
		return models.Session{}, fmt.Errorf("configuração incompatível: %w", err)
	}
	d, _ := s.Registry.Get(p.PluginID)
	return models.Session{Project: p, Plugin: d.Descriptor(), HasSaved: hasSaved}, nil
}
func (s *Service) Save(p models.Project) (models.Project, error) {
	p = Migrate(p)
	if err := Validate(p, s.Registry); err != nil {
		return p, err
	}
	p.Revision = ""
	p.SavedAt = ""
	data, err := json.Marshal(p)
	if err != nil {
		return p, err
	}
	sum := sha256.Sum256(data)
	p.Revision = hex.EncodeToString(sum[:])[:16]
	p.SavedAt = time.Now().UTC().Format(time.RFC3339)
	if err = storage.AtomicJSON(s.path(), p); err != nil {
		return p, fmt.Errorf("falha ao salvar: %w", err)
	}
	return p, nil
}

func hasCapability(p models.Plugin, capability string) bool {
	for _, c := range p.Capabilities {
		if c == capability {
			return true
		}
	}
	return false
}
