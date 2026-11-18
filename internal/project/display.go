package project

import "z-mapflow/internal/models"

// StatusSyncDisplayConfig owns the display selection while the relay is enabled.
// Old imported projects can retain built-in screen flags in ExtraConfig. Keep
// those source settings intact, but never combine them with the relay screen.
func StatusSyncDisplayConfig(p models.Project) map[string]string {
	if !p.Options.PeripheralStatusSync {
		return nil
	}
	display := "n"
	if p.Options.Display {
		display = "y"
	}
	return map[string]string{
		"CONFIG_ZMK_DISPLAY":                               display,
		"CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN":        "n",
		"CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM":          display,
		"CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED":          display,
		"CONFIG_ZMK_WIDGET_LAYER_STATUS":                   "n",
		"CONFIG_ZMK_WIDGET_BATTERY_STATUS":                 "n",
		"CONFIG_ZMK_WIDGET_BATTERY_STATUS_SHOW_PERCENTAGE": "n",
		"CONFIG_ZMK_WIDGET_OUTPUT_STATUS":                  "n",
	}
}
