package keymap

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

// Import converts editable nodes and retains native DTS extensions. No changes
// are committed to the caller until the complete project passes validation.
func Import(source string, base models.Project, registry *devices.Registry) (models.Project, error) {
	p, err := read(source, base, registry)
	if err != nil {
		return models.Project{}, fmt.Errorf("não foi possível importar o .keymap: %w", err)
	}
	return p, nil
}

func read(source string, p models.Project, registry *devices.Registry) (models.Project, error) {
	document, err := parse(source, p.Headers)
	if err != nil {
		return p, err
	}
	d, err := registry.Get(p.PluginID)
	if err != nil {
		return p, err
	}
	plugin := d.Descriptor()
	p = project.Migrate(p)
	p.SchemaVersion = project.SchemaVersion
	p.Revision = ""
	p.SavedAt = ""
	p.Options.ModTap = project.NativeHoldTap("hold-preferred")
	p.Options.LayerTap = project.NativeHoldTap("tap-preferred")
	p.Preamble = preamble(source)
	for _, include := range quotedInclude.FindAllStringSubmatch(source, -1) {
		if _, present := p.Headers[include[1]]; present {
			if include[1] == "keys_pt_abnt2.h" {
				p.Options.Locale = "pt-br"
			} else {
				p.Options.Locale = "header:" + include[1]
			}
			break
		}
	}
	p.ExtraDTS = ""
	var keymap *node
	var resources, combos, conditionals, overlays, extras []*node
	var walk func(*node) error
	walk = func(n *node) error {
		for _, c := range n.children {
			switch {
			case c.name == "/":
				if len(c.props) > 0 {
					copy := *c
					copy.children = nil
					extras = append(extras, &copy)
				}
				if e := walk(c); e != nil {
					return e
				}
			case c.text("compatible") == "zmk,keymap":
				if keymap != nil {
					return fmt.Errorf("mais de um nó keymap")
				}
				keymap = c
			case c.name == "behaviors" || c.name == "macros":
				resources = append(resources, c.children...)
			case c.text("compatible") == "zmk,combos":
				combos = append(combos, c.children...)
			case c.text("compatible") == "zmk,conditional-layers":
				conditionals = append(conditionals, c.children...)
			case strings.HasPrefix(c.name, "&"):
				overlays = append(overlays, c)
			default:
				if n.name == "/" {
					extras = append(extras, &node{name: "/", props: map[string][]string{}, children: []*node{c}})
				} else {
					extras = append(extras, c)
				}
			}
		}
		return nil
	}
	if len(document.props) > 0 {
		return p, fmt.Errorf("conteúdo fora da árvore devicetree")
	}
	if err = walk(document); err != nil {
		return p, err
	}
	if keymap == nil || len(keymap.children) == 0 {
		return p, fmt.Errorf("nenhuma camada encontrada em zmk,keymap")
	}
	p.Layout = models.KeyboardLayout{Name: plugin.Name, Layers: []models.LayerData{}, Macros: []models.Macro{}, Combos: []models.Combo{}, Behaviors: []models.Behavior{}, ConditionalLayers: []models.ConditionalLayer{}}
	for i, n := range keymap.children {
		if err = n.allowed("bindings", "sensor-bindings"); err != nil {
			return p, err
		}
		codes, e := bindings(n.props["bindings"])
		if e != nil {
			return p, e
		}
		if len(codes) != plugin.KeyCount {
			return p, fmt.Errorf("camada %s: encontrados %d bindings; %s requer %d", n.title(), len(codes), plugin.Name, plugin.KeyCount)
		}
		l := models.LayerData{ID: fmt.Sprintf("layer_import_%d", i), Name: n.title(), Keys: make([]models.KeyAction, len(codes)), Sensors: append([]models.SensorAction{}, plugin.Sensors...)}
		for j, code := range codes {
			l.Keys[j] = models.KeyAction{KeymapIndex: j, Code: code}
		}
		for j := range l.Sensors {
			s := &l.Sensors[j]
			s.CodeCW = "&trans"
			s.CodeCCW = "&trans"
			s.Inherited = true
			s.CodeClick = codes[s.ClickKeymapIndex]
		}
		p.Layout.Layers = append(p.Layout.Layers, l)
	}
	aliases := map[string]string{}
	sensorNodes := map[string]*node{}
	labels := map[string]bool{}
	used := map[string]bool{}
	for _, n := range resources {
		used[n.label] = true
	}
	next := 0
	allocate := func() string {
		for {
			id := fmt.Sprintf("zm_import_%d", next)
			next++
			if !used[id] {
				used[id] = true
				return id
			}
		}
	}
	for _, n := range resources {
		if n.label == "" || labels[n.label] {
			return p, fmt.Errorf("label ausente ou duplicado: %s", n.name)
		}
		labels[n.label] = true
		if strings.Contains(n.text("compatible"), "behavior-sensor-rotate") {
			sensorNodes[n.label] = n
			continue
		}
		id := n.label
		if !project.IDPattern.MatchString(id) || !strings.HasPrefix(id, "zm_") || strings.HasPrefix(id, "zm_sensor_") {
			id = allocate()
		}
		aliases[n.label] = id
	}
	// Register every behavior before resolving parameter types or layer routes.
	for _, n := range resources {
		id, ok := aliases[n.label]
		if !ok {
			continue
		}
		if strings.HasPrefix(n.text("compatible"), "zmk,behavior-macro") {
			m, e := readMacro(n, id)
			if e != nil {
				return p, e
			}
			p.Layout.Macros = append(p.Layout.Macros, m)
		} else {
			if e := stableNativeLayers(n, p); e != nil {
				return p, e
			}
			b, e := readBehavior(n, id)
			if e != nil {
				return p, e
			}
			p.Layout.Behaviors = append(p.Layout.Behaviors, b)
		}
	}
	nativeOverlays := map[string]*node{}
	nativeOrder := []string{}
	for _, n := range overlays {
		if n.name == "&mt" || n.name == "&lt" {
			name := strings.TrimPrefix(n.name, "&")
			value := project.HoldTapOptions(p, name)
			value.TappingTermMs, err = n.number("tapping-term-ms", value.TappingTermMs)
			if err != nil {
				return p, err
			}
			value.QuickTapMs, err = n.number("quick-tap-ms", value.QuickTapMs)
			if err != nil {
				return p, err
			}
			if _, ok := n.props["flavor"]; ok {
				value.Flavor = n.text("flavor")
			}
			if name == "mt" {
				p.Options.ModTap = &value
				p.Options.TappingTermMs = value.TappingTermMs
				p.Options.QuickTapMs = value.QuickTapMs
				p.Options.Flavor = value.Flavor
			} else {
				p.Options.LayerTap = &value
			}
			other := copyProperties(n, "tapping-term-ms", "quick-tap-ms", "flavor", "display-name", "label")
			if len(other) > 0 {
				putOverride(&p, models.Behavior{ID: allocate(), Name: n.name, Kind: "native", Target: name, Compatible: "zmk,behavior-hold-tap", ParameterCount: 2, Properties: other})
			}
			continue
		}
		if strings.HasPrefix(n.name, "&") && hasProcessors(n) {
			native, e := readProcessors(n, &p, allocate)
			if e != nil {
				return p, e
			}
			if native != nil {
				extras = append(extras, native)
			}
			continue
		}
		if n.name == "&sensors" {
			if err = readSensorConfig(n, &p); err != nil {
				return p, err
			}
			continue
		}
		// Known built-in overrides remain configurable resources. Hardware and input
		// processor overlays are retained verbatim as native extensions.
		name := strings.TrimPrefix(n.name, "&")
		kinds := map[string]string{"sk": "sticky-key", "sl": "sticky-key", "caps_word": "caps-word", "key_repeat": "key-repeat", "kt": "key-toggle", "tog": "toggle-layer", "mo": "momentary-layer", "to": "to-layer", "mmv": "mouse-move", "msc": "mouse-scroll"}
		if kind, ok := kinds[name]; ok {
			b := models.Behavior{ID: allocate(), Name: n.name, Kind: kind, Target: name, Properties: copyProperties(n, "bindings", "display-name", "label")}
			if value, ok := n.props["bindings"]; ok {
				b.Bindings, err = bindings(value)
				if err != nil {
					return p, err
				}
			}
			putOverride(&p, b)
		} else {
			if existing, ok := nativeOverlays[n.name]; ok {
				mergeNode(existing, n)
			} else {
				nativeOverlays[n.name] = n
				nativeOrder = append(nativeOrder, n.name)
			}
		}
	}
	defaults, e := parse(plugin.Overlay)
	if e != nil {
		return p, e
	}
	for _, name := range nativeOrder {
		n := nativeOverlays[name]
		same := false
		for _, expected := range defaults.children {
			if renderTree(n) == renderTree(expected) {
				same = true
			}
		}
		if !same {
			extras = append(extras, n)
		}
	}
	for _, n := range combos {
		if err = n.allowed("timeout-ms", "key-positions", "bindings", "layers", "slow-release", "require-prior-idle-ms"); err != nil {
			return p, err
		}
		id := n.name
		if !project.IDPattern.MatchString(id) || !strings.HasPrefix(id, "zm_") {
			id = allocate()
		}
		c := models.Combo{ID: id, Name: n.title(), LayerIDs: []string{}}
		c.Positions, err = n.numbers("key-positions")
		if err != nil {
			return p, err
		}
		c.TimeoutMs, err = n.number("timeout-ms", 50)
		if err != nil {
			return p, err
		}
		codes, e := bindings(n.props["bindings"])
		if e != nil {
			return p, e
		}
		if len(codes) != 1 {
			return p, fmt.Errorf("combo precisa de uma ação")
		}
		c.Binding = codes[0]
		if _, ok := n.props["require-prior-idle-ms"]; ok {
			v, e := n.number("require-prior-idle-ms", -1)
			if e != nil {
				return p, e
			}
			c.RequirePriorIdleMs = &v
		}
		indices, e := n.numbers("layers")
		if e != nil {
			return p, e
		}
		for _, i := range indices {
			id, e := layerID(i, p)
			if e != nil {
				return p, e
			}
			c.LayerIDs = append(c.LayerIDs, id)
		}
		_, c.SlowRelease = n.props["slow-release"]
		p.Layout.Combos = append(p.Layout.Combos, c)
	}
	for _, n := range conditionals {
		if err = n.allowed("if-layers", "then-layer"); err != nil {
			return p, err
		}
		id := n.name
		if !project.IDPattern.MatchString(id) || !strings.HasPrefix(id, "zm_") {
			id = allocate()
		}
		c := models.ConditionalLayer{ID: id, Name: n.title(), IfLayerIDs: []string{}}
		indices, e := n.numbers("if-layers")
		if e != nil {
			return p, e
		}
		for _, i := range indices {
			id, e := layerID(i, p)
			if e != nil {
				return p, e
			}
			c.IfLayerIDs = append(c.IfLayerIDs, id)
		}
		index, e := n.number("then-layer", -1)
		if e != nil {
			return p, e
		}
		c.ThenLayerID, e = layerID(index, p)
		if e != nil {
			return p, e
		}
		p.Layout.ConditionalLayers = append(p.Layout.ConditionalLayers, c)
	}
	for li, n := range keymap.children {
		codes, e := bindings(n.props["sensor-bindings"])
		if e != nil {
			return p, e
		}
		if len(codes) > len(plugin.Sensors) {
			return p, fmt.Errorf("camada %s: encontrados %d encoders; %s oferece %d", n.title(), len(codes), plugin.Name, len(plugin.Sensors))
		}
		for si, code := range codes {
			pair, tap, e := sensorBindings(code, sensorNodes)
			if e != nil {
				return p, e
			}
			s := &p.Layout.Layers[li].Sensors[si]
			s.Inherited = strings.TrimSpace(code) == "&trans"
			s.CodeCW = pair[0]
			s.CodeCCW = pair[1]
			s.TapMs = tap
		}
	}
	rename := func(code string) string {
		return reference.ReplaceAllStringFunc(code, func(value string) string {
			if id, ok := aliases[strings.TrimPrefix(value, "&")]; ok {
				return "&" + id
			}
			return value
		})
	}
	normalize := func(code string) (string, error) {
		code = rename(code)
		f, e := project.BindingParts(code)
		if e != nil {
			return "", e
		}
		for _, index := range project.LayerArgumentIndices(strings.TrimPrefix(f[0], "&"), p) {
			if index >= len(f) {
				continue
			}
			if f[index] == "MACRO_PLACEHOLDER" || strings.HasPrefix(f[index], "@{") {
				continue
			}
			i, e := strconv.Atoi(f[index])
			if e != nil {
				return "", fmt.Errorf("camada inválida em %s", code)
			}
			id, e := layerID(i, p)
			if e != nil {
				return "", e
			}
			f[index] = "@{" + id + "}"
		}
		if strings.Contains(code, "PT_") {
			p.Options.Locale = "pt-br"
		}
		if f[0] == "&mkp" || f[0] == "&mmv" || f[0] == "&msc" {
			p.Options.Pointing = true
		}
		return strings.Join(f, " "), nil
	}
	// Rename children first so layer argument discovery sees the complete graph.
	for i := range p.Layout.Behaviors {
		for j := range p.Layout.Behaviors[i].Bindings {
			p.Layout.Behaviors[i].Bindings[j] = rename(p.Layout.Behaviors[i].Bindings[j])
		}
	}
	for i := range p.Layout.Macros {
		for j := range p.Layout.Macros[i].Steps {
			p.Layout.Macros[i].Steps[j].Binding = rename(p.Layout.Macros[i].Steps[j].Binding)
		}
	}
	apply := func(s *string) error {
		v, e := normalize(*s)
		if e == nil {
			*s = v
		}
		return e
	}
	for li := range p.Layout.Layers {
		l := &p.Layout.Layers[li]
		for ki := range l.Keys {
			if err = apply(&l.Keys[ki].Code); err != nil {
				return p, err
			}
		}
		for si := range l.Sensors {
			s := &l.Sensors[si]
			for _, code := range []*string{&s.CodeCW, &s.CodeCCW, &s.CodeClick} {
				if err = apply(code); err != nil {
					return p, err
				}
			}
		}
	}
	for i := range p.Layout.Behaviors {
		b := &p.Layout.Behaviors[i]
		for j := range b.Bindings {
			if b.Kind == "hold-tap" && len(strings.Fields(b.Bindings[j])) == 1 {
				continue
			}
			if err = apply(&b.Bindings[j]); err != nil {
				return p, err
			}
		}
		b.Children = rename(b.Children)
		for key, value := range b.Properties {
			b.Properties[key] = rename(value)
		}
	}
	for i := range p.Layout.Macros {
		for j := range p.Layout.Macros[i].Steps {
			s := &p.Layout.Macros[i].Steps[j]
			if s.Kind != "wait" && s.Kind != "control" {
				if err = apply(&s.Binding); err != nil {
					return p, err
				}
			}
		}
	}
	for i := range p.Layout.Combos {
		if err = apply(&p.Layout.Combos[i].Binding); err != nil {
			return p, err
		}
	}
	for _, n := range extras {
		if err := stableNativeLayers(n, p); err != nil {
			return p, err
		}
		p.ExtraDTS += rename(renderTree(n)) + "\n"
	}
	for i := range p.Layout.InputProcessors {
		for j, code := range p.Layout.InputProcessors[i].Bindings {
			code = rename(code)
			f, e := project.BindingParts(code)
			if e != nil {
				return p, e
			}
			if f[0] == "&zip_temp_layer" && len(f) > 1 && !strings.HasPrefix(f[1], "@{") {
				index, e := strconv.Atoi(f[1])
				if e != nil {
					return p, e
				}
				id, e := layerID(index, p)
				if e != nil {
					return p, e
				}
				f[1] = "@{" + id + "}"
			}
			p.Layout.InputProcessors[i].Bindings[j] = strings.Join(f, " ")
		}
	}

	if err = project.Validate(p, registry); err != nil {
		return p, err
	}
	return p, nil
}

