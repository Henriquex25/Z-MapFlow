package project

import (
	"fmt"
	"regexp"
	"strings"
	"z-mapflow/internal/models"
	"z-mapflow/internal/storage"
)

var snippetName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.-]*$`)
var cmakeArg = regexp.MustCompile(`^-D([A-Za-z_][A-Za-z0-9_]*)(?::[A-Za-z]+)?=(.*)$`)
var headerName = regexp.MustCompile(`^[A-Za-z0-9_./-]+\.h$`)

func TargetSettings(p models.Project, id string) models.BuildTarget {
	for _, settings := range p.BuildTargets {
		if settings.TargetID == id {
			return settings
		}
	}
	return models.BuildTarget{TargetID: id}
}

func ValidateBuild(p models.Project, plugin models.Plugin) error {
	variant, err := Variant(p, plugin)
	if err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, settings := range p.BuildTargets {
		found := false
		for _, target := range variant.Targets {
			found = found || target.ID == settings.TargetID
		}
		if !found || seen[settings.TargetID] {
			return fmt.Errorf("alvo de compilação inválido ou duplicado: %s", settings.TargetID)
		}
		seen[settings.TargetID] = true
		used := map[string]bool{}
		for _, snippet := range settings.Snippets {
			if !snippetName.MatchString(snippet) || used[snippet] {
				return fmt.Errorf("snippet inválido ou duplicado: %s", snippet)
			}
			used[snippet] = true
		}
		used = map[string]bool{}
		for _, arg := range settings.CMakeArgs {
			parts := cmakeArg.FindStringSubmatch(arg)
			if len(parts) == 0 || strings.ContainsAny(arg, "\x00\n\r") {
				return fmt.Errorf("argumento CMake inválido: use -DNOME=valor")
			}
			name := parts[1]
			if used[name] {
				return fmt.Errorf("argumento CMake duplicado: %s", name)
			}
			used[name] = true
			// These identify hardware or replace the application's generated sources.
			switch name {
			case "BOARD", "SHIELD", "ZMK_CONFIG", "APPLICATION_SOURCE_DIR", "CMAKE_HOME_DIRECTORY", "CONF_FILE", "EXTRA_CONF_FILE", "DTC_OVERLAY_FILE", "EXTRA_DTC_OVERLAY_FILE":
				return fmt.Errorf("%s é definido pelo perfil de hardware; use flags CONFIG_ ou snippets", name)
			}
		}
	}
	total := 0
	for name, content := range p.Headers {
		if !storage.SafeRelative(name) || !headerName.MatchString(name) || strings.HasPrefix(name, "dt-bindings/") || strings.HasPrefix(name, "zephyr/") || strings.HasPrefix(name, "input/") {
			return fmt.Errorf("nome de header inválido: %s", name)
		}
		if _, exists := plugin.Files[name]; exists {
			return fmt.Errorf("header conflita com arquivo do plugin: %s", name)
		}
		total += len(content)
		if total > 4*1024*1024 {
			return fmt.Errorf("headers excedem 4 MB")
		}
	}
	return nil
}
