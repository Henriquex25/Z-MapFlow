package project

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"z-mapflow/internal/models"
	"z-mapflow/internal/zmkdata"
)

var definePattern = regexp.MustCompile(`(?m)^\s*#\s*define\s+([A-Za-z_]\w*)(\(([^)]*)\))?([^\n]*)`)
var exprTokens = regexp.MustCompile(`0[xX][0-9a-fA-F]+[uUlL]*|\d+[uUlL]*|[A-Za-z_]\w*|<<|>>|<=|>=|==|!=|&&|\|\||[()+\-*/%~!^|&,<>]`)
var integerToken = regexp.MustCompile(`^\d+$`)
var binaryOperator = regexp.MustCompile(`^(?:<<|>>|<=|>=|==|!=|&&|\|\||[+\-*/%&|^<>])$`)
var symbolToken = regexp.MustCompile(`^[A-Za-z_]\w*$`)
var keyFunctions = map[string]bool{}
var knownKeys = map[string]bool{}
var knownSymbols = map[string]bool{}
var knownModifiers = map[string]bool{}

type expressionEnvironment struct {
	objects   map[string]bool
	functions map[string]int
}

func environment(p models.Project) expressionEnvironment {
	objects, functions := symbols(p)
	return expressionEnvironment{objects, functions}
}

