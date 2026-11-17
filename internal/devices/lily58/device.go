package lily58

import (
	"fmt"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/profiles"
	"z-mapflow/internal/models"
)

type Device struct{}

func NewDevice() devices.KeyboardDevice { return &Device{} }
func (d *Device) GetIdentifier() string { return "lily58" }
func (d *Device) GetName() string       { return "Lily58" }

// Geometry and binding order follow ZMK's kata0510/lily58 physical layout and
// lily58/default_transform at profiles.ZMKRevision, including its two inner keys.
func (d *Device) Descriptor() models.Plugin {
	p := models.Plugin{ContractVersion: 1, ID: d.GetIdentifier(), Version: "1.0.0", Name: d.GetName(), KeymapName: "lily58", KeyCount: 58,
		Width: 16.5, Height: 5.8, ZMKRevision: profiles.ZMKRevision, BuildImage: profiles.BuildImage,
		Config:       "CONFIG_EC11=y\nCONFIG_EC11_TRIGGER_GLOBAL_THREAD=y\n",
		Capabilities: []string{"layers", "macros", "combos", "hold-tap", "tap-dance", "bluetooth", "display", "pointing", "encoders"},
		Variants:     []models.Variant{profiles.NiceNano("lily58", "lily58")},
		Sensors:      []models.SensorAction{{ID: "encoder_left", Label: "Left encoder (optional)", ClickKeymapIndex: -1, CodeCW: "&kp C_VOL_UP", CodeCCW: "&kp C_VOL_DN"}},
	}
	add := func(i int, x, y, w, h, rotation float64) {
		p.Positions = append(p.Positions, models.Position{ID: fmt.Sprintf("key-%d", i), KeymapIndex: i, X: x, Y: y, Width: w, Height: h, Rotation: rotation})
	}
	offsets := []float64{.5, .37, .12, 0, .12, .25}
	for row := 0; row < 4; row++ {
		for col := 0; col < 12; col++ {
			i := row*12 + col
			if row == 3 && col >= 6 {
				i += 2
			}
			x, y := float64(col), float64(row)+offsets[col%6]
			if col >= 6 {
				x = float64(col) + 4.5
				y = float64(row) + offsets[11-col]
			}
			add(i, x, y, 1, 1, 0)
		}
	}
	add(42, 6, 2.75, 1, 1, 0)
	add(43, 9.5, 2.75, 1, 1, 0)
	add(50, 2.5, 4.12, 1, 1, 0)
	add(51, 3.5, 4.15, 1, 1, 0)
	add(52, 4.5, 4.25, 1, 1, 0)
	add(53, 5.75, 4, 1, 1.5, 30)
	add(54, 9.75, 4, 1, 1.5, -30)
	add(55, 11, 4.25, 1, 1, 0)
	add(56, 12, 4.15, 1, 1, 0)
	add(57, 13, 4.15, 1, 1, 0)
	// Rotation has no assumed matrix click: a physical encoder push remains the
	// normal switch binding wherever the user's PCB actually wires it.
	p.Positions = append(p.Positions, models.Position{ID: "encoder-controls", KeymapIndex: -1, SensorID: "encoder_left", X: 7.2, Y: .9, Width: 1.9, Height: 1.5})
	return p
}
func (d *Device) GetDefaultLayout() models.KeyboardLayout {
	codes := []string{
		"ESC", "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N0", "MINUS",
		"TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "BSPC",
		"LCTRL", "A", "S", "D", "F", "G", "H", "J", "K", "L", "SEMI", "SQT",
		"LSHFT", "Z", "X", "C", "V", "B", "LBKT", "RBKT", "N", "M", "COMMA", "DOT", "FSLH", "RSHFT",
		"LGUI", "LALT", "SPACE", "RET", "SPACE", "RCTRL", "RALT", "RGUI",
	}
	keys := make([]models.KeyAction, len(codes))
	for i, code := range codes {
		keys[i] = models.KeyAction{KeymapIndex: i, Code: "&kp " + code}
	}
	return models.KeyboardLayout{Name: d.GetName(), Layers: []models.LayerData{{ID: "base", Name: "Base", Keys: keys, Sensors: d.Descriptor().Sensors}}, Macros: []models.Macro{}, Combos: []models.Combo{}, Behaviors: []models.Behavior{}}
}
