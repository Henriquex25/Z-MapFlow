package flash

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"z-mapflow/internal/models"
	"z-mapflow/internal/storage"
)

type Recommendation struct {
	DeviceID string `json:"deviceId"`
	Name     string `json:"name"`
	Update   bool   `json:"update"`
	Reason   string `json:"reason"`
}
type FirmwareHistory struct {
	Root string
	mu   sync.Mutex
}

func (s *FirmwareHistory) path(id string) (string, error) {
	if !storage.SafeRelative(id) || filepath.Base(id) != id {
		return "", fmt.Errorf("invalid keyboard identity")
	}
	return filepath.Join(s.Root, "flash", "firmware-history", id+".json"), nil
}
func (s *FirmwareHistory) load(id string) (map[string]string, error) {
	p, e := s.path(id)
	if e != nil {
		return nil, e
	}
	data, e := os.ReadFile(p)
	if os.IsNotExist(e) {
		return map[string]string{}, nil
	}
	if e != nil {
		return nil, e
	}
	var m map[string]string
	e = json.Unmarshal(data, &m)
	if m == nil {
		m = map[string]string{}
	}
	return m, e
}

// Record with an empty fingerprint invalidates advice BEFORE any attempted write.
func (s *FirmwareHistory) Record(pluginID, deviceID, hash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, e := s.load(pluginID)
	if e != nil {
		return e
	}
	delete(m, deviceID)
	if hash != "" {
		m[deviceID] = hash
	}
	path, e := s.path(pluginID)
	if e != nil {
		return e
	}
	return storage.AtomicJSON(path, m)
}
func (s *FirmwareHistory) Forget(pluginID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, e := s.path(pluginID)
	if e != nil {
		return e
	}
	e = os.Remove(p)
	if os.IsNotExist(e) {
		return nil
	}
	return e
}
func (s *FirmwareHistory) Advice(pluginID string, v models.Variant, hashes map[string]string, migration bool) ([]Recommendation, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, e := s.load(pluginID)
	if e != nil {
		return nil, e
	}
	list := []Recommendation{}
	for _, t := range v.Targets {
		if t.Kind == "settings-reset" {
			continue
		}
		r := Recommendation{DeviceID: t.ID, Name: t.Name, Update: true, Reason: "No matching transfer is recorded. Update this device."}
		if migration {
			r.Reason = "The setup is changing. Update every destination device after cleanup."
		} else if hashes[t.ID] != "" && m[t.ID] == hashes[t.ID] {
			r.Update = false
			r.Reason = "Relevant firmware inputs match the last recorded transfer."
		} else if m[t.ID] != "" && hashes[t.ID] != "" {
			r.Reason = "Relevant firmware inputs changed since the last recorded transfer."
		}
		list = append(list, r)
	}
	return list, nil
}
