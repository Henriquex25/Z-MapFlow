package keymap

import (
	"fmt"
	"gopkg.in/yaml.v3"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
	"z-mapflow/internal/storage"
)

const fileLimit = 4 * 1024 * 1024

var quotedInclude = regexp.MustCompile(`(?m)^\s*#\s*include\s*"([^"\n]+)"`)

func readFile(name string) ([]byte, error) {
	f, e := os.Open(name)
	if e != nil {
		return nil, e
	}
	defer f.Close()
	data, e := io.ReadAll(io.LimitReader(f, fileLimit+1))
	if e == nil && len(data) > fileLimit {
		return nil, fmt.Errorf("%s excede 4 MB", filepath.Base(name))
	}
	return data, e
}

// LoadHeaders retains exact bytes and resolves quoted header dependencies inside
// the selected directory. It does not run a compiler or execute imported code.
func LoadHeaders(root, source string) (map[string]string, error) {
	files := map[string]string{}
	root, e := filepath.EvalSymlinks(root)
	if e != nil {
		return nil, e
	}
	total := 0
	var visit func(string, string) error
	visit = func(source, dir string) error {
		for _, match := range quotedInclude.FindAllStringSubmatch(source, -1) {
			name := filepath.ToSlash(filepath.Join(dir, match[1]))
			if name == "behaviors.dtsi" || strings.HasPrefix(name, "dt-bindings/") || strings.HasPrefix(name, "zephyr/dt-bindings/") {
				continue
			}
			if filepath.IsAbs(match[1]) || strings.ContainsAny(match[1], "\\:") || !storage.SafeRelative(name) || filepath.Ext(name) != ".h" {
				return fmt.Errorf("include local inválido: %s; apenas headers .h dentro da pasta da configuração são suportados", match[1])
			}
			if _, ok := files[name]; ok {
				continue
			}
			path, e := filepath.EvalSymlinks(filepath.Join(root, filepath.FromSlash(name)))
			if os.IsNotExist(e) && name == "keys_pt_abnt2.h" {
				continue
			}
			if e != nil {
				return fmt.Errorf("header %s: %w", name, e)
			}
			relative, e := filepath.Rel(root, path)
			if e != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(os.PathSeparator)) {
				return fmt.Errorf("header fora da pasta da configuração: %s", name)
			}
			data, e := readFile(path)
			if e != nil {
				return e
			}
			total += len(data)
			if total > fileLimit || len(files) >= 128 {
				return fmt.Errorf("headers excedem o limite de 4 MB ou 128 arquivos")
			}
			files[name] = string(data)
			if e = visit(string(data), filepath.Dir(name)); e != nil {
				return e
			}
		}
		return nil
	}
	e = visit(source, "")
	return files, e
}

func ImportFile(path string, base models.Project, registry *devices.Registry) (models.Project, error) {
	data, e := readFile(path)
	if e != nil {
		return models.Project{}, e
	}
	base.Headers, e = LoadHeaders(filepath.Dir(path), string(data))
	if e != nil {
		return models.Project{}, e
	}
	p, e := Import(string(data), base, registry)
	if e != nil {
		return models.Project{}, e
	}
	conf, e := readFile(strings.TrimSuffix(path, filepath.Ext(path)) + ".conf")
	if e == nil {
		p, e = ImportConfig(string(conf), p)
	}
	if e != nil && !os.IsNotExist(e) {
		return models.Project{}, e
	}
	// Standard repositories keep build.yaml beside config/, flat exports keep it
	// beside the keymap. Read the nearest one, retaining settings of known targets.
	candidates := []string{filepath.Join(filepath.Dir(path), "build.yaml"), filepath.Join(filepath.Dir(filepath.Dir(path)), "build.yaml")}
	for _, candidate := range candidates {
		matrix, e := readFile(candidate)
		if os.IsNotExist(e) {
			continue
		}
		if e != nil {
			return models.Project{}, e
		}
		p, e = ImportBuildMatrix(string(matrix), p, registry)
		if e != nil {
			return models.Project{}, e
		}
		break
	}
	if e = project.Validate(p, registry); e != nil {
		return models.Project{}, e
	}
	return p, nil
}