func init() {
	for _, n := range zmkdata.Catalog.Keycodes {
		knownKeys[n] = true
	}
	for _, n := range zmkdata.Catalog.Symbols {
		knownSymbols[n] = true
		if strings.HasPrefix(n, "MOD_") {
			knownModifiers[n] = true
		}
	}
	for _, n := range strings.Fields("LC LS LA LG RC RS RA RG LCTL LSFT LALT LGUI RCTL RSFT RALT RGUI ZMK_HID_USAGE APPLY_MODS SELECT_MODS STRIP_MODS") {
		keyFunctions[n] = true
	}
}
func symbols(p models.Project) (map[string]bool, map[string]int) {
	objects := map[string]bool{}
	functions := map[string]int{}
	sources := []string{p.Preamble}
	for _, s := range p.Headers {
		sources = append(sources, s)
	}
	comments := regexp.MustCompile(`/\*[\s\S]*?\*/`)
	for _, source := range sources {
		source = comments.ReplaceAllString(strings.ReplaceAll(source, "\\\n", " "), " ")
		for _, m := range definePattern.FindAllStringSubmatch(source, -1) {
			if m[2] != "" {
				count := 0
				for _, a := range strings.Split(m[3], ",") {
					if strings.TrimSpace(a) != "" {
						count++
					}
				}
				functions[m[1]] = count
			} else if body := strings.TrimSpace(m[4]); body != "" && !strings.HasPrefix(body, "//") && !strings.ContainsAny(body, "\"{};") {
				objects[m[1]] = true
			}
		}
	}
	return objects, functions
}
func ValidateExpression(source, kind string, p models.Project, macro bool) error {
	return validateExpression(source, kind, macro, environment(p))
}
func validateExpression(source, kind string, macro bool, env expressionEnvironment) error {
	tokens := exprTokens.FindAllString(source, -1)
	if len(tokens) == 0 || strings.Join(tokens, "") != strings.Join(strings.Fields(source), "") {
		return fmt.Errorf("expressão inválida: %s", source)
	}
	custom, functions := env.objects, env.functions
	known := knownSymbols
	if kind == "keycode" {
		known = knownKeys
	} else if kind == "modifierMask" {
		known = knownModifiers
	}
	i := 0
	var expression func(string) error
	var atom func(string) error
	expression = func(role string) error {
		if e := atom(role); e != nil {
			return e
		}
		for i < len(tokens) && tokens[i] != "," && tokens[i] != ")" {
			if !binaryOperator.MatchString(tokens[i]) {
				return fmt.Errorf("operador inválido em %s", source)
			}
			i++
			if e := atom(role); e != nil {
				return e
			}
		}
		return nil
	}
	atom = func(role string) error {
		if i >= len(tokens) {
			return fmt.Errorf("expressão incompleta")
		}
		t := tokens[i]
		i++
		if t == "+" || t == "-" || t == "~" || t == "!" {
			return atom(role)
		}
		if t == "(" {
			if e := expression(role); e != nil {
				return e
			}
			if i >= len(tokens) || tokens[i] != ")" {
				return fmt.Errorf("feche os parênteses")
			}
			i++
			return nil
		}
		if t[0] >= '0' && t[0] <= '9' {
			literal := strings.TrimRight(t, "uUlL")
			base := 10
			if strings.HasPrefix(strings.ToLower(literal), "0x") {
				base = 16
				literal = literal[2:]
			}
			number, e := strconv.ParseUint(literal, base, 32)
			if role == "modifierMask" && number > 255 {
				return fmt.Errorf("máscara de modificadores deve estar entre 0 e 255")
			}
			if e != nil {
				return fmt.Errorf("o valor excede 32 bits")
			}
			return nil
		}
		if !symbolToken.MatchString(t) {
			return fmt.Errorf("esperado código ou número")
		}
		if i < len(tokens) && tokens[i] == "(" {
			count, ok := functions[t]
			_, ownFunction := functions[t]
			if !ok {
				count, ok = zmkdata.Catalog.Functions[t]
			}
			if !ok || (role == "keycode" && !keyFunctions[t] && !ownFunction) {
				return fmt.Errorf("função não reconhecida: %s", t)
			}
			i++
			actual := 0
			if i < len(tokens) && tokens[i] != ")" {
				for {
					if actual > 0 {
						i++
					}
					childRole := "scalar"
					if len(t) == 2 && strings.Contains(" LC LS LA LG RC RS RA RG ", " "+t+" ") {
						childRole = "keycode"
					}
					if e := expression(childRole); e != nil {
						return e
					}
					actual++
					if i >= len(tokens) || tokens[i] != "," {
						break
					}
				}
			}
			if i >= len(tokens) || tokens[i] != ")" || actual != count {
				return fmt.Errorf("%s exige %d argumentos", t, count)
			}
			i++
			return nil
		}
		if t == "MACRO_PLACEHOLDER" {
			if macro {
				return nil
			}
			return fmt.Errorf("MACRO_PLACEHOLDER só pode ser usado em macros")
		}
		valid := known[t]
		if role == "scalar" {
			valid = knownSymbols[t]
		}
		if role == "keycode" {
			valid = knownKeys[t]
		}
		if !valid && !custom[t] {
			return fmt.Errorf("código não reconhecido: %s; declare códigos próprios em um header ou #define", t)
		}
		return nil
	}
	if e := expression(kind); e != nil {
		return e
	}
	if i != len(tokens) {
		return fmt.Errorf("expressão inválida: %s", source)
	}
	hsb := regexp.MustCompile(`RGB_COLOR_HS[BV](?:_VAL)?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)`)
	for _, m := range hsb.FindAllStringSubmatch(source, -1) {
		h, _ := strconv.Atoi(m[1])
		s, _ := strconv.Atoi(m[2])
		b, _ := strconv.Atoi(m[3])
		if h > 360 || s > 100 || b > 100 {
			return fmt.Errorf("HSB: matiz de 0 a 360; saturação e brilho de 0 a 100")
		}
	}
	return nil
}
func ParameterKinds(name string, p models.Project, plugin models.Plugin) []string {
	return parameterKinds(name, p, plugin, map[string]bool{})
}
func parameterKinds(name string, p models.Project, plugin models.Plugin, seen map[string]bool) []string {
	if seen[name] {
		return nil
	}
	seen[name] = true
	defer delete(seen, name)
	for _, b := range p.Layout.Behaviors {
		if BehaviorReference(b) != name {
			continue
		}
		if b.Target != "" && len(b.Bindings) == 0 {
			if kinds, ok := zmkdata.Catalog.Bindings[b.Target]; ok {
				return kinds
			}
		}
		result := make([]string, BehaviorArity(b))
		for i := range result {
			result[i] = "scalar"
		}
		if b.Kind == "hold-tap" || b.Kind == "sticky-key" {
			for i, c := range b.Bindings {
				if i >= len(result) {
					break
				}
				f, _ := BindingParts(c)
				if len(f) > 0 {
					child := parameterKinds(strings.TrimPrefix(f[0], "&"), p, plugin, seen)
					if len(child) > 0 {
						result[i] = child[0]
					}
				}
			}
			return result
		}
		eq := map[string]string{"key-toggle": "kt", "toggle-layer": "tog", "momentary-layer": "mo", "to-layer": "to", "mouse-move": "mmv", "mouse-scroll": "msc"}
		if ref := eq[b.Kind]; ref != "" {
			return zmkdata.Catalog.Bindings[ref]
		}
		if b.Kind == "native" {
			ref := map[string]string{"zmk,behavior-key-press": "kp", "zmk,behavior-key-toggle": "kt", "zmk,behavior-momentary-layer": "mo"}[b.Compatible]
			if ref != "" {
				return zmkdata.Catalog.Bindings[ref]
			}
		}
		return result
	}
	for _, m := range p.Layout.Macros {
		if m.ID != name {
			continue
		}
		result := make([]string, m.ParameterCount)
		for i := range result {
			result[i] = "scalar"
		}
		routes := map[int]int{}
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
				kinds := parameterKinds(strings.TrimPrefix(f[0], "&"), p, plugin, seen)
				for to, from := range routes {
					if from > 0 && from <= len(result) && to > 0 && to <= len(kinds) {
						result[from-1] = kinds[to-1]
						if strings.HasSuffix(result[from-1], "Command") {
							result[from-1] = "scalar"
						}
					}
				}
			}
			routes = map[int]int{}
		}
		return result
	}
	if kinds, ok := zmkdata.Catalog.Bindings[name]; ok {
		return kinds
	}
	if n, ok := plugin.BindingArities[name]; ok {
		r := make([]string, n)
		for i := range r {
			r[i] = "scalar"
		}
		return r
	}
	return nil
}