func layerID(index int, p models.Project) (string, error) {
	if index < 0 || index >= len(p.Layout.Layers) {
		return "", fmt.Errorf("camada inexistente: %d", index)
	}
	return p.Layout.Layers[index].ID, nil
}

func copyProperties(n *node, except ...string) map[string]string {
	skip := map[string]bool{}
	for _, key := range except {
		skip[key] = true
	}
	result := map[string]string{}
	for key, value := range n.props {
		if !skip[key] {
			result[key] = strings.Join(value, " ")
		}
	}
	return result
}
func readBehavior(n *node, id string) (models.Behavior, error) {
	compatible := n.text("compatible")
	kind := strings.TrimPrefix(compatible, "zmk,behavior-")
	known := map[string]bool{"hold-tap": true, "tap-dance": true, "mod-morph": true, "sticky-key": true, "caps-word": true, "key-repeat": true, "key-toggle": true, "toggle-layer": true, "momentary-layer": true, "to-layer": true}
	if kind == "input-two-axis" {
		if strings.Contains(strings.Join(n.props["y-input-code"], ""), "WHEEL") {
			kind = "mouse-scroll"
		} else {
			kind = "mouse-move"
		}
		known[kind] = true
	}
	if !known[kind] {
		kind = "native"
	}
	b := models.Behavior{ID: id, Name: n.title(), Kind: kind, Compatible: compatible, Bindings: []string{}, HoldTriggerPositions: []int{}, Flavor: "hold-preferred"}
	var err error
	expected := project.BehaviorArity(b)
	b.ParameterCount, err = n.number("#binding-cells", expected)
	if err != nil {
		return b, err
	}
	if kind != "native" && b.ParameterCount != expected {
		return b, fmt.Errorf("%s requer #binding-cells = <%d>", kind, expected)
	}
	b.Bindings, err = bindings(n.props["bindings"])
	if err != nil {
		return b, err
	}
	skip := []string{"compatible", "#binding-cells", "bindings", "display-name", "label"}
	if kind == "hold-tap" || kind == "tap-dance" {
		b.TappingTermMs, err = n.number("tapping-term-ms", 200)
		if err != nil {
			return b, err
		}
		skip = append(skip, "tapping-term-ms")
	}
	if kind == "hold-tap" {
		b.ParameterCount = 2
		b.QuickTapMs, err = n.number("quick-tap-ms", -1)
		if err != nil {
			return b, err
		}
		b.RequirePriorIdleMs, err = n.number("require-prior-idle-ms", -1)
		if err != nil {
			return b, err
		}
		if v := n.text("flavor"); v != "" {
			b.Flavor = v
		}
		b.HoldTriggerPositions, err = n.numbers("hold-trigger-key-positions")
		if err != nil {
			return b, err
		}
		_, b.HoldTriggerOnRelease = n.props["hold-trigger-on-release"]
		_, b.RetroTap = n.props["retro-tap"]
		_, b.HoldWhileUndecided = n.props["hold-while-undecided"]
		_, b.HoldWhileUndecidedLinger = n.props["hold-while-undecided-linger"]
		skip = append(skip, "quick-tap-ms", "require-prior-idle-ms", "flavor", "hold-trigger-key-positions", "hold-trigger-on-release", "retro-tap", "hold-while-undecided", "hold-while-undecided-linger")
	}
	b.Properties = copyProperties(n, skip...)
	for _, child := range n.children {
		b.Children += renderTree(child)
	}
	return b, nil
}