// SplitArguments parses the shell-style quoting used by cmake-args without
// evaluating substitutions, variables, commands, or escapes beyond quoting.
func SplitArguments(source string) ([]string, error) {
	var args []string
	var word strings.Builder
	var quote rune
	escaped, started := false, false
	for _, c := range source {
		if escaped {
			word.WriteRune(c)
			escaped = false
			started = true
			continue
		}
		if c == '\\' && quote != '\'' {
			escaped = true
			started = true
			continue
		}
		if quote != 0 {
			if c == quote {
				quote = 0
			} else {
				word.WriteRune(c)
			}
			started = true
			continue
		}
		if c == '\'' || c == '"' {
			quote = c
			started = true
			continue
		}
		if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
			if started {
				args = append(args, word.String())
				word.Reset()
				started = false
			}
			continue
		}
		word.WriteRune(c)
		started = true
	}
	if quote != 0 || escaped {
		return nil, fmt.Errorf("aspas ou escape incompletos em cmake-args")
	}
	if started {
		args = append(args, word.String())
	}
	return args, nil
}
func ImportBuildMatrix(source string, p models.Project, registry *devices.Registry) (models.Project, error) {
	var matrix struct {
		Include []struct {
			Board   string    `yaml:"board"`
			Shield  string    `yaml:"shield"`
			Snippet yaml.Node `yaml:"snippet"`
			Args    string    `yaml:"cmake-args"`
		} `yaml:"include"`
	}
	var top map[string]yaml.Node
	if e := yaml.Unmarshal([]byte(source), &top); e != nil {
		return p, fmt.Errorf("build.yaml inválido: %w", e)
	}
	if len(top) != 1 || top["include"].Kind != yaml.SequenceNode {
		return p, fmt.Errorf("build.yaml: use uma matriz include explícita; expansões e excludes ainda não são suportados")
	}
	if e := yaml.Unmarshal([]byte(source), &matrix); e != nil {
		return p, e
	}
	d, e := registry.Get(p.PluginID)
	if e != nil {
		return p, e
	}
	variant, e := project.Variant(p, d.Descriptor())
	if e != nil {
		return p, e
	}
	p.BuildTargets = nil
	seen := map[string]bool{}
	for _, entry := range matrix.Include {
		id := ""
		for _, target := range variant.Targets {
			if target.Board == entry.Board && target.Shield == entry.Shield {
				id = target.ID
				break
			}
		}
		// Extra entries such as settings_reset do not belong to this device's targets.
		if id == "" {
			continue
		}
		if seen[id] {
			return p, fmt.Errorf("build.yaml: mais de uma configuração para o alvo %s", id)
		}
		seen[id] = true
		settings := models.BuildTarget{TargetID: id}
		switch entry.Snippet.Kind {
		case 0:
		case yaml.ScalarNode:
			settings.Snippets = strings.Fields(entry.Snippet.Value)
		case yaml.SequenceNode:
			if e := entry.Snippet.Decode(&settings.Snippets); e != nil {
				return p, e
			}
		default:
			return p, fmt.Errorf("build.yaml: snippet deve ser texto ou lista")
		}
		settings.CMakeArgs, e = SplitArguments(entry.Args)
		if e != nil {
			return p, e
		}
		if len(settings.Snippets) > 0 || len(settings.CMakeArgs) > 0 {
			p.BuildTargets = append(p.BuildTargets, settings)
		}
	}
	if len(seen) == 0 && len(matrix.Include) > 0 {
		return p, fmt.Errorf("build.yaml não contém alvos compatíveis com a variante selecionada")
	}
	return p, project.ValidateBuild(p, d.Descriptor())
}