// ValidateBinding checks an invocation independently of unrelated resources under construction.
func ValidateBinding(code string, p models.Project, plugin models.Plugin, macro bool) error {
	return NewBindingValidator(p, plugin)(code, macro)
}
func NewBindingValidator(p models.Project, plugin models.Plugin) func(string, bool) error {
	env := environment(p)
	return func(code string, macro bool) error { return validateBinding(code, p, plugin, macro, env) }
}
func validateBinding(code string, p models.Project, plugin models.Plugin, macro bool, env expressionEnvironment) error {
	parts, e := BindingParts(code)
	if e != nil {
		return e
	}
	name := strings.TrimPrefix(parts[0], "&")
	kinds := ParameterKinds(name, p, plugin)
	arity := BuiltinArities()
	for n, a := range plugin.BindingArities {
		arity[n] = a
	}
	for _, b := range p.Layout.Behaviors {
		arity[BehaviorReference(b)] = BehaviorArity(b)
	}
	for _, m := range p.Layout.Macros {
		arity[m.ID] = m.ParameterCount
	}
	if _, ok := arity[name]; !ok {
		return fmt.Errorf("comportamento desconhecido: %s", name)
	}
	kinds = append([]string{}, kinds...)
	if table, ok := zmkdata.Catalog.Commands[name]; ok {
		if len(parts) < 2 {
			return fmt.Errorf("ação incompleta")
		}
		if macro && parts[1] == "MACRO_PLACEHOLDER" {
			kinds = []string{"scalar", "scalar"}
		} else if extra, exists := table[parts[1]]; exists {
			kinds = append(kinds, extra...)
		} else if name == "rgb_ug" && (strings.HasPrefix(parts[1], "RGB_COLOR_HSB(") || strings.HasPrefix(parts[1], "RGB_COLOR_HSV(")) {
			kinds = []string{"scalar"}
		} else {
			return fmt.Errorf("comando desconhecido: %s", parts[1])
		}
	}
	if len(parts) != len(kinds)+1 {
		return fmt.Errorf("&%s exige %d parâmetros", name, len(kinds))
	}
	for i, kind := range kinds {
		v := parts[i+1]
		if macro && v == "MACRO_PLACEHOLDER" {
			continue
		}
		switch kind {
		case "layer":
			resolved, e := Resolve(v, p.Layout.Layers)
			if e != nil {
				return e
			}
			n, e := strconv.Atoi(resolved)
			if e != nil || n < 0 || n >= len(p.Layout.Layers) {
				return fmt.Errorf("escolha uma camada existente")
			}
		case "profile":
			n, e := strconv.Atoi(v)
			if e != nil || n < 0 || n >= p.Options.BluetoothProfiles {
				return fmt.Errorf("perfil Bluetooth inexistente")
			}
		case "percent":
			n, e := strconv.Atoi(v)
			if e != nil || n < 0 || n > 100 {
				return fmt.Errorf("o brilho deve estar entre 0 e 100")
			}
		case "integer":
			if !integerToken.MatchString(v) {
				return fmt.Errorf("use um inteiro positivo")
			}
			if n, e := strconv.ParseUint(v, 10, 32); e != nil || n > 0xffffffff {
				return fmt.Errorf("inteiro fora do limite de 32 bits")
			}
		default:
			if allowed, ok := zmkdata.Catalog.Choices[kind]; ok {
				found := false
				for _, a := range allowed {
					found = found || v == a
				}
				if found {
					continue
				}
				if kind != "move" && kind != "scroll" && kind != "mouseButton" {
					return fmt.Errorf("opção inválida para %s: %s", kind, v)
				}
			}
			role := "scalar"
			if kind == "keycode" {
				role = kind
			}
			if e := validateExpression(v, role, macro, env); e != nil {
				return e
			}
		}
	}
	return nil
}

// ValidateBehaviorValues checks the managed scalar/list properties without
// rejecting module-specific DTS properties the editor does not interpret.
func ValidateBehaviorValues(b models.Behavior, p models.Project) error {
	for name, value := range b.Properties {
		if value == "/delete-property/" {
			continue
		}
		managed := name == "mods" || name == "keep-mods" || name == "continue-list" || strings.HasSuffix(name, "-ms")
		if managed && (!strings.HasPrefix(strings.TrimSpace(value), "<") || !strings.HasSuffix(strings.TrimSpace(value), ">")) {
			return fmt.Errorf("%s requer um valor entre < e >", name)
		}
		body := strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(value), "<"), ">")
		switch name {
		case "mods", "keep-mods":
			if e := ValidateExpression(body, "modifierMask", p, false); e != nil {
				return e
			}
		default:
			if strings.HasSuffix(name, "-ms") {
				if e := ValidateExpression(body, "scalar", p, false); e != nil {
					return e
				}
			}
		case "continue-list":
			parts, e := BindingParts("&kp " + body)
			if e != nil {
				return e
			}
			for _, code := range parts[1:] {
				if e = ValidateExpression(code, "keycode", p, false); e != nil {
					return e
				}
			}
		}
	}
	return nil
}
