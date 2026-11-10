package project

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"z-mapflow/internal/models"
)

const SchemaVersion = 2

func NativeHoldTap(flavor string) *models.HoldTapSettings {
	return &models.HoldTapSettings{TappingTermMs: 200, QuickTapMs: -1, Flavor: flavor}
}

// Migrate preserves the effective settings of v1 projects. New projects use the
// native, independent mt/lt defaults. Clone before changing any nested data.
func Migrate(p models.Project) models.Project {
	if p.SchemaVersion != 1 {
		return p
	}
	data, _ := json.Marshal(p)
	var result models.Project
	_ = json.Unmarshal(data, &result)
	result.SchemaVersion = SchemaVersion
	legacy := models.HoldTapSettings{TappingTermMs: p.Options.TappingTermMs, QuickTapMs: p.Options.QuickTapMs, Flavor: p.Options.Flavor}
	mt, lt := legacy, legacy
	result.Options.ModTap = &mt
	result.Options.LayerTap = &lt
	if result.Revision != "" {
		revision := result.Revision
		result.Revision = ""
		savedAt := result.SavedAt
		result.SavedAt = ""
		data, err := json.Marshal(result)
		if err == nil {
			sum := sha256.Sum256(data)
			revision = hex.EncodeToString(sum[:])[:16]
		}
		result.Revision = revision
		result.SavedAt = savedAt
	}
	return result
}

func HoldTapOptions(p models.Project, name string) models.HoldTapSettings {
	p = Migrate(p)
	value := p.Options.ModTap
	if name == "lt" {
		value = p.Options.LayerTap
	}
	if value != nil {
		return *value
	}
	flavor := "hold-preferred"
	if name == "lt" {
		flavor = "tap-preferred"
	}
	return *NativeHoldTap(flavor)
}
