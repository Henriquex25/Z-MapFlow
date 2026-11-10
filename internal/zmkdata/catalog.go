// Package zmkdata contains the shared, pinned metadata consumed by Go and React.
package zmkdata

import (
	_ "embed"
	"encoding/json"
)

//go:embed catalog.json
var source []byte
var Catalog struct {
	NativeArities map[string]int                 `json:"nativeArities"`
	Revision      string                         `json:"revision"`
	Bindings      map[string][]string            `json:"bindings"`
	Symbols       []string                       `json:"symbols"`
	Keycodes      []string                       `json:"keycodes"`
	Functions     map[string]int                 `json:"functions"`
	Choices       map[string][]string            `json:"choices"`
	Commands      map[string]map[string][]string `json:"commands"`
}

func init() {
	if err := json.Unmarshal(source, &Catalog); err != nil {
		panic(err)
	}
}
