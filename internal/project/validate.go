package project

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
	"z-mapflow/internal/zmkdata"
)

var IDPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)
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
	return EachBindingContext(p, func(code string, _ bool) error { return visit(code) })
}
func EachBindingContext(p models.Project, visit func(string, bool) error) error {
	for _, l := range p.Layout.Layers {
		for _, k := range l.Keys {
			if err := visit(k.Code, false); err != nil {
				return fmt.Errorf("%s, tecla %d: %w", l.Name, k.KeymapIndex, err)
			}
		}
		for _, s := range l.Sensors {
			for _, c := range []string{s.CodeCW, s.CodeCCW, s.CodeClick} {
				if err := visit(c, false); err != nil {
					return fmt.Errorf("%s, %s: %w", l.Name, s.Label, err)
				}
			}
		}
	}
	for _, m := range p.Layout.Macros {
		for _, step := range m.Steps {
			if step.Kind != "wait" && step.Kind != "control" {
				if err := visit(step.Binding, true); err != nil {
					return fmt.Errorf("macro %s: %w", m.Name, err)
				}
			}
		}
	}
	for _, c := range p.Layout.Combos {
		if err := visit(c.Binding, false); err != nil {
			return fmt.Errorf("combo %s: %w", c.Name, err)
		}
	}
	for _, b := range p.Layout.Behaviors {
		for _, c := range b.Bindings {
			// Hold-tap definitions name child behaviors; their parameters are supplied
			// by each use. Optional template parameters are only assignment defaults.
			if b.Kind == "hold-tap" || b.Kind == "sticky-key" {
				continue
			}
			if err := visit(c, false); err != nil {
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
	p = Migrate(p)
	if p.SchemaVersion != SchemaVersion {
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
	if err = ValidateBuild(p, plugin); err != nil {
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
			if sensor.TapMs != nil && (*sensor.TapMs < 0 || *sensor.TapMs > 60000) || sensor.TriggersPerRotation < 0 || sensor.TriggersPerRotation > 10000 {
				return fmt.Errorf("parâmetros do encoder inválidos")
			}
			if len(p.Layout.Layers) > 0 {
				for _, first := range p.Layout.Layers[0].Sensors {
					if first.ID == sensor.ID && first.TriggersPerRotation != sensor.TriggersPerRotation {
						return fmt.Errorf("resolução do encoder deve ser a mesma em todas as camadas")
					}
				}
			}
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
	_, customLocale := p.Headers[strings.TrimPrefix(p.Options.Locale, "header:")]
	customLocale = customLocale && strings.HasPrefix(p.Options.Locale, "header:")
	if p.Options.Locale != "us" && p.Options.Locale != "pt-br" && !customLocale {
		return fmt.Errorf("layout do sistema não suportado")
	}
	for _, name := range []string{"mt", "lt"} {
		v := HoldTapOptions(p, name)
		if v.TappingTermMs < 1 || v.TappingTermMs > 5000 || v.QuickTapMs < -1 || v.QuickTapMs > 5000 || !validFlavor(v.Flavor) {
			return fmt.Errorf("parâmetros de %s inválidos", name)
		}
	}
	if p.Options.BluetoothProfiles < 1 || p.Options.BluetoothProfiles > 5 || p.Options.SleepTimeoutMs < 1000 || p.Options.SleepTimeoutMs > 86400000 {
		return fmt.Errorf("configuração de Bluetooth/repouso inválida")
	}
	ids := map[string]bool{}
	targets := map[string]bool{}
	arity := BuiltinArities()
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
		arity[m.ID] = m.ParameterCount
		if m.ParameterCount < 0 || m.ParameterCount > 2 || len(m.Steps) == 0 || m.TapMs < 0 || m.TapMs > 60000 || m.WaitMs < 0 || m.WaitMs > 60000 {
			return fmt.Errorf("macro %s: duração ou quantidade de passos inválida", m.Name)
		}
		if _, e := MacroBindings(m); e != nil {
			return e
		}
	}
	for _, b := range p.Layout.Behaviors {
		if err = reserve(b.ID); err != nil {
			return err
		}
		if b.Target != "" {
			if !referencePattern.MatchString("&"+b.Target) || targets[b.Target] {
				return fmt.Errorf("personalização de behavior inválida ou duplicada: %s", b.Target)
			}
			targets[b.Target] = true
		}
		if value, ok := b.Properties["locking"]; ok && value != "/delete-property/" {
			v, _ := Variant(p, plugin)
			supported := false
			for _, f := range v.Features {
				supported = supported || f == "layer-locking"
			}
			if !supported {
				return fmt.Errorf("o perfil selecionado não oferece layer locking; selecione um perfil compatível")
			}
		}
		arity[BehaviorReference(b)] = BehaviorArity(b)
		if b.ParameterCount < 0 || b.ParameterCount > 2 {
			return fmt.Errorf("behavior aceita de 0 a 2 parâmetros")
		}
		if err := ValidateBehaviorValues(b, p); err != nil {
			return fmt.Errorf("%s: %w", b.Name, err)
		}
		if err := ValidateProperties(b.Properties); err != nil {
			return err
		}
		for _, value := range b.Properties {
			if _, err := Resolve(value, p.Layout.Layers); err != nil {
				return err
			}
		}
		if _, err := Resolve(b.Children, p.Layout.Layers); err != nil {
			return err
		}
		if (b.Kind == "hold-tap" || b.Kind == "tap-dance") && (b.TappingTermMs < 1 || b.TappingTermMs > 5000) {
			return fmt.Errorf("tempo inválido em %s", b.Name)
		}
		if b.RequirePriorIdleMs < -1 || b.RequirePriorIdleMs > 5000 {
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
			if len(b.Bindings) != 2 || !validFlavor(b.Flavor) || b.QuickTapMs < -1 || b.QuickTapMs > 5000 {
				return fmt.Errorf("hold-tap inválido")
			}
		case "tap-dance":
			if len(b.Bindings) < 1 || len(b.Bindings) > 256 {
				return fmt.Errorf("tap-dance precisa de 1 a 256 ações")
			}
		case "mod-morph":
			if len(b.Bindings) != 2 || b.Properties["mods"] == "" {
				return fmt.Errorf("mod-morph requer duas ações e modificadores")
			}
		case "sticky-key":
			if b.Target == "" && b.Properties["release-after-ms"] == "" {
				return fmt.Errorf("sticky key requer release-after-ms")
			}
			if b.Target == "" && len(b.Bindings) != 1 {
				return fmt.Errorf("sticky key requer uma ação base")
			}
		case "caps-word", "key-repeat", "key-toggle", "toggle-layer", "momentary-layer", "to-layer", "mouse-move", "mouse-scroll":
		case "native":
			if n, known := zmkdata.Catalog.NativeArities[b.Compatible]; known && n != b.ParameterCount {
				return fmt.Errorf("%s exige %d parâmetros", b.Compatible, n)
			}
			if !compatiblePattern.MatchString(b.Compatible) {
				return fmt.Errorf("compatible inválido")
			}
		default:
			return fmt.Errorf("tipo de behavior não suportado")
		}
	}
	// Validate composition after all arities are registered, allowing forward refs.
	for _, b := range p.Layout.Behaviors {
		if b.Kind == "hold-tap" {
			for _, code := range b.Bindings {
				f, e := BindingParts(code)
				if e != nil {
					return e
				}
				n, ok := arity[strings.TrimPrefix(f[0], "&")]
				if !ok || n < 0 || n > 1 {
					return fmt.Errorf("hold-tap %s requer children de zero ou um parâmetro; use uma macro para comandos", b.Name)
				}
			}
		}
	}
	for _, c := range p.Layout.Combos {
		if err = reserve(c.ID); err != nil {
			return err
		}
		if len(c.Positions) < 2 || c.TimeoutMs < 1 || c.TimeoutMs > 5000 {
			return fmt.Errorf("combo %s: selecione ao menos duas teclas e um timeout válido", c.Name)
		}
		if c.RequirePriorIdleMs != nil && (*c.RequirePriorIdleMs < -1 || *c.RequirePriorIdleMs > 60000) {
			return fmt.Errorf("inatividade de combo inválida")
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
	if err := validateConditionalLayers(p); err != nil {
		return err
	}
	for _, chain := range p.Layout.InputProcessors {
		if !IDPattern.MatchString(chain.ID) || !referencePattern.MatchString("&"+chain.Listener) || len(chain.Bindings) == 0 {
			return fmt.Errorf("cadeia de input processors inválida")
		}
		for _, code := range chain.Bindings {
			if _, err := BindingParts(code); err != nil {
				return err
			}
			if _, err := Resolve(code, p.Layout.Layers); err != nil {
				return err
			}
		}
		for _, id := range chain.LayerIDs {
			if !layers[id] {
				return fmt.Errorf("camada de input processor não existe")
			}
		}
	}
	validateInvocation := NewBindingValidator(p, plugin)
	check := func(code string, macro bool) error {
		parts, e := BindingParts(code)
		if e != nil {
			return e
		}
		name := strings.TrimPrefix(parts[0], "&")
		if (name == "mkp" || name == "mmv" || name == "msc") && !p.Options.Pointing {
			return fmt.Errorf("ative ações de mouse nas configurações")
		}

		expected, ok := arity[name]
		if !ok {
			return fmt.Errorf("behavior desconhecido: %s", name)
		}
		if expected >= 0 && len(parts) != expected+1 {
			return fmt.Errorf("%s espera %d parâmetros", parts[0], expected)
		}
		resolved, e := Resolve(code, p.Layout.Layers)
		if e != nil {
			return e
		}
		resolvedParts, _ := BindingParts(resolved)
		for _, index := range LayerArgumentIndices(name, p) {
			if index >= len(parts) {
				return fmt.Errorf("parâmetro de camada ausente")
			}
			if parts[index] == "MACRO_PLACEHOLDER" {
				continue
			}
			n, e := strconv.Atoi(resolvedParts[index])
			if e != nil || n < 0 || n >= len(p.Layout.Layers) {
				return fmt.Errorf("camada de destino inexistente: %s", parts[index])
			}
		}
		return validateInvocation(code, macro)
	}
	if err = EachBindingContext(p, check); err != nil {
		return err
	}
	if _, err := Resolve(p.ExtraDTS, p.Layout.Layers); err != nil {
		return err
	}
	// Recursive macro/tap-dance graphs cannot be executed safely by firmware.
	graph := map[string][]string{}
	refs := map[string]bool{}
	for _, m := range p.Layout.Macros {
		refs[m.ID] = true
	}
	for _, b := range p.Layout.Behaviors {
		refs[BehaviorReference(b)] = true
	}
	addEdge := func(id, code string) {
		f := strings.Fields(code)
		if len(f) > 0 {
			ref := strings.TrimPrefix(f[0], "&")
			if refs[ref] {
				graph[id] = append(graph[id], ref)
			}
		}
	}
	for _, m := range p.Layout.Macros {
		for _, s := range m.Steps {
			if s.Kind != "wait" && s.Kind != "control" {
				addEdge(m.ID, s.Binding)
			}
		}
	}
	for _, b := range p.Layout.Behaviors {
		for _, c := range b.Bindings {
			addEdge(BehaviorReference(b), c)
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
	for id := range refs {
		if err = visit(id); err != nil {
			return err
		}
	}
	required := MacroQueueSize(p)
	if required > 32768 {
		return fmt.Errorf("a expansão da macro exige uma fila muito grande; divida a sequência")
	}
	for _, line := range strings.Split(p.ExtraConfig, "\n") {
		key, value, ok := strings.Cut(strings.TrimSpace(line), "=")
		if ok && key == "CONFIG_ZMK_BEHAVIORS_QUEUE_SIZE" {
			n, e := strconv.Atoi(strings.TrimSpace(value))
			if e != nil || n < required {
				return fmt.Errorf("a fila de behaviors deve ter ao menos %d eventos para estas macros", required)
			}
		}
	}
	return nil
}
func validFlavor(s string) bool {
	return s == "hold-preferred" || s == "balanced" || s == "tap-preferred" || s == "tap-unless-interrupted"
}
