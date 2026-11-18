package project

import (
	"fmt"
	"regexp"
	"sort"
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

// EffectiveTargetSettings composes fixed hardware requirements with user flags.
// Managed values are emitted last and validated before a build is accepted.
func EffectiveTargetSettings(p models.Project, target models.Target) models.BuildTarget {
	settings := TargetSettings(p, target.ID)
	args := []string{}
	for _, arg := range settings.CMakeArgs {
		parts := cmakeArg.FindStringSubmatch(arg)
		if len(parts) > 0 {
			if _, managed := target.Config[parts[1]]; managed {
				continue
			}
		}
		args = append(args, arg)
	}
	names := make([]string, 0, len(target.Config))
	for name := range target.Config {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		args = append(args, "-D"+name+"="+target.Config[name])
	}
	settings.CMakeArgs = args
	return settings
}

func ValidateBuild(p models.Project, plugin models.Plugin) error {
	variant, err := Variant(p, plugin)
	if err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, settings := range p.BuildTargets {
		found := false
		var definition models.Target
		for _, target := range variant.Targets {
			if target.ID == settings.TargetID {
				found = true
				definition = target
			}
		}
		if !found || seen[settings.TargetID] {
			return fmt.Errorf("alvo de compilação inválido ou duplicado: %s", settings.TargetID)
		}
		seen[settings.TargetID] = true
		used := map[string]bool{}
		for _, snippet := range settings.Snippets {
			if snippet == "zmapflow-oled-flip-180" {
				supported := false
				for _, feature := range variant.Features {
					supported = supported || feature == "oled-rotate-180"
				}
				if !supported || definition.Role != "peripheral" {
					return fmt.Errorf("OLED rotation requires a supported peripheral display profile.")
				}
			}
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
			if name == "CONFIG_ZMAPFLOW_STATUS_SYNC" {
				return fmt.Errorf("use a opção de sincronização de estado em Configurações")
			}
			if definition.Role == "peripheral" {
				if value, managed := StatusSyncDisplayConfig(p)[name]; managed && value != parts[2] {
					return fmt.Errorf("%s: %s=%s é obrigatório para este perfil de hardware", definition.Name, name, value)
				}
			}
			if value, managed := definition.Config[name]; managed && value != parts[2] {
				return fmt.Errorf("%s: %s=%s é obrigatório para este perfil de hardware", definition.Name, name, value)
			}
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
		if _, exists := variant.Files[name]; exists {
			return fmt.Errorf("header conflita com arquivo da variante: %s", name)
		}
		total += len(content)
		if total > 4*1024*1024 {
			return fmt.Errorf("headers excedem 4 MB")
		}
	}
	return nil
}