func readMacro(n *node, id string) (models.Macro, error) {
	m := models.Macro{ID: id, Name: n.title(), Steps: []models.MacroStep{}}
	if err := n.allowed("compatible", "#binding-cells", "tap-ms", "wait-ms", "bindings"); err != nil {
		return m, err
	}
	var err error
	expected := 0
	if strings.HasSuffix(n.text("compatible"), "-one-param") {
		expected = 1
	}
	if strings.HasSuffix(n.text("compatible"), "-two-param") {
		expected = 2
	}
	m.ParameterCount, err = n.number("#binding-cells", expected)
	if err != nil {
		return m, err
	}
	if m.ParameterCount != expected {
		return m, fmt.Errorf("tipo de macro e #binding-cells divergentes")
	}
	m.TapMs, err = n.number("tap-ms", 30)
	if err != nil {
		return m, err
	}
	m.WaitMs, err = n.number("wait-ms", 15)
	if err != nil {
		return m, err
	}
	codes, err := bindings(n.props["bindings"])
	if err != nil {
		return m, err
	}
	mode := "tap"
	wait := m.WaitMs
	for i := 0; i < len(codes); i++ {
		code := codes[i]
		f := strings.Fields(code)
		name := strings.TrimPrefix(f[0], "&")
		// Recognize our exact no-op delay without accumulating implementation steps.
		if name == "macro_wait_time" && len(f) == 2 && i+4 < len(codes) && codes[i+1] == "&macro_press" && codes[i+2] == "&none" && codes[i+3] == fmt.Sprintf("&macro_wait_time %d", wait) && codes[i+4] == "&macro_"+mode {
			ms, e := strconv.Atoi(f[1])
			if e != nil {
				return m, e
			}
			m.Steps = append(m.Steps, models.MacroStep{Kind: "wait", DurationMs: ms})
			i += 4
			continue
		}
		if _, ok := project.MacroControls[name]; ok {
			if name == "macro_tap" || name == "macro_press" || name == "macro_release" {
				mode = strings.TrimPrefix(name, "macro_")
			}
			if name == "macro_wait_time" && len(f) == 2 {
				wait, err = strconv.Atoi(f[1])
				if err != nil {
					return m, err
				}
			}
			m.Steps = append(m.Steps, models.MacroStep{Kind: "control", Binding: code})
		} else {
			m.Steps = append(m.Steps, models.MacroStep{Kind: "binding", Binding: code})
		}
	}
	return m, nil
}

