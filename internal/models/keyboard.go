package models

// Project is the versioned source of truth. Build jobs always use a saved revision.
type Project struct {
	SchemaVersion int               `json:"schemaVersion"`
	PluginID      string            `json:"pluginId"`
	PluginVersion string            `json:"pluginVersion"`
	VariantID     string            `json:"variantId"`
	Revision      string            `json:"revision"`
	SavedAt       string            `json:"savedAt"`
	Layout        KeyboardLayout    `json:"layout"`
	Options       Options           `json:"options"`
	Preamble      string            `json:"preamble,omitempty"`
	ExtraDTS      string            `json:"extraDts,omitempty"`
	ExtraConfig   string            `json:"extraConfig,omitempty"`
	Headers       map[string]string `json:"headers,omitempty"`
	BuildTargets  []BuildTarget     `json:"buildTargets,omitempty"`
}

// BuildTarget contains user settings; hardware identity remains plugin-owned.
type BuildTarget struct {
	TargetID  string   `json:"targetId"`
	Snippets  []string `json:"snippets,omitempty"`
	CMakeArgs []string `json:"cmakeArgs,omitempty"`
}
type HeaderBundle struct {
	Name  string            `json:"name"`
	Files map[string]string `json:"files"`
}
type HoldTapSettings struct {
	TappingTermMs int    `json:"tappingTermMs"`
	QuickTapMs    int    `json:"quickTapMs"`
	Flavor        string `json:"flavor"`
}
type Options struct {
	RGBUnderglow      bool             `json:"rgbUnderglow,omitempty"`
	Backlight         bool             `json:"backlight,omitempty"`
	SoftOff           bool             `json:"softOff,omitempty"`
	ModTap            *HoldTapSettings `json:"modTap,omitempty"`
	LayerTap          *HoldTapSettings `json:"layerTap,omitempty"`
	Locale            string           `json:"locale"`
	Display           bool             `json:"display"`
	Pointing          bool             `json:"pointing"`
	TappingTermMs     int              `json:"tappingTermMs"`
	QuickTapMs        int              `json:"quickTapMs"`
	Flavor            string           `json:"flavor"`
	BluetoothProfiles int              `json:"bluetoothProfiles"`
	Sleep             bool             `json:"sleep"`
	SleepTimeoutMs    int              `json:"sleepTimeoutMs"`
}
type KeyAction struct {
	KeymapIndex int    `json:"keymapIndex"`
	Row         int    `json:"row"`
	Col         int    `json:"col"`
	Code        string `json:"code"`
	Label       string `json:"label"`
}
type SensorAction struct {
	Inherited           bool   `json:"inherited,omitempty"`
	TapMs               *int   `json:"tapMs,omitempty"`
	TriggersPerRotation int    `json:"triggersPerRotation,omitempty"`
	ID                  string `json:"id"`
	Label               string `json:"label"`
	CodeCW              string `json:"codeCW"`
	CodeCCW             string `json:"codeCCW"`
	CodeClick           string `json:"codeClick"`
	ClickKeymapIndex    int    `json:"clickKeymapIndex"`
}
type LayerData struct {
	ID      string         `json:"id"`
	Name    string         `json:"name"`
	Keys    []KeyAction    `json:"keys"`
	Sensors []SensorAction `json:"sensors"`
}
type KeyboardLayout struct {
	InputProcessors   []InputProcessorChain `json:"inputProcessors,omitempty"`
	ConditionalLayers []ConditionalLayer    `json:"conditionalLayers,omitempty"`
	Name              string                `json:"name"`
	Layers            []LayerData           `json:"layers"`
	Macros            []Macro               `json:"macros"`
	Combos            []Combo               `json:"combos"`
	Behaviors         []Behavior            `json:"behaviors"`
}
type InputProcessorChain struct {
	ID          string   `json:"id"`
	Listener    string   `json:"listener"`
	LayerIDs    []string `json:"layerIds"`
	Bindings    []string `json:"bindings"`
	ProcessNext bool     `json:"processNext"`
}
type ConditionalLayer struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	IfLayerIDs  []string `json:"ifLayerIds"`
	ThenLayerID string   `json:"thenLayerId"`
}
type Macro struct {
	ParameterCount int         `json:"parameterCount,omitempty"`
	Parameters     []string    `json:"parameters,omitempty"`
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	TapMs          int         `json:"tapMs"`
	WaitMs         int         `json:"waitMs"`
	Steps          []MacroStep `json:"steps"`
}
type MacroStep struct {
	Kind       string `json:"kind"` // tap, press, release, wait, binding, control
	Binding    string `json:"binding"`
	DurationMs int    `json:"durationMs"`
}
type Combo struct {
	RequirePriorIdleMs *int     `json:"requirePriorIdleMs,omitempty"`
	ID                 string   `json:"id"`
	Name               string   `json:"name"`
	Positions          []int    `json:"positions"`
	Binding            string   `json:"binding"`
	LayerIDs           []string `json:"layerIds"` // empty means every layer
	TimeoutMs          int      `json:"timeoutMs"`
	SlowRelease        bool     `json:"slowRelease"`
}
type Behavior struct {
	Children                 string            `json:"children,omitempty"`
	RetroTap                 bool              `json:"retroTap,omitempty"`
	HoldWhileUndecided       bool              `json:"holdWhileUndecided,omitempty"`
	HoldWhileUndecidedLinger bool              `json:"holdWhileUndecidedLinger,omitempty"`
	ParameterCount           int               `json:"parameterCount,omitempty"`
	Parameters               []string          `json:"parameters,omitempty"`
	Compatible               string            `json:"compatible,omitempty"`
	Target                   string            `json:"target,omitempty"`
	Properties               map[string]string `json:"properties,omitempty"`
	RequirePriorIdleMs       int               `json:"requirePriorIdleMs"`
	HoldTriggerPositions     []int             `json:"holdTriggerPositions"`
	HoldTriggerOnRelease     bool              `json:"holdTriggerOnRelease"`
	ID                       string            `json:"id"`
	Name                     string            `json:"name"`
	Kind                     string            `json:"kind"` // behavior schema, with independent invocation parameters
	Bindings                 []string          `json:"bindings"`
	TappingTermMs            int               `json:"tappingTermMs"`
	QuickTapMs               int               `json:"quickTapMs"`
	Flavor                   string            `json:"flavor"`
}
type Position struct {
	ID          string  `json:"id"`
	KeymapIndex int     `json:"keymapIndex"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Rotation    float64 `json:"rotation"`
	Width       float64 `json:"width"`
	Height      float64 `json:"height"`
	SensorID    string  `json:"sensorId"`
}
type Target struct {
	Role     string `json:"role,omitempty"` // central, peripheral, or standalone
	ID       string `json:"id"`
	Name     string `json:"name"`
	Board    string `json:"board"`
	Shield   string `json:"shield"`
	Artifact string `json:"artifact"`
}
type Variant struct {
	Features         []string `json:"features,omitempty"`
	ZMKRevision      string   `json:"zmkRevision"`
	BuildImage       string   `json:"buildImage"`
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Targets          []Target `json:"targets"`
	BootloaderBoards []string `json:"bootloaderBoards"`
	UF2Family        uint32   `json:"uf2Family"`
	Instructions     string   `json:"instructions"`
}
type Module struct {
	Name     string `json:"name"`
	URL      string `json:"url"`
	Revision string `json:"revision"`
	Import   bool   `json:"import"`
}
type PluginAction struct {
	Name string `json:"name"`
	Code string `json:"code"`
}
type Plugin struct {
	Files          map[string]string `json:"files"`
	Modules        []Module          `json:"modules"`
	BindingArities map[string]int    `json:"bindingArities"`
	Actions        []PluginAction    `json:"actions"`

	ContractVersion int            `json:"contractVersion"`
	ID              string         `json:"id"`
	Version         string         `json:"version"`
	Name            string         `json:"name"`
	KeymapName      string         `json:"keymapName"`
	KeyCount        int            `json:"keyCount"`
	Width           float64        `json:"width"`
	Height          float64        `json:"height"`
	Positions       []Position     `json:"positions"`
	Sensors         []SensorAction `json:"sensors"`
	Variants        []Variant      `json:"variants"`
	ZMKRevision     string         `json:"zmkRevision"`
	BuildImage      string         `json:"buildImage"`
	Config          string         `json:"config"`
	Overlay         string         `json:"overlay"`
	Capabilities    []string       `json:"capabilities"`
}
type Session struct {
	Project  Project `json:"project"`
	Plugin   Plugin  `json:"plugin"`
	HasSaved bool    `json:"hasSaved"`
}
