package firmware

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"z-mapflow/internal/storage"
)

// KeymapBundle includes Kconfig (queue size, pointing, power) and required headers.
// The selected path supplies the stem, including when the user renames the file.
func KeymapBundle(path string, files []SourceFile) map[string][]byte {
	result := map[string][]byte{path: []byte(files[0].Content)}
	stem := strings.TrimSuffix(path, filepath.Ext(path))
	for _, f := range files[1:] {
		if f.Name == files[1].Name {
			result[stem+".conf"] = []byte(f.Content)
		}
		if f.Name == "build.yaml" && filepath.Base(filepath.Dir(path)) == "config" {
			result[filepath.Join(filepath.Dir(filepath.Dir(path)), f.Name)] = []byte(f.Content)
		} else if strings.HasSuffix(f.Name, ".h") || f.Name == "build.yaml" {
			result[filepath.Join(filepath.Dir(path), f.Name)] = []byte(f.Content)
		}
	}
	return result
}
func BundleConflicts(path string, bundle map[string][]byte) ([]string, error) {
	conflicts := []string{}
	for name, data := range bundle {
		if name == path {
			continue
		}
		existing, e := os.ReadFile(name)
		if e != nil && !os.IsNotExist(e) {
			return nil, e
		}
		if e == nil && string(existing) != string(data) {
			conflicts = append(conflicts, name)
		}
	}
	sort.Strings(conflicts)
	return conflicts, nil
}
func WriteKeymapBundle(path string, bundle map[string][]byte, overwrite bool) error {
	if !overwrite {
		conflicts, e := BundleConflicts(path, bundle)
		if e != nil {
			return e
		}
		if len(conflicts) > 0 {
			return fmt.Errorf("arquivos auxiliares já existem: %s", strings.Join(conflicts, ", "))
		}
	}
	for name, data := range bundle {
		if name == path {
			continue
		}
		if e := storage.AtomicWrite(name, data); e != nil {
			return e
		}
	}
	return storage.AtomicWrite(path, bundle[path])
}