func sensorBindings(code string, nodes map[string]*node) ([]string, *int, error) {
	parts, e := project.BindingParts(code)
	if e != nil {
		return nil, nil, e
	}
	if parts[0] == "&inc_dec_kp" && len(parts) == 3 {
		return []string{"&kp " + parts[1], "&kp " + parts[2]}, nil, nil
	}
	if code == "&trans" || code == "&none" {
		return []string{code, code}, nil, nil
	}
	n, ok := nodes[strings.TrimPrefix(parts[0], "&")]
	if !ok {
		return nil, nil, fmt.Errorf("behavior de encoder desconhecido: %s", code)
	}
	if e = n.allowed("compatible", "#sensor-binding-cells", "bindings", "tap-ms"); e != nil {
		return nil, nil, e
	}
	codes, e := bindings(n.props["bindings"])
	if e != nil {
		return nil, nil, e
	}
	if len(codes) != 2 {
		return nil, nil, fmt.Errorf("encoder requer duas ações")
	}
	count, e := n.number("#sensor-binding-cells", 0)
	if e != nil {
		return nil, nil, e
	}
	var tap *int
	if _, ok := n.props["tap-ms"]; ok {
		v, e := n.number("tap-ms", 5)
		if e != nil {
			return nil, nil, e
		}
		tap = &v
	}
	if count == 2 && len(parts) == 3 {
		return []string{codes[0] + " " + parts[1], codes[1] + " " + parts[2]}, tap, nil
	}
	if count != 0 || len(parts) != 1 {
		return nil, nil, fmt.Errorf("parâmetros de encoder inválidos")
	}
	return codes, tap, nil
}

