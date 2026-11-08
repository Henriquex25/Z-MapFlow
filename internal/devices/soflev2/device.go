package soflev2

import (
	"fmt"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
)

type Device struct{}

func NewDevice() devices.KeyboardDevice { return &Device{} }
func (d *Device) GetIdentifier() string { return "sofle_v2" }
func (d *Device) GetName() string       { return "Sofle v2" }

// Binding order follows ZMK v0.3 app/boards/shields/sofle/sofle.dtsi.
// 58 switches + 2 encoder push buttons = 60 positions.
func (d *Device) Descriptor() models.Plugin {
	p := models.Plugin{
		ContractVersion: 1, ID: d.GetIdentifier(), Version: "1.0.0", Name: d.GetName(), KeymapName: "sofle", KeyCount: 60,
		Width: 16, Height: 5.9, ZMKRevision: "v0.3.0", BuildImage: "zmkfirmware/zmk-build-arm:3.5",
		Config:       "CONFIG_EC11=y\nCONFIG_EC11_TRIGGER_GLOBAL_THREAD=y\n",
		Overlay:      "&left_encoder { status = \"okay\"; };\n&right_encoder { status = \"okay\"; };\n",
		Capabilities: []string{"layers", "macros", "combos", "hold-tap", "tap-dance", "encoders", "bluetooth", "display", "pointing"},
		Sensors: []models.SensorAction{
			{ID: "encoder_left", Label: "Encoder esquerdo", CodeCW: "&kp C_VOL_UP", CodeCCW: "&kp C_VOL_DN", CodeClick: "&kp C_MUTE", ClickKeymapIndex: 42},
			{ID: "encoder_right", Label: "Encoder direito", CodeCW: "&kp PG_UP", CodeCCW: "&kp PG_DN", CodeClick: "&kp C_PP", ClickKeymapIndex: 43},
		},
		Variants: []models.Variant{{ID: "nice_nano_v2", Name: "nice!nano v2 / SuperMini compatível", UF2Family: 0xADA52840,
			BootloaderBoards: []string{"nRF52840", "nrf52840", "Nice!Nano", "nice_nano"},
			Instructions:     "Conecte uma metade por USB e pressione RESET duas vezes rapidamente. Aguarde aparecer o volume UF2 e informe qual metade foi conectada. A compatibilidade da SuperMini depende do bootloader e da pinagem usados na montagem.",
			Targets:          []models.Target{{ID: "left", Name: "Esquerda", Board: "nice_nano_v2", Shield: "sofle_left", Artifact: "sofle-left.uf2"}, {ID: "right", Name: "Direita", Board: "nice_nano_v2", Shield: "sofle_right", Artifact: "sofle-right.uf2"}},
		}},
	}
	offsets := []float64{0.5, 0.5, 0.25, 0, 0.25, 0.5}
	add := func(index int, x, y float64, sensor string) {
		p.Positions = append(p.Positions, models.Position{ID: fmt.Sprintf("key-%d", index), KeymapIndex: index, X: x, Y: y, Width: 1, Height: 1, SensorID: sensor})
	}
	for row := 0; row < 3; row++ {
		for col := 0; col < 12; col++ {
			if col < 6 {
				add(row*12+col, float64(col), float64(row)+offsets[col], "")
			} else {
				add(row*12+col, float64(col+4), float64(row)+offsets[11-col], "")
			}
		}
	}
	for col := 0; col < 6; col++ {
		add(36+col, float64(col), 3+offsets[col], "")
	}
	add(42, 6.25, 2.9, "encoder_left")
	add(43, 8.2, 2.9, "encoder_right")
	for col := 0; col < 6; col++ {
		add(44+col, float64(col+10), 3+offsets[5-col], "")
	}
	for col := 0; col < 5; col++ {
		add(50+col, float64(col+1)+0.2, 4.7, "")
		add(55+col, float64(col+10)-0.2, 4.7, "")
	}
	legacy := p.Variants[0]
	legacy.ID = "nice_nano_v2_legacy"
	legacy.Name = "nice!nano v2 / SuperMini — ZMK 0.3"
	legacy.ZMKRevision = p.ZMKRevision
	legacy.BuildImage = p.BuildImage
	modern := p.Variants[0]
	modern.Name = "nice!nano v2 / SuperMini — ZMK atual"
	modern.ZMKRevision = "4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85"
	modern.BuildImage = "zmkfirmware/zmk-build-arm:4.1"
	modern.Targets = append([]models.Target(nil), modern.Targets...)
	for i := range modern.Targets {
		modern.Targets[i].Board = "nice_nano@2.0.0//zmk"
	}
	p.Variants = []models.Variant{modern, legacy}
	for i := range p.Positions {
		if p.Positions[i].SensorID != "" {
			p.Positions[i].Width = 1.6
			p.Positions[i].Height = 1.8
		}
	}
	return p
}
func (d *Device) GetDefaultLayout() models.KeyboardLayout {
	codes := []string{
		"ESC", "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N0", "MINUS",
		"TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "BSPC",
		"LCTRL", "A", "S", "D", "F", "G", "H", "J", "K", "L", "SEMI", "SQT",
		"LSHFT", "Z", "X", "C", "V", "B", "C_MUTE", "C_PP", "N", "M", "COMMA", "DOT", "FSLH", "RSHFT",
		"LGUI", "LALT", "LCTRL", "SPACE", "RET", "SPACE", "RCTRL", "RALT", "RGUI", "DEL",
	}
	keys := make([]models.KeyAction, len(codes))
	for i, c := range codes {
		keys[i] = models.KeyAction{KeymapIndex: i, Code: "&kp " + c, Label: c}
	}
	return models.KeyboardLayout{Name: d.GetName(), Layers: []models.LayerData{{ID: "base", Name: "Base", Keys: keys, Sensors: d.Descriptor().Sensors}}, Macros: []models.Macro{}, Combos: []models.Combo{}, Behaviors: []models.Behavior{}}
}
