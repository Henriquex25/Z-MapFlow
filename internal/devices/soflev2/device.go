package soflev2

import (
	"fmt"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
)

type Device struct{}

func NewDevice() devices.KeyboardDevice {
	return &Device{}
}

func (d *Device) GetIdentifier() string {
	return "sofle_v2"
}

func (d *Device) GetName() string {
	return "Sofle V2"
}

func (d *Device) GetDefaultLayout() models.KeyboardLayout {
	var keys []models.KeyAction
	index := 0

	mockCodes := []string{
		"ESC", "N1", "N2", "N3", "N4", "N5",
		"TAB", "Q", "W", "E", "R", "T",
		"LCTRL", "A", "S", "D", "F", "G",
		"LSHFT", "Z", "X", "C", "V", "B",
		"C_MUTE", "LALT", "LGUI", "SPACE", "RET",
		"N6", "N7", "N8", "N9", "N0", "MINUS",
		"Y", "U", "I", "O", "P", "EQUAL",
		"H", "J", "K", "L", "SEMI", "SQT",
		"N", "M", "COMMA", "DOT", "FSLH", "RSHFT",
		"RGUI", "RALT", "BSPC", "DEL", "C_PP",
	}

	for row := 0; row < 5; row++ {
		for col := 0; col < 6; col++ {
			if row == 4 && col == 1 {
				continue
			}

			keys = append(keys, models.KeyAction{
				KeymapIndex: index,
				Row:         row,
				Col:         col,
				Code:        fmt.Sprintf("&kp %s", mockCodes[index]),
				Label:       mockCodes[index],
			})
			index++
		}
	}

	for r := 0; r < 5; r++ {
		for c := 0; c < 6; c++ {
			if r == 4 && c == 4 {
				continue
			}

			row := r + 5

			keys = append(keys, models.KeyAction{
				KeymapIndex: index,
				Row:         row,
				Col:         c,
				Code:        fmt.Sprintf("&kp %s", mockCodes[index]),
				Label:       mockCodes[index],
			})
			index++
		}
	}

	sensors := []models.SensorAction{
		{
			ID:               "encoder_left",
			Label:            "encoder_left",
			CodeCW:           "&inc_dec_kp C_VOL_UP",
			CodeCCW:          "&inc_dec_kp C_VOL_DN",
			CodeClick:        "&kp C_MUTE",
			ClickKeymapIndex: 24,
		},
		{
			ID:               "encoder_right",
			Label:            "encoder_right",
			CodeCW:           "&inc_dec_kp PG_UP",
			CodeCCW:          "&inc_dec_kp PG_DN",
			CodeClick:        "&kp C_PP",
			ClickKeymapIndex: 57,
		},
	}

	baseLayer := models.LayerData{
		Name:    "Base",
		Keys:    keys,
		Sensors: sensors,
	}

	return models.KeyboardLayout{
		Name:   d.GetName(),
		Layers: []models.LayerData{baseLayer},
	}
}
