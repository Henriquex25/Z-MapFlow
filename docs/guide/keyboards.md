# Supported keyboards

Select the keyboard in the header, then its controller in **Settings**. Match the actual PCB, controller and wiring before building. A similar case or key count does not establish firmware compatibility.

| Keyboard | Controller and firmware | Physical switches | Build / flash |
| --- | --- | --- | --- |
| Sofle v2 | nice!nano v2 / compatible SuperMini, ZMK | 58 + 2 encoder buttons | Left and right nRF52840 UF2 |
| Lily58 | nice!nano v2 / compatible SuperMini, ZMK | 58 | Left and right nRF52840 UF2 |
| Silakka54 Wireless | nRF52840 with Lily58-compatible matrix, ZMK | 54 | Left and right nRF52840 UF2 |
| Silakka54 Wired (experimental) | Original RP2040 Zero wiring, ZMK port | 54 | Left and right RP2040 UF2 |

The new Lily58 and Silakka54 profiles require validation on the corresponding physical keyboards. Successful compilation verifies the firmware configuration, not the PCB wiring or key operation. Other controllers and revisions require their own verified profiles; AVR Pro Micro, RP2040 Lily58 conversions and arbitrary Silakka54 clones are not covered by these targets.

## Lily58

The drawing follows the [official ZMK Lily58 physical layout](https://github.com/zmkfirmware/zmk/blob/4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85/app/dts/layouts/kata0510/lily58.dtsi), including the two inner keys and rotated 1.5u thumb keys. Binding indices follow the [upstream shield's matrix transform](https://github.com/zmkfirmware/zmk/blob/4dd95d7840eb3d5a3f59bb29fbf1ab054715ef85/app/boards/shields/lily58/lily58.dtsi).

The optional left encoder uses the upstream Pro Micro pin 21/20 definition. Its rotation controls appear separately; they do not assume a particular switch for the encoder button. If your encoder has a push button wired into the matrix, assign its action to that physical key. Normal 58-binding `.keymap` files with or without `sensor-bindings` are accepted. Rotation controls have no effect if no encoder is installed.

The shield supports an optional 128×32 SSD1306 OLED at I²C address `0x3c`. Disable **Display** in Settings if yours has no screen. Other displays need a compatible hardware definition.

## Silakka54 Wireless

This profile covers nRF52840/SuperMini builds using the Lily58-compatible wiring documented in [ickc/Silakka54-ZMK](https://github.com/ickc/Silakka54-ZMK) and [vandermey/silakka54-zmk-config](https://github.com/vandermey/silakka54-zmk-config). It uses the upstream `lily58_left` and `lily58_right` shields.

These configurations retain **58 binding slots for 54 physical switches**. Slots `42`, `43`, `53` and `54` have no switch: the editor hides them, defaults them to `&none`, and preserves their indices and imported bindings. Export remains `lily58.keymap` / `lily58.conf`, matching that shield. Do not delete those slots from a native keymap or shift the following bindings.

No encoder is declared. The optional OLED follows the Lily58 shield specification; disable Display when no matching screen is installed. The physical drawing uses the original Silakka54 column stagger and angled thumbs. Confirm your wireless derivative has this shape and matrix.

Trailing Studio layers with `status = "reserved"` or `"disabled"` are preserved as native code. Interleaved reservations are rejected to avoid shifting layer IDs. External `.dtsi` includes must be incorporated into the keymap before import.

## Silakka54 Wired: experimental ZMK port

The original [Silakka54](https://github.com/Squalius-cephalus/silakka54) ships with QMK/VIAL. Z-MapFlow provides an independent **ZMK** port for its documented hardware:

- Two RP2040 Zero controllers, COL2ROW matrix, rows GP2–GP6 and columns GP7–GP12.
- Full-duplex UART between the halves: GP0 TX / GP1 RX, following the [original configuration](https://github.com/Squalius-cephalus/silakka54/blob/main/firmware/config.h).
- USB connected to the **left** half, with the right half as the peripheral.

[ZMK's wired split transport](https://zmk.dev/docs/features/split-keyboards) is intended for early adopters. This port is experimental until tested on hardware. It replaces QMK/VIAL: **flash both halves** with their corresponding ZMK files. QMK/VIAL JSON, source and prebuilt firmware are not imported as ZMK keymaps. Keep your original firmware if you want to restore it later.

Disconnect power from **both** halves before connecting or disconnecting the split cable. Hold **BOOT** while connecting a half by USB, wait for **RPI-RP2**, and select that half in the flash wizard. Reconnect the halves with power off, then connect USB to the left half.

There is no Bluetooth, OLED or encoder in this profile. RP2040 deep sleep is unavailable in the pinned Zephyr configuration, so sleep settings are disabled. The geometry follows switch centres and thumb angles in the original KiCad PCB; all 54 bindings correspond to its matrix.

## Contribute another revision

The app ships plugins rather than guessing hardware from an imported `.keymap`. See [Create keyboard plugins](../plugins) for geometry, transforms, controller variants, Docker builds and physical validation requirements.