func readSensorConfig(n *node, p *models.Project) error {
	all, e := n.number("triggers-per-rotation", 0)
	if e != nil {
		return e
	}
	if err := func() error { copy := *n; copy.children = nil; return copy.allowed("triggers-per-rotation") }(); err != nil {
		return err
	}
	if len(n.children) > len(p.Layout.Layers[0].Sensors) {
		return fmt.Errorf("configuração de encoder incompatível")
	}
	for si := range p.Layout.Layers[0].Sensors {
		v := all
		if si < len(n.children) {
			c := n.children[si]
			if err := c.allowed("triggers-per-rotation"); err != nil {
				return err
			}
			v, e = c.number("triggers-per-rotation", all)
			if e != nil {
				return e
			}
		}
		for li := range p.Layout.Layers {
			p.Layout.Layers[li].Sensors[si].TriggersPerRotation = v
		}
	}
	return nil
}

func renderTree(n *node) string {
	var out strings.Builder
	if n.label != "" {
		out.WriteString(n.label + ": ")
	}
	out.WriteString(n.name + " {\n")
	keys := []string{}
	for k := range n.props {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if len(n.props[k]) == 1 && n.props[k][0] == "/delete-property/" {
			out.WriteString("  /delete-property/ " + k + ";\n")
			continue
		}
		out.WriteString("  " + k)
		if len(n.props[k]) > 0 {
			out.WriteString(" = " + strings.Join(n.props[k], " "))
		}
		out.WriteString(";\n")
	}
	for _, c := range n.children {
		out.WriteString(renderTree(c))
	}
	out.WriteString("};\n")
	return out.String()
}

