package soflev2

// The upstream Sofle SSD1306 overlay sets both scan-direction flags. Reversing
// both rotates the selected half 180 degrees without changing its status screen.
func oledRotationFiles() map[string]string {
	return map[string]string{
		"zephyr/module.yml":                            "name: zmapflow_sofle\nbuild:\n  settings:\n    board_root: .\n    snippet_root: .\n",
		"snippets/zmapflow-oled-flip-180/snippet.yml":  "name: zmapflow-oled-flip-180\nappend:\n  EXTRA_DTC_OVERLAY_FILE: flip.overlay\n",
		"snippets/zmapflow-oled-flip-180/flip.overlay": "/* SPDX-License-Identifier: MIT */\n&oled {\n    /delete-property/ segment-remap;\n    /delete-property/ com-invdir;\n};\n",
	}
}
