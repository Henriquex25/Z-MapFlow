// Package keymap reads the editable subset of ZMK devicetree keymaps.
// It never executes a preprocessor or silently drops unsupported configuration.
package keymap

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

type node struct {
	name, label string
	props       map[string][]string
	children    []*node
}

func (n *node) text(key string) string {
	v := n.props[key]
	if len(v) == 1 {
		if s, err := strconv.Unquote(v[0]); err == nil {
			return s
		}
	}
	return ""
}
func (n *node) title() string {
	for _, key := range []string{"display-name", "label"} {
		if s := n.text(key); s != "" {
			return s
		}
	}
	return n.name
}
func (n *node) allowed(names ...string) error {
	allowed := map[string]bool{"label": true, "display-name": true}
	for _, name := range names {
		allowed[name] = true
	}
	for key := range n.props {
		if !allowed[key] {
			return fmt.Errorf("%s: propriedade não suportada: %s", n.name, key)
		}
		if key == "label" || key == "display-name" || key == "compatible" || key == "flavor" {
			value := n.props[key]
			if len(value) != 1 {
				return fmt.Errorf("%s: texto inválido em %s", n.name, key)
			}
			if _, err := strconv.Unquote(value[0]); err != nil {
				return fmt.Errorf("%s: esperado texto entre aspas em %s", n.name, key)
			}
		}
		if (key == "slow-release" || key == "hold-trigger-on-release") && len(n.props[key]) != 0 {
			return fmt.Errorf("%s: %s é uma propriedade booleana sem valor", n.name, key)
		}
	}
	if len(n.children) != 0 {
		return fmt.Errorf("%s: subnós não suportados", n.name)
	}
	return nil
}

// lex keeps modifier expressions such as LC(LS(A)) together, even with whitespace.
func lex(source string) ([]string, error) {
	var tokens []string
	for i := 0; i < len(source); {
		if unicode.IsSpace(rune(source[i])) {
			i++
			continue
		}
		if strings.HasPrefix(source[i:], "//") {
			for i < len(source) && source[i] != '\n' {
				i++
			}
			continue
		}
		if strings.HasPrefix(source[i:], "/*") {
			end := strings.Index(source[i+2:], "*/")
			if end < 0 {
				return nil, fmt.Errorf("comentário não terminado")
			}
			i += end + 4
			continue
		}
		start := i
		if source[i] == '"' {
			i++
			for i < len(source) && source[i] != '"' {
				if source[i] == '\\' {
					i++
				}
				i++
			}
			if i >= len(source) {
				return nil, fmt.Errorf("texto não terminado")
			}
			i++
		} else if strings.ContainsRune("{};=<>:,", rune(source[i])) {
			i++
		} else {
			depth := 0
			for i < len(source) {
				c := source[i]
				if depth == 0 && (unicode.IsSpace(rune(c)) || strings.ContainsRune("{};=<>:,", rune(c))) {
					break
				}
				if c == '(' {
					depth++
				}
				if c == ')' {
					depth--
				}
				if depth < 0 {
					return nil, fmt.Errorf("parênteses inválidos")
				}
				i++
			}
			if depth != 0 {
				return nil, fmt.Errorf("parênteses não terminados")
			}
		}
		tokens = append(tokens, source[start:i])
	}
	return tokens, nil
}

var directive = regexp.MustCompile(`(?m)^\s*#(include|define|if\w*|else|elif|endif|undef|pragma)\b([^\n]*)`)
var reference = regexp.MustCompile(`&[a-zA-Z_][a-zA-Z0-9_]*`)
var identifier = regexp.MustCompile(`[A-Za-z_][A-Za-z0-9_]*`)