func preamble(source string) string {
	var out strings.Builder
	// Keep defines before generated headers, where ZMK consumes configuration
	// defaults. Layer/key aliases have already been expanded in editable bindings.
	source = strings.ReplaceAll(source, "\\\n", " ")
	for _, match := range directive.FindAllStringSubmatch(source, -1) {
		if match[1] == "define" || match[1] == "include" {
			out.WriteString("#" + match[1] + match[2] + "\n")
		}
	}
	return out.String()
}

func hasProcessors(n *node) bool {
	if _, ok := n.props["input-processors"]; ok {
		return true
	}
	for _, c := range n.children {
		if _, ok := c.props["input-processors"]; ok {
			return true
		}
	}
	return false
}
func readProcessors(n *node, p *models.Project, allocate func() string) (*node, error) {
	remainder := *n
	remainder.props = map[string][]string{}
	remainder.children = nil
	for key, value := range n.props {
		if key != "input-processors" {
			remainder.props[key] = value
		}
	}
	add := func(c *node) error {
		codes, e := bindings(c.props["input-processors"])
		if e != nil {
			return e
		}
		if len(codes) == 0 {
			return nil
		}
		id := c.name
		if c == n || !project.IDPattern.MatchString(id) || !strings.HasPrefix(id, "zm_") {
			id = allocate()
		}
		chain := models.InputProcessorChain{ID: id, Listener: strings.TrimPrefix(n.name, "&"), Bindings: codes, LayerIDs: []string{}}
		if c != n {
			indices, e := c.numbers("layers")
			if e != nil {
				return e
			}
			for _, index := range indices {
				id, e := layerID(index, *p)
				if e != nil {
					return e
				}
				chain.LayerIDs = append(chain.LayerIDs, id)
			}
			_, chain.ProcessNext = c.props["process-next"]
			if len(chain.LayerIDs) == 0 {
				return fmt.Errorf("input processor por camada requer layers")
			}
		}
		p.Layout.InputProcessors = append(p.Layout.InputProcessors, chain)
		return nil
	}
	if err := add(n); err != nil {
		return nil, err
	}
	for _, c := range n.children {
		if _, ok := c.props["input-processors"]; ok {
			if err := c.allowed("layers", "input-processors", "process-next"); err != nil {
				return nil, err
			}
			if err := add(c); err != nil {
				return nil, err
			}
		} else {
			remainder.children = append(remainder.children, c)
		}
	}
	if len(remainder.props) == 0 && len(remainder.children) == 0 {
		return nil, nil
	}
	return &remainder, nil
}
func stableNativeLayers(n *node, p models.Project) error {
	for _, key := range []string{"layers", "if-layers", "then-layer"} {
		if value, ok := n.props[key]; ok {
			indices, e := cells(value)
			if e != nil {
				return e
			}
			next := []string{"<"}
			for _, text := range indices {
				index, e := strconv.Atoi(text)
				if e != nil {
					return fmt.Errorf("referência nativa de camada inválida: %s", text)
				}
				id, e := layerID(index, p)
				if e != nil {
					return e
				}
				next = append(next, "@{"+id+"}")
			}
			next = append(next, ">")
			n.props[key] = next
		}
	}
	for _, c := range n.children {
		if err := stableNativeLayers(c, p); err != nil {
			return err
		}
	}
	return nil
}

func mergeNode(dest, source *node) {
	for key, value := range source.props {
		dest.props[key] = value
	}
	for _, child := range source.children {
		found := false
		for _, existing := range dest.children {
			if existing.name == child.name {
				mergeNode(existing, child)
				found = true
				break
			}
		}
		if !found {
			dest.children = append(dest.children, child)
		}
	}
}

func putOverride(p *models.Project, b models.Behavior) {
	for i := range p.Layout.Behaviors {
		v := &p.Layout.Behaviors[i]
		if v.Target == b.Target && b.Target != "" {
			if v.Properties == nil {
				v.Properties = map[string]string{}
			}
			for k, value := range b.Properties {
				v.Properties[k] = value
			}
			if len(b.Bindings) > 0 {
				v.Bindings = b.Bindings
			}
			return
		}
	}
	p.Layout.Behaviors = append(p.Layout.Behaviors, b)
}
