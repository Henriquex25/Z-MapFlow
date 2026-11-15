// Package version exposes the application version embedded by the entry point.
package version

import (
	"fmt"
	"regexp"
	"strings"
)

// Version is initialized from the root VERSION before the application starts.
var Version = "dev"
var Commit = "unknown"

var stableVersion = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)

func Set(source string) error {
	value := strings.TrimSpace(source)
	if !stableVersion.MatchString(value) {
		return fmt.Errorf("VERSION must contain MAJOR.MINOR.PATCH without a v prefix")
	}
	Version = value
	return nil
}

type Info struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
}

func Current() Info { return Info{Version: Version, Commit: Commit} }