func preprocess(source string, headers ...map[string]string) (string, error) {
	// Strip comments without changing quoted strings (e.g. a layer named "a // b").
	var clean strings.Builder
	quoted := false
	for i := 0; i < len(source); {
		if !quoted && (strings.HasPrefix(source[i:], "//") || strings.HasPrefix(source[i:], "/*")) {
			if source[i+1] == '/' {
				for i < len(source) && source[i] != '\n' {
					i++
				}
			} else {
				end := strings.Index(source[i+2:], "*/")
				if end < 0 {
					return "", fmt.Errorf("comentário não terminado")
				}
				for _, c := range source[i : i+end+4] {
					if c == '\n' {
						clean.WriteByte('\n')
					}
				}
				i += end + 4
			}
			clean.WriteByte(' ')
			continue
		}
		c := source[i]
		clean.WriteByte(c)
		i++
		if quoted && c == '\\' && i < len(source) {
			clean.WriteByte(source[i])
			i++
			continue
		}
		if c == '"' {
			quoted = !quoted
		}
	}
	source = strings.ReplaceAll(clean.String(), "\\\n", " ")
	defines := map[string]string{}
	var parseErr error
	source = directive.ReplaceAllStringFunc(source, func(line string) string {
		parts := directive.FindStringSubmatch(line)
		switch parts[1] {
		case "include":
			name := strings.Trim(strings.TrimSpace(parts[2]), "\"<>")
			local := false
			for _, files := range headers {
				_, exists := files[name]
				local = local || exists
			}
			if !local && name != "behaviors.dtsi" && name != "keys_pt_abnt2.h" && !strings.HasPrefix(name, "dt-bindings/zmk/") && !strings.HasPrefix(name, "input/") && !strings.HasPrefix(name, "zephyr/dt-bindings/") {
				parseErr = fmt.Errorf("include externo não suportado: %s; incorpore as definições no .keymap", name)
			}
		case "define":
			fields := strings.Fields(parts[2])
			if len(fields) < 2 || !regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`).MatchString(fields[0]) {
				parseErr = fmt.Errorf("#define não suportado: %s", strings.TrimSpace(parts[2]))
				break
			}
			if _, exists := defines[fields[0]]; exists {
				parseErr = fmt.Errorf("#define duplicado: %s", fields[0])
			}
			defines[fields[0]] = strings.Join(fields[1:], " ")
		default:
			parseErr = fmt.Errorf("diretiva não suportada: #%s", parts[1])
		}
		return "\n"
	})
	if parseErr != nil {
		return "", parseErr
	}
	var expand func(string, map[string]bool) (string, error)
	expansionBudget := 4 * 1024 * 1024
	expand = func(s string, visiting map[string]bool) (string, error) {
		expansionBudget -= len(s)
		if expansionBudget < 0 {
			return "", fmt.Errorf("expansão de #define muito grande")
		}
		if len(visiting) > 64 {
			return "", fmt.Errorf("aninhamento excessivo de #define")
		}
		var err error
		s = identifier.ReplaceAllStringFunc(s, func(id string) string {
			if err != nil {
				return ""
			}
			value, ok := defines[id]
			if !ok {
				return id
			}
			if visiting[id] {
				err = fmt.Errorf("#define circular: %s", id)
				return id
			}
			visiting[id] = true
			result, e := expand(value, visiting)
			delete(visiting, id)
			if e != nil {
				err = e
			}
			return result
		})
		if len(s) > 4*1024*1024 {
			return "", fmt.Errorf("expansão de #define muito grande")
		}
		return s, err
	}
	// Expand only unquoted tokens, never names or labels inside strings.
	tokens, err := lex(source)
	if err != nil {
		return "", err
	}
	for i, token := range tokens {
		if !strings.HasPrefix(token, "\"") {
			tokens[i], err = expand(token, map[string]bool{})
			if err != nil {
				return "", err
			}
		}
	}
	return strings.Join(tokens, " "), nil
}

func parse(source string, headers ...map[string]string) (*node, error) {
	source, err := preprocess(source, headers...)
	if err != nil {
		return nil, err
	}
	tokens, err := lex(source)
	if err != nil {
		return nil, err
	}
	i := 0
	var body func(string, string, int) (*node, error)
	body = func(name, label string, depth int) (*node, error) {
		if depth > 64 {
			return nil, fmt.Errorf("aninhamento excessivo")
		}
		n := &node{name: name, label: label, props: map[string][]string{}}
		for i < len(tokens) && tokens[i] != "}" {
			head := tokens[i]
			i++
			if head == ";" {
				continue
			}
			childLabel := ""
			if i < len(tokens) && tokens[i] == ":" {
				childLabel = head
				i++
				if i >= len(tokens) {
					return nil, fmt.Errorf("nó incompleto")
				}
				head = tokens[i]
				i++
			}
			if i >= len(tokens) {
				return nil, fmt.Errorf("configuração incompleta após %s", head)
			}
			if head == "/delete-property/" {
				key := tokens[i]
				i++
				if i >= len(tokens) || tokens[i] != ";" {
					return nil, fmt.Errorf("delete-property inválido")
				}
				i++
				n.props[key] = []string{"/delete-property/"}
				continue
			}
			if tokens[i] == "{" {
				i++
				child, e := body(head, childLabel, depth+1)
				if e != nil {
					return nil, e
				}
				n.children = append(n.children, child)
				if i >= len(tokens) || tokens[i] != "}" {
					return nil, fmt.Errorf("nó %s não terminado", head)
				}
				i++
			} else {
				if _, exists := n.props[head]; exists {
					return nil, fmt.Errorf("propriedade duplicada: %s", head)
				}
				value := []string{}
				if tokens[i] == "=" {
					i++
					for i < len(tokens) && tokens[i] != ";" && tokens[i] != "}" {
						value = append(value, tokens[i])
						i++
					}
					if len(value) == 0 {
						return nil, fmt.Errorf("propriedade vazia: %s", head)
					}
				}
				n.props[head] = value
			}
			if i >= len(tokens) || tokens[i] != ";" {
				return nil, fmt.Errorf("esperado ; após %s", head)
			}
			i++
		}
		return n, nil
	}
	root, err := body("document", "", 0)
	if err == nil && i != len(tokens) {
		err = fmt.Errorf("fechamento inesperado")
	}
	return root, err
}

func cells(value []string) ([]string, error) {
	var result []string
	open := false
	for _, t := range value {
		switch t {
		case "<":
			if open {
				return nil, fmt.Errorf("células aninhadas")
			}
			open = true
		case ">":
			if !open {
				return nil, fmt.Errorf("célula inválida")
			}
			open = false
		case ",":
			if open {
				return nil, fmt.Errorf("vírgula dentro de células")
			}
		default:
			if !open {
				return nil, fmt.Errorf("esperado <...>, encontrado %s", t)
			}
			result = append(result, t)
		}
	}
	if open {
		return nil, fmt.Errorf("célula não terminada")
	}
	return result, nil
}
func bindings(value []string) ([]string, error) {
	tokens, err := cells(value)
	if err != nil {
		return nil, err
	}
	result := []string{}
	for _, t := range tokens {
		if strings.HasPrefix(t, "&") {
			result = append(result, t)
		} else {
			if len(result) == 0 {
				return nil, fmt.Errorf("binding sem behavior: %s", t)
			}
			result[len(result)-1] += " " + strings.Join(strings.Fields(t), "")
		}
	}
	return result, nil
}
func (n *node) numbers(key string) ([]int, error) {
	tokens, err := cells(n.props[key])
	if err != nil {
		return nil, err
	}
	result := []int{}
	for _, t := range tokens {
		v, e := strconv.ParseInt(strings.Trim(t, "()"), 0, 32)
		if e != nil {
			return nil, fmt.Errorf("%s, %s: número inválido: %s", n.name, key, t)
		}
		result = append(result, int(v))
	}
	return result, nil
}
func (n *node) number(key string, fallback int) (int, error) {
	if _, ok := n.props[key]; !ok {
		return fallback, nil
	}
	v, err := n.numbers(key)
	if err != nil {
		return 0, err
	}
	if len(v) != 1 {
		return 0, fmt.Errorf("%s: esperado um número em %s", n.name, key)
	}
	return v[0], nil
}
