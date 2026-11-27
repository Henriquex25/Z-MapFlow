package firmware

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

// Fingerprints are advice only, never proof of the firmware installed in hardware.
// Only individual key bindings/labels and layer names may be ignored on peripherals.
// All other project fields, generated support files and target build arguments count.
func Fingerprints(p models.Project, plugin models.Plugin, files []SourceFile) map[string]string {
	data, _ := json.Marshal(p)
	var normalized models.Project
	_ = json.Unmarshal(data, &normalized)
	normalized.Revision = ""
	normalized.SavedAt = ""
	normalized.BuildTargets = nil
	for i := range normalized.Layout.Layers {
		normalized.Layout.Layers[i].Name = ""
		for k := range normalized.Layout.Layers[i].Keys {
			normalized.Layout.Layers[i].Keys[k].Code = ""
			normalized.Layout.Layers[i].Keys[k].Label = ""
		}
	}
	v, _ := project.Variant(p, plugin)
	result := map[string]string{}
	for _, t := range v.Targets {
		if t.Kind == "settings-reset" {
			continue
		}
		h := sha256.New()
		// Explicit format version allows conservative invalidation on rule changes.
		h.Write([]byte("flash-advice-v1"))
		identity, _ := json.Marshal([]string{plugin.ID, plugin.Version, plugin.BuildImage})
		h.Write(identity)
		meta, _ := json.Marshal(struct {
			Target   models.Target
			Settings models.BuildTarget
			Project  models.Project
		}{t, project.EffectiveTargetSettings(p, t), normalized})
		h.Write(meta)
		for _, f := range files {
			if f.Name == "build.yaml" {
				continue
			}
			if t.Role == "peripheral" && f.Name == plugin.KeymapName+".keymap" {
				continue
			}
			// Length-delimited JSON avoids boundary ambiguities.
			blob, _ := json.Marshal(f)
			h.Write(blob)
		}
		result[t.ID] = hex.EncodeToString(h.Sum(nil))
	}
	return result
}
