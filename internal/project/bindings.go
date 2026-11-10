package project

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"z-mapflow/internal/models"
	"z-mapflow/internal/zmkdata"
)

var referencePattern = regexp.MustCompile(`^&[a-zA-Z_][a-zA-Z0-9_]*$`)
var expressionPattern = regexp.MustCompile(`^[A-Za-z0-9_()+,|&~^*/%!=.\-\s]+$`)
var compatiblePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]+,[a-zA-Z0-9_,.+-]+$`)
var propertyPattern = regexp.MustCompile(`^[a-zA-Z#][a-zA-Z0-9_#,-]*$`)

// BindingParts understands C-style scalar expressions and modifier functions;
// whitespace inside parentheses does not create additional parameters.
func BindingParts(code string) ([]string, error) {
	if len(code) > 8192 {
		return nil, fmt.Errorf("binding muito grande")
	}
	var parts []string
	start, depth := 0, 0
	for i, c := range code {
		if c == '(' {
			depth++
		}
		if c == ')' {
			depth--
			if depth < 0 {
				return nil, fmt.Errorf("parênteses inválidos")
			}
		}
		if unicode.IsSpace(c) && depth == 0 {
			if i > start {
				parts = append(parts, strings.TrimSpace(code[start:i]))
			}
			start = i + 1
		}
	}
	if depth != 0 {
		return nil, fmt.Errorf("parênteses inválidos")
	}
	if start < len(code) {
		parts = append(parts, strings.TrimSpace(code[start:]))
	}
	if len(parts) == 0 || !referencePattern.MatchString(parts[0]) {
		return nil, fmt.Errorf("binding inválido: %q", code)
	}
	for i, p := range parts[1:] {
		if layerPattern.FindString(p) == p {
			continue
		}
		if !expressionPattern.MatchString(p) || strings.ContainsAny(p, "&,") && !strings.Contains(p, "(") {
			return nil, fmt.Errorf("parâmetro inválido: %s", p)
		}
		normalized := strings.Join(strings.Fields(p), "")
		depth := 0
		wrap := false
		for _, c := range normalized {
			if c == '(' {
				depth++
			}
			if c == ')' {
				depth--
			}
			if depth == 0 && strings.ContainsRune("+-*/|^~%!=&", c) {
				wrap = true
			}
		}
		if wrap {
			normalized = "(" + normalized + ")"
		}
		parts[i+1] = normalized
	}
	return parts, nil
}

func BuiltinArities() map[string]int {
	result := map[string]int{}
	for name, kinds := range zmkdata.Catalog.Bindings {
		result[name] = len(kinds)
	}
	for name := range zmkdata.Catalog.Commands {
		result[name] = -1
	}
	return result
}

func BehaviorArity(b models.Behavior) int {
	switch b.Kind {
	case "hold-tap":
		return 2
	case "sticky-key", "key-toggle", "toggle-layer", "momentary-layer", "to-layer", "mouse-move", "mouse-scroll":
		return 1
	default:
		return b.ParameterCount
	}
}
func BehaviorCompatible(b models.Behavior) string {
	if b.Compatible != "" {
		return b.Compatible
	}
	names := map[string]string{"hold-tap": "hold-tap", "tap-dance": "tap-dance", "mod-morph": "mod-morph", "sticky-key": "sticky-key", "caps-word": "caps-word", "key-repeat": "key-repeat", "key-toggle": "key-toggle", "toggle-layer": "toggle-layer", "momentary-layer": "momentary-layer", "to-layer": "to-layer", "mouse-move": "input-two-axis", "mouse-scroll": "input-two-axis"}
	return "zmk,behavior-" + names[b.Kind]
}
func BehaviorReference(b models.Behavior) string {
	if b.Target != "" {
		return b.Target
	}
	return b.ID
}

// LayerArgumentIndices follows compositions instead of assuming a fixed set of
// hold-tap children. A dummy zero for a zero-cell child is not a layer reference.
func LayerArgumentIndices(name string, p models.Project) []int {
	return layerArguments(name, p, map[string]bool{})
}
func layerArguments(name string, p models.Project, seen map[string]bool) []int {
	if seen[name] {
		return nil
	}
	seen[name] = true
	defer delete(seen, name)
	if name == "mo" || name == "to" || name == "tog" || name == "sl" || name == "lt" {
		return []int{1}
	}
	for _, b := range p.Layout.Behaviors {
		if BehaviorReference(b) != name {
			continue
		}
		if b.Kind == "toggle-layer" || b.Kind == "momentary-layer" || b.Kind == "to-layer" {
			return []int{1}
		}
		if b.Kind == "sticky-key" && len(b.Bindings) > 0 {
			f := strings.Fields(b.Bindings[0])
			if len(f) > 0 && len(layerArguments(strings.TrimPrefix(f[0], "&"), p, seen)) > 0 {
				return []int{1}
			}
		}
		if b.Kind == "hold-tap" {
			result := []int{}
			for i, c := range b.Bindings {
				f := strings.Fields(c)
				if len(f) > 0 && len(layerArguments(strings.TrimPrefix(f[0], "&"), p, seen)) > 0 {
					result = append(result, i+1)
				}
			}
			return result
		}
	}
	// Parameter routing in a macro can target any subsequent behavior argument.
	for _, m := range p.Layout.Macros {
		if m.ID == name {
			routes := map[int]int{}
			result := []int{}
			for _, s := range m.Steps {
				if s.Kind == "control" {
					var from, to int
					if _, e := fmt.Sscanf(s.Binding, "&macro_param_%dto%d", &from, &to); e == nil {
						routes[to] = from
					}
					continue
				}
				if s.Kind == "wait" {
					continue
				}
				f, _ := BindingParts(s.Binding)
				if len(f) > 0 {
					for _, i := range layerArguments(strings.TrimPrefix(f[0], "&"), p, seen) {
						if from, ok := routes[i]; ok {
							result = append(result, from)
						}
					}
				}
				routes = map[int]int{}
			}
			return result
		}
	}
	return nil
}

func ValidateProperties(props map[string]string) error {
	for key, value := range props {
		if !propertyPattern.MatchString(key) || strings.ContainsAny(layerPattern.ReplaceAllString(value, "0"), ";{}\n\r#") {
			return fmt.Errorf("propriedade ZMK inválida: %s", key)
		}
		if key == "compatible" || key == "bindings" || key == "#binding-cells" || key == "display-name" {
			return fmt.Errorf("configure %s no campo próprio", key)
		}
	}
	return nil
}
