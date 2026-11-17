# Sofle v2 with a USB dongle

The experimental **nice!nano v2 / SuperMini — USB dongle central** profile uses three compatible nRF52840 controllers. Your two Sofle halves keep their existing matrix and encoders; a third, bare controller becomes the USB receiver. This profile still needs physical validation. Successful compilation does not establish that your controller, bootloader or radio setup is compatible.

| Device | Role | Firmware |
| --- | --- | --- |
| USB dongle | Central: keymap, behaviors and USB output | `sofle-dongle.uf2` |
| Left half | Bluetooth peripheral | `sofle-dongle-left.uf2` |
| Right half | Bluetooth peripheral | `sofle-dongle-right.uf2` |
| All three, during migration only | Clear pairing and stored ZMK settings | `sofle-settings-reset.uf2` |

This is a ZMK BLE receiver. It does not add support for proprietary 2.4 GHz dongles. A compatible nice!nano v2/SuperMini bootloader and pinout are required; a generic “Pro Micro” label alone is insufficient. The receiver uses USB power and needs no switches, encoders, OLED or matrix wiring.

![The flash wizard offers USB dongle, left and right, with a separate pairing-reset mode](/images/z-mapflow-dongle-flash.png)

Example device selection in the actual app. No physical firmware transfer was performed for this image.

The standard ZMK firmware does not relay the central’s active-layer/host-output state to peripheral OLEDs. This profile disables those two widgets on the halves to avoid showing stale local state; local battery and peripheral-status widgets remain available. Central-state display synchronization would require additional firmware support.

## First setup

1. Export your project as a backup. In **Settings → Keyboard and firmware → Hardware variant**, choose the USB dongle profile. Your layers, bindings, macros, combos and behaviors stay in the project. The Studio USB preset moves to the new central if previously enabled. Target settings for devices absent from the selected profile are removed; other settings are retained.
2. Keep or disable **Display** according to the OLEDs on your halves. Display and automatic sleep controls apply to the halves; the receiver has no OLED/local encoder and stays awake. Bluetooth profiles reserve two additional connection/pairing slots for the peripherals.
3. Choose **Save and build**. The app produces the three device firmwares and one reset firmware. Roles and receiver-specific settings are managed by the profile; contradictory target flags are rejected before saving/building. The Studio USB preset applies to the dongle.
4. Open **Flash firmware → Reset pairing first**. For **each** of USB dongle, Left and Right: connect that device, double-press RESET, select its UF2 drive, review and send the reset firmware. Let it restart, then disconnect it or turn that half off. Reset clears Bluetooth bonds and stored ZMK settings, including Studio changes; it preserves the bootloader and the project saved in Z-MapFlow. A transfer/restart acknowledgement does not independently verify the erased settings.
5. Choose **Continue with keyboard firmware**. Put each device back in the bootloader and send its matching firmware: dongle, left, right. Keep the receiver connected to the computer by USB, power both halves, and test switches and encoder rotations/clicks on both sides. The app cannot identify a half from its UF2 volume: select the actual connected device.

The reset file is shared only because this profile uses the same controller/UF2 family on all three devices. Reset/firmware progress is tracked separately in the wizard. The app never sends a file without your explicit review and **Send firmware** action.

A controller can restart before the operating system confirms its last write. For reset firmware, the wizard lets you acknowledge a restart without claiming the keyboard works. Re-enter the bootloader and install keyboard firmware before testing keys. See [UF2 transfer warnings](./firmware#restart-and-final-write-warnings).

## Daily use and reverting

For ordinary keymap updates, choose **Keyboard firmware**, leaving pairing intact. Bindings, layers and most behaviors run on the central, so after initial setup you can usually flash only the receiver and close the wizard. Changes to peripheral hardware, power, encoders or firmware compatibility require updating the affected halves too. The app continues to build all declared targets.

The two peripheral halves cannot type directly into a computer without the dongle. To return to the usual setup, select the original nice!nano/SuperMini profile, clear pairing on the devices with the reset UF2, then flash the normal left/right firmware. The original profile remains the default; choosing the dongle is explicit. When Studio USB was enabled through the preset, switching back moves that preset to the left central again. Re-pair any host Bluetooth connection as needed.

## Technical references

The hardware files live in `internal/devices/soflev2/dongle/`. The receiver uses mock scanning and the exact Sofle transform/physical layout from the pinned ZMK revision, with two disabled local sensor placeholders preserving peripheral sensor indices. Each half enables only its own upstream encoder. Hardware roles, reset behavior and target-specific flags come from the plugin rather than keyboard-specific conditions in the editor/build core.

See the [official ZMK dongle guide](https://zmk.dev/docs/hardware-integration/dongle) and [split keyboard roles](https://zmk.dev/docs/features/split-keyboards). New keyboard/controller combinations need verified plugin profiles.
