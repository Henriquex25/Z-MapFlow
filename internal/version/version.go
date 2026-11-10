// Package version exposes the single application version embedded from VERSION.
package version

import (
	_ "embed"
	"strings"
)

//go:embed VERSION
var source string

// Version is derived from VERSION; release tags must match this file.
var Version = strings.TrimSpace(source)
var Commit = "unknown"

type Info struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
}

func Current() Info { return Info{Version: Version, Commit: Commit} }
