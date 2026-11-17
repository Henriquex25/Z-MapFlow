package soflev2

import (
	"embed"
	"io/fs"
	"z-mapflow/internal/models"
)

//go:embed dongle/*
var dongleFiles embed.FS

func dongleVariant(base models.Variant) models.Variant {
	v := base
	v.ID = "nice_nano_v2_dongle"
	v.Name = "nice!nano v2 / SuperMini — USB dongle central (experimental)"
	empty := ""
	v.Overlay = &empty // Upstream shields enable only each half's actual encoder.
	v.Files = map[string]string{}
	entries, _ := fs.ReadDir(dongleFiles, "dongle")
	for _, entry := range entries {
		data, _ := dongleFiles.ReadFile("dongle/" + entry.Name())
		v.Files["boards/shields/sofle_dongle/"+entry.Name()] = string(data)
	}
	v.Instructions = "USB dongle setup: use three nice!nano v2-compatible nRF52840 controllers. First reset pairing on all three devices, then flash the USB dongle and both halves. Keep the dongle connected by USB; both halves are Bluetooth peripherals. Press RESET twice quickly to enter the UF2 bootloader. Changing topology requires resetting pairing again. Hardware validation is pending."
	central := models.Target{ID: "dongle", Kind: "dongle", Role: "central", Name: "USB dongle", Board: base.Targets[0].Board, Shield: "sofle_dongle", Artifact: "sofle-dongle.uf2", Config: map[string]string{
		"CONFIG_ZMK_SPLIT": "y", "CONFIG_ZMK_SPLIT_ROLE_CENTRAL": "y", "CONFIG_ZMK_SPLIT_BLE_CENTRAL_PERIPHERALS": "2", "CONFIG_ZMK_USB": "y", "CONFIG_ZMK_DISPLAY": "n", "CONFIG_EC11": "n", "CONFIG_EC11_TRIGGER_GLOBAL_THREAD": "n",
		"CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN": "n", "CONFIG_ZMK_WIDGET_LAYER_STATUS": "n", "CONFIG_ZMK_WIDGET_BATTERY_STATUS": "n", "CONFIG_ZMK_WIDGET_BATTERY_STATUS_SHOW_PERCENTAGE": "n", "CONFIG_ZMK_WIDGET_OUTPUT_STATUS": "n", "CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED": "n",
	}}
	left, right := base.Targets[0], base.Targets[1]
	for _, target := range []*models.Target{&left, &right} {
		target.Role = "peripheral"
		target.Config = map[string]string{"CONFIG_ZMK_SPLIT": "y", "CONFIG_ZMK_SPLIT_ROLE_CENTRAL": "n", "CONFIG_ZMK_STUDIO": "n", "CONFIG_ZMK_WIDGET_LAYER_STATUS": "n", "CONFIG_ZMK_WIDGET_OUTPUT_STATUS": "n"}
		target.Artifact = "sofle-dongle-" + target.ID + ".uf2"
	}
	reset := models.Target{ID: "settings_reset", Kind: "settings-reset", Name: "Reset pairing", Board: central.Board, Shield: "settings_reset", Artifact: "sofle-settings-reset.uf2", Config: map[string]string{"CONFIG_ZMK_SETTINGS_RESET_ON_START": "y"}}
	v.Targets = []models.Target{central, left, right, reset}
	return v
}
