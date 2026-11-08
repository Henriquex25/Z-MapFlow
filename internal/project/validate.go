package project

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
)

var IDPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
var tokenPattern = regexp.MustCompile(`^(?:[A-Za-z0-9_()+]+|@\{[a-z][a-z0-9_]*\})$`)
var layerPattern = regexp.MustCompile(`@\{([a-z][a-z0-9_]*)\}`)

func Resolve(code string, layers []models.LayerData) (string, error) {
	var resolveErr error
	result := layerPattern.ReplaceAllStringFunc(code, func(token string) string {
		id := token[2 : len(token)-1]
		for i, l := range layers {
			if l.ID == id {
				return strconv.Itoa(i)
			}
		}
		resolveErr = fmt.Errorf("camada referenciada não existe: %s", id)
		return token
	})
	return result, resolveErr
}
func EachBinding(p models.Project, visit func(string) error) error {
	for _, l := range p.Layout.Layers {
		for _, k := range l.Keys {
			if err := visit(k.Code); err != nil {
				return fmt.Errorf("%s, tecla %d: %w", l.Name, k.KeymapIndex, err)
			}
		}
		for _, s := range l.Sensors {
			for _, c := range []string{s.CodeCW, s.CodeCCW, s.CodeClick} {
				if err := visit(c); err != nil {
					return fmt.Errorf("%s, %s: %w", l.Name, s.Label, err)
				}
			}
		}
	}
	for _, m := range p.Layout.Macros {
		for _, step := range m.Steps {
			if step.Kind != "wait" {
				if err := visit(step.Binding); err != nil {
					return fmt.Errorf("macro %s: %w", m.Name, err)
				}
			}
		}
	}
	for _, c := range p.Layout.Combos {
		if err := visit(c.Binding); err != nil {
			return fmt.Errorf("combo %s: %w", c.Name, err)
		}
	}
	for _, b := range p.Layout.Behaviors {
		for _, c := range b.Bindings {
			if err := visit(c); err != nil {
				return fmt.Errorf("behavior %s: %w", b.Name, err)
			}
		}
	}
	return nil
}
func Variant(p models.Project, plugin models.Plugin) (models.Variant, error) {
	for _, v := range plugin.Variants {
		if v.ID == p.VariantID {
			return v, nil
		}
	}
	return models.Variant{}, fmt.Errorf("variante de hardware não encontrada")
}
func Validate(p models.Project, r *devices.Registry) error {
	if p.SchemaVersion != 1 {
		return fmt.Errorf("versão de projeto não suportada: %d", p.SchemaVersion)
	}
	d, err := r.Get(p.PluginID)
	if err != nil {
		return err
	}
	plugin := d.Descriptor()
	if p.PluginVersion != plugin.Version {
		return fmt.Errorf("versão do plugin incompatível: %s", p.PluginVersion)
	}
	if _, err = Variant(p, plugin); err != nil {
		return err
	}
	if len(p.Layout.Layers) == 0 || len(p.Layout.Layers) > 32 {
		return fmt.Errorf("use entre 1 e 32 camadas")
	}
	layers := map[string]bool{}
	for _, l := range p.Layout.Layers {
		if !IDPattern.MatchString(l.ID) || layers[l.ID] || strings.TrimSpace(l.Name) == "" {
			return fmt.Errorf("identidade de camada inválida: %q", l.Name)
		}
		layers[l.ID] = true
		if len(l.Keys) != plugin.KeyCount {
			return fmt.Errorf("a camada %s precisa de %d bindings", l.Name, plugin.KeyCount)
		}
		keys := map[int]string{}
		for _, k := range l.Keys {
			if k.KeymapIndex < 0 || k.KeymapIndex >= plugin.KeyCount {
				return fmt.Errorf("índice de tecla inválido")
			}
			if _, ok := keys[k.KeymapIndex]; ok {
				return fmt.Errorf("índice de tecla duplicado")
			}
			keys[k.KeymapIndex] = k.Code
		}
		if len(l.Sensors) != len(plugin.Sensors) {
			return fmt.Errorf("sensores incompatíveis com o plugin")
		}
		seenSensors := map[string]bool{}
		for _, sensor := range l.Sensors {
			found := false
			for _, expected := range plugin.Sensors {
				if sensor.ID == expected.ID && sensor.ClickKeymapIndex == expected.ClickKeymapIndex {
					found = true
				}
			}
			if !found || seenSensors[sensor.ID] {
				return fmt.Errorf("sensor inválido: %s", sensor.ID)
			}
			seenSensors[sensor.ID] = true
			if keys[sensor.ClickKeymapIndex] != sensor.CodeClick {
				return fmt.Errorf("clique do encoder e tecla física estão divergentes")
			}
		}
	}
	if !hasCapability(plugin, "pointing") && p.Options.Pointing {
		return fmt.Errorf("o plugin não oferece ações de mouse")
	}
	if !hasCapability(plugin, "display") && p.Options.Display {
		return fmt.Errorf("o plugin não oferece display")
	}
	if p.Options.Locale != "us" && p.Options.Locale != "pt-br" {
		return fmt.Errorf("layout do sistema não suportado")
	}
	if p.Options.TappingTermMs < 1 || p.Options.TappingTermMs > 5000 || p.Options.QuickTapMs < 0 || p.Options.QuickTapMs > 5000 || !validFlavor(p.Options.Flavor) {
		return fmt.Errorf("parâmetros de tap/hold inválidos")
	}
	if p.Options.BluetoothProfiles < 1 || p.Options.BluetoothProfiles > 5 || p.Options.SleepTimeoutMs < 1000 || p.Options.SleepTimeoutMs > 86400000 {
		return fmt.Errorf("configuração de Bluetooth/repouso inválida")
	}
	ids := map[string]bool{}
	arity := map[string]int{"kp": 1, "none": 0, "trans": 0, "mt": 2, "lt": 2, "mo": 1, "to": 1, "tog": 1, "sl": 1, "sk": 1, "bt": -1, "out": 1, "bootloader": 0, "caps_word": 0, "key_repeat": 0, "sys_reset": 0, "studio_unlock": 0, "kt": 1, "mkp": 1, "mmv": 1, "msc": 1, "rgb_ug": 1, "ext_power": 1}
	for name, n := range plugin.BindingArities {
		if _, exists := arity[name]; exists {
			return fmt.Errorf("plugin redefine behavior padrão: %s", name)
		}
		arity[name] = n
	}
	reserve := func(id string) error {
		if !IDPattern.MatchString(id) || !strings.HasPrefix(id, "zm_") || strings.HasPrefix(id, "zm_sensor_") || ids[id] {
			return fmt.Errorf("ID de recurso inválido ou duplicado: %s", id)
		}
		ids[id] = true
		return nil
	}
	for _, m := range p.Layout.Macros {
		if err = reserve(m.ID); err != nil {
			return err
		}
		arity[m.ID] = 0
		if len(m.Steps) == 0 || len(m.Steps) > 512 || m.TapMs < 0 || m.TapMs > 5000 || m.WaitMs < 0 || m.WaitMs > 5000 {
			return fmt.Errorf("macro %s: duração ou quantidade de passos inválida", m.Name)
		}
		for _, s := range m.Steps {
			switch s.Kind {
			case "tap", "press", "release":
			case "wait":
				if s.DurationMs < 0 || s.DurationMs > 60000 {
					return fmt.Errorf("espera inválida na macro %s", m.Name)
				}
			default:
				return fmt.Errorf("passo de macro inválido")
			}
		}
	}
	for _, b := range p.Layout.Behaviors {
		if err = reserve(b.ID); err != nil {
			return err
		}
		arity[b.ID] = 0
		if b.TappingTermMs < 1 || b.TappingTermMs > 5000 {
			return fmt.Errorf("tempo inválido em %s", b.Name)
		}
		if b.RequirePriorIdleMs < 0 || b.RequirePriorIdleMs > 5000 {
			return fmt.Errorf("tempo de inatividade inválido")
		}
		seenPositions := map[int]bool{}
		for _, pos := range b.HoldTriggerPositions {
			if pos < 0 || pos >= plugin.KeyCount || seenPositions[pos] {
				return fmt.Errorf("posição de hold-trigger inválida")
			}
			seenPositions[pos] = true
		}
		switch b.Kind {
		case "hold-tap":
			arity[b.ID] = 2
			if len(b.Bindings) != 2 || !validFlavor(b.Flavor) || b.QuickTapMs < 0 || b.QuickTapMs > 5000 {
				return fmt.Errorf("hold-tap inválido")
			}
			hold := strings.Fields(b.Bindings[0])
			tap := strings.Fields(b.Bindings[1])
			if len(hold) != 2 || len(tap) != 2 || (hold[0] != "&kp" && hold[0] != "&mo") || tap[0] != "&kp" {
				return fmt.Errorf("hold deve ser uma tecla/modificador ou camada; tap deve ser uma tecla")
			}
		case "tap-dance":
			if len(b.Bindings) < 1 || len(b.Bindings) > 16 {
				return fmt.Errorf("tap-dance precisa de 1 a 16 ações")
			}
		default:
			return fmt.Errorf("tipo de behavior não suportado")
		}
	}
	for _, c := range p.Layout.Combos {
		if err = reserve(c.ID); err != nil {
			return err
		}
		if len(c.Positions) < 2 || c.TimeoutMs < 1 || c.TimeoutMs > 5000 {
			return fmt.Errorf("combo %s: selecione ao menos duas teclas e um timeout válido", c.Name)
		}
		seen := map[int]bool{}
		for _, pos := range c.Positions {
			if pos < 0 || pos >= plugin.KeyCount || seen[pos] {
				return fmt.Errorf("posição inválida ou duplicada em %s", c.Name)
			}
			seen[pos] = true
		}
		for _, id := range c.LayerIDs {
			if !layers[id] {
				return fmt.Errorf("camada do combo não existe")
			}
		}
	}
	check := func(code string) error {
		parts := strings.Fields(code)
		if len(parts) == 0 || !strings.HasPrefix(parts[0], "&") {
			return fmt.Errorf("binding inválido: %q", code)
		}
		name := strings.TrimPrefix(parts[0], "&")
		if (name == "mkp" || name == "mmv" || name == "msc") && !p.Options.Pointing {
			return fmt.Errorf("ative ações de mouse nas configurações")
		}
		if strings.Contains(code, "PT_") && p.Options.Locale != "pt-br" {
			return fmt.Errorf("selecione o layout ABNT2 para usar códigos PT_")
		}

		expected, ok := arity[name]
		if !ok {
			return fmt.Errorf("behavior desconhecido: %s", name)
		}
		if expected >= 0 && len(parts) != expected+1 {
			return fmt.Errorf("%s espera %d parâmetros", parts[0], expected)
		}
		if name == "bt" {
			if len(parts) < 2 {
				return fmt.Errorf("ação Bluetooth incompleta")
			}
			switch parts[1] {
			case "BT_CLR", "BT_NXT", "BT_PRV", "BT_CLR_ALL":
				if len(parts) != 2 {
					return fmt.Errorf("ação Bluetooth inválida")
				}
			case "BT_SEL":
				if len(parts) != 3 {
					return fmt.Errorf("perfil Bluetooth ausente")
				}
				n, e := strconv.Atoi(parts[2])
				if e != nil || n < 0 || n >= p.Options.BluetoothProfiles {
					return fmt.Errorf("perfil Bluetooth inexistente")
				}
			default:
				return fmt.Errorf("ação Bluetooth desconhecida")
			}
		}
		for _, t := range parts[1:] {
			if !tokenPattern.MatchString(t) {
				return fmt.Errorf("parâmetro inválido: %s", t)
			}
			depth := 0
			for _, ch := range t {
				if ch == '(' {
					depth++
				}
				if ch == ')' {
					depth--
				}
				if depth < 0 {
					return fmt.Errorf("parênteses inválidos")
				}
			}
			if depth != 0 {
				return fmt.Errorf("parênteses inválidos")
			}
		}
		resolved, e := Resolve(code, p.Layout.Layers)
		if e != nil {
			return e
		}
		resolvedParts := strings.Fields(resolved)
		layerArg := name == "mo" || name == "to" || name == "tog" || name == "sl" || name == "lt"
		for _, b := range p.Layout.Behaviors {
			if b.ID == name && b.Kind == "hold-tap" && strings.HasPrefix(b.Bindings[0], "&mo ") {
				layerArg = true
			}
		}
		if layerArg {
			n, e := strconv.Atoi(resolvedParts[1])
			if e != nil || n < 0 || n >= len(p.Layout.Layers) {
				return fmt.Errorf("camada de destino inexistente: %s", parts[1])
			}
		}
		return nil
	}
	if err = EachBinding(p, check); err != nil {
		return err
	}
	// Recursive macro/tap-dance graphs cannot be executed safely by firmware.
	graph := map[string][]string{}
	addEdge := func(id, code string) {
		f := strings.Fields(code)
		if len(f) > 0 {
			ref := strings.TrimPrefix(f[0], "&")
			if ids[ref] {
				graph[id] = append(graph[id], ref)
			}
		}
	}
	for _, m := range p.Layout.Macros {
		for _, s := range m.Steps {
			if s.Kind != "wait" {
				addEdge(m.ID, s.Binding)
			}
		}
	}
	for _, b := range p.Layout.Behaviors {
		for _, c := range b.Bindings {
			addEdge(b.ID, c)
		}
	}
	visiting := map[string]bool{}
	done := map[string]bool{}
	var visit func(string) error
	visit = func(id string) error {
		if visiting[id] {
			return fmt.Errorf("referência circular no recurso %s", id)
		}
		if done[id] {
			return nil
		}
		visiting[id] = true
		for _, ref := range graph[id] {
			if e := visit(ref); e != nil {
				return e
			}
		}
		visiting[id] = false
		done[id] = true
		return nil
	}
	for id := range graph {
		if err = visit(id); err != nil {
			return err
		}
	}
	return nil
}
func validFlavor(s string) bool {
	return s == "hold-preferred" || s == "balanced" || s == "tap-preferred" || s == "tap-unless-interrupted"
}
