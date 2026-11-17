package silakka54

import (
	"embed"
	"fmt"
	"io/fs"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/profiles"
	"z-mapflow/internal/models"
)

//go:embed shield/*
var shieldFiles embed.FS

type Device struct{ wireless bool }

func NewWirelessDevice() devices.KeyboardDevice { return &Device{wireless: true} }
func NewWiredDevice() devices.KeyboardDevice    { return &Device{} }
func (d *Device) GetIdentifier() string {
	if d.wireless {
		return "silakka54_wireless"
	}
	return "silakka54_wired"
}
func (d *Device) GetName() string {
	if d.wireless {
		return "Silakka54 Wireless (nRF52840)"
	}
	return "Silakka54 Wired (RP2040 Zero, experimental)"
}
func (d *Device) Descriptor() models.Plugin {
	p := models.Plugin{ContractVersion: 1, ID: d.GetIdentifier(), Version: "1.0.0", Name: d.GetName(), KeymapName: "silakka54_wired", KeyCount: 54,
		Width: 16, Height: 5.85, ZMKRevision: profiles.ZMKRevision, BuildImage: profiles.BuildImage,
		Sensors: []models.SensorAction{}, Capabilities: []string{"layers", "macros", "combos", "hold-tap", "tap-dance", "pointing"},
	}
	if d.wireless {
		// Common wireless builds reuse the Lily58 matrix and its 58-slot keymap.
		// Keep missing switches 42/43/53/54 addressable in files, but don't draw them.
		p.KeymapName, p.KeyCount = "lily58", 58
		p.Variants = []models.Variant{profiles.NiceNano("lily58", "silakka54-wireless")}
		p.Capabilities = append(p.Capabilities, "bluetooth", "display")
		p.Overlay = "&left_encoder { status = \"disabled\"; };\n&sensors { status = \"disabled\"; };\n"
	} else {
		p.DisableSleep = true // RP2040 does not implement Zephyr poweroff.
		p.Config = "CONFIG_ZMK_SPLIT_WIRED_UART_MODE_INTERRUPT=y\n"
		p.Files = map[string]string{}
		entries, _ := fs.ReadDir(shieldFiles, "shield")
		for _, entry := range entries {
			data, _ := shieldFiles.ReadFile("shield/" + entry.Name())
			p.Files["boards/shields/silakka54_wired/"+entry.Name()] = string(data)
		}
		p.Variants = []models.Variant{{ID: "rp2040_zero", Name: "RP2040 Zero — wired ZMK port (experimental)", Features: []string{"layer-locking"}, ZMKRevision: profiles.ZMKRevision, BuildImage: profiles.BuildImage,
			UF2Family: 0xE48BFF56, BootloaderBoards: []string{"RPI-RP2", "RP2040", "Raspberry Pi RP2"},
			Instructions: "Experimental ZMK port for the original RP2040 Zero wiring: GP0 TX / GP1 RX, full-duplex UART. Flash both halves; this replaces QMK/VIAL. Disconnect power from both halves before connecting the split cable. Use the left half for USB. Hold BOOT while connecting USB to open RPI-RP2, then choose the connected half. Physical hardware validation is still required.",
			Targets: []models.Target{
				{ID: "left", Role: "central", Name: "Left", Board: "rp2040_zero/rp2040/zmk", Shield: "silakka54_wired_left", Artifact: "silakka54-wired-left.uf2"},
				{ID: "right", Role: "peripheral", Name: "Right", Board: "rp2040_zero/rp2040/zmk", Shield: "silakka54_wired_right", Artifact: "silakka54-wired-right.uf2"},
			},
		}}
	}
	// Switch centres/stagger/thumb angles from the original Silakka54 KiCad PCB.
	// Mirrored halves retain firmware binding order independently of geometry.
	offsets := []float64{.25, .25, .125, 0, .125, .25}
	add := func(i int, x, y, rotation float64) {
		p.Positions = append(p.Positions, models.Position{ID: fmt.Sprintf("key-%d", i), KeymapIndex: i, X: x, Y: y, Width: 1, Height: 1, Rotation: rotation})
	}
	for row := 0; row < 4; row++ {
		for col := 0; col < 12; col++ {
			i := row*12 + col
			if d.wireless && row == 3 && col >= 6 {
				i += 2
			}
			x, y := float64(col), float64(row)+offsets[col%6]
			if col >= 6 {
				x = float64(col) + 4
				y = float64(row) + offsets[11-col]
			}
			add(i, x, y, 0)
		}
	}
	thumbs := [][3]float64{{3.125, 4.125, 0}, {(121.09875 - 40.21875) / 19.05, (117.08125 - 35.71875) / 19.05, 15}, {(142.22875 - 40.21875) / 19.05, (123.31125 - 35.71875) / 19.05, 30}}
	for i, thumb := range thumbs {
		left, right := 48+i, 53-i
		if d.wireless {
			left, right = 50+i, 57-i
		}
		add(left, thumb[0], thumb[1], thumb[2])
		add(right, 15-thumb[0], thumb[1], -thumb[2])
	}
	if d.wireless {
		for _, i := range []int{42, 43, 53, 54} {
			p.Positions = append(p.Positions, models.Position{ID: fmt.Sprintf("unused-%d", i), KeymapIndex: i, Hidden: true, Width: 1, Height: 1})
		}
	}
	return p
}
func (d *Device) GetDefaultLayout() models.KeyboardLayout {
	codes := []string{
		"ESC", "N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N0", "MINUS",
		"TAB", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "BSPC",
		"LCTRL", "A", "S", "D", "F", "G", "H", "J", "K", "L", "SEMI", "SQT",
		"LSHFT", "Z", "X", "C", "V", "B", "N", "M", "COMMA", "DOT", "FSLH", "RSHFT",
		"LGUI", "SPACE", "RET", "SPACE", "RALT", "RGUI",
	}
	keys := []models.KeyAction{}
	n := 0
	count := d.Descriptor().KeyCount
	for i := 0; i < count; i++ {
		code := "&none"
		if !d.wireless || (i != 42 && i != 43 && i != 53 && i != 54) {
			code = "&kp " + codes[n]
			n++
		}
		keys = append(keys, models.KeyAction{KeymapIndex: i, Code: code})
	}
	return models.KeyboardLayout{Name: d.GetName(), Layers: []models.LayerData{{ID: "base", Name: "Base", Keys: keys, Sensors: []models.SensorAction{}}}, Macros: []models.Macro{}, Combos: []models.Combo{}, Behaviors: []models.Behavior{}}
}
