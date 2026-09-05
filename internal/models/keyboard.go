package models

type KeyAction struct {
	KeymapIndex int    `json:"keymapIndex"`
	Row         int    `json:"row"`
	Col         int    `json:"col"`
	Code        string `json:"code"`
	Label       string `json:"label"`
}

type SensorAction struct {
	ID               string `json:"id"`
	Label            string `json:"label"`
	CodeCW           string `json:"codeCW"`
	CodeCCW          string `json:"codeCCW"`
	CodeClick        string `json:"codeClick"`
	ClickKeymapIndex int    `json:"clickKeymapIndex"`
}

type LayerData struct {
	Name    string         `json:"name"`
	Keys    []KeyAction    `json:"keys"`
	Sensors []SensorAction `json:"sensors"`
}

type KeyboardLayout struct {
	Name   string      `json:"name"`
	Layers []LayerData `json:"layers"`
}
