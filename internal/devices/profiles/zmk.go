// Package profiles contains controller/build profiles shared by keyboard plugins.
package profiles

import "z-mapflow/internal/models"

const ZMKRevision = "4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85"
const BuildImage = "zmkfirmware/zmk-build-arm:4.1"

func NiceNano(shield, artifact string) models.Variant {
	return models.Variant{ID: "nice_nano_v2", Name: "nice!nano v2 / compatible SuperMini", ZMKRevision: ZMKRevision, BuildImage: BuildImage,
		Features: []string{"layer-locking"}, UF2Family: 0xADA52840,
		BootloaderBoards: []string{"nRF52840", "Nice!Nano", "nice_nano"},
		Instructions:     "Connect one half by USB and press RESET twice quickly. Wait for the UF2 volume and select the connected half. SuperMini compatibility depends on the bootloader and wiring used in your build.",
		Targets: []models.Target{
			{ID: "left", Role: "central", Name: "Left", Board: "nice_nano@2.0.0//zmk", Shield: shield + "_left", Artifact: artifact + "-left.uf2"},
			{ID: "right", Role: "peripheral", Name: "Right", Board: "nice_nano@2.0.0//zmk", Shield: shield + "_right", Artifact: artifact + "-right.uf2"},
		},
	}
}
