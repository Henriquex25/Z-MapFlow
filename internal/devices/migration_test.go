package devices_test

import (
	"testing"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/models"
)

type changedDescriptor struct {
	devices.KeyboardDevice
	plugin models.Plugin
}

func (d changedDescriptor) Descriptor() models.Plugin { return d.plugin }
func TestPairingMigrationRequiresAConsistentResetAndManagedRoles(t *testing.T) {
	for _, name := range []string{"missing reset", "wrong role flag", "wrong reset flag", "different reset board"} {
		t.Run(name, func(t *testing.T) {
			d := soflev2.NewDevice()
			p := d.Descriptor()
			v := &p.Variants[0]
			switch name {
			case "missing reset":
				v.Targets = v.Targets[:2]
			case "wrong role flag":
				v.Targets[0].Config["CONFIG_ZMK_SPLIT_ROLE_CENTRAL"] = "n"
			case "wrong reset flag":
				v.Targets[2].Config["CONFIG_ZMK_SETTINGS_RESET_ON_START"] = "n"
			case "different reset board":
				v.Targets[2].Board = "another_board"
			}
			if _, err := devices.NewRegistry(changedDescriptor{KeyboardDevice: d, plugin: p}); err == nil {
				t.Fatal("inconsistent pairing migration profile accepted")
			}
		})
	}
}
