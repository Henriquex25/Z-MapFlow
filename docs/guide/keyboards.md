# Supported keyboards

**Check this matrix before downloading or building.** It lists the profiles implemented in the source revision documented here. For a downloaded package, check the README at its release tag; an older release may not include a recently added profile.

## Keyboard and setup matrix

| Keyboard / setup | Half controllers | Dongle controller | Link between parts | Validation |
| --- | --- | --- | --- | --- |
| Sofle v2 — two halves | nice!nano v2 / compatible SuperMini | None | Bluetooth | Hardware tested on the author's SuperMini setup |
| Sofle v2 — nice!nano/SuperMini dongle | nice!nano v2 / compatible SuperMini | nice!nano v2 / compatible SuperMini | Bluetooth | Initial pairing and typing tested on the author's setup |
| Sofle v2 — XIAO dongle (experimental) | nice!nano v2 / compatible SuperMini | Seeed XIAO nRF52840 | Bluetooth | Build verified; physical testing pending |
| Lily58 | nice!nano v2 / compatible SuperMini | No included dongle profile | Bluetooth | Build verified; physical testing pending |
| Silakka54 Wireless — Lily58-compatible matrix | nice!nano v2 / compatible SuperMini | No included dongle profile | Bluetooth | Build verified; physical testing pending |
| Silakka54 Wired — experimental ZMK port | RP2040 Zero, original wiring | None | Full-duplex UART | Build verified; physical testing pending |

**Hardware tested** identifies the author's particular Linux/Sofle configuration. For the dongle, this includes initial reset/flashing, both halves connecting and typing; extended reconnection/sleep and the updated OLED appearance still need testing. It does not establish physical validation of every compatible clone.

**Build verified; physical testing pending** means the firmware has passed actual Docker compilation and UF2 validation, with hardware operation still awaiting a test on that combination. The XIAO profile and wired Silakka54 port are experimental.

Layout sizes: Sofle v2 has 58 switches plus two encoder buttons, Lily58 has 58 switches, and both Silakka54 profiles draw 54 switches.

Select the keyboard in the header and the exact hardware variant in **Settings**. Match the actual PCB, controller, bootloader and wiring. All included profiles build **ZMK** and flash through a mounted **UF2** bootloader volume.

## Controller boards and microcontrollers

| Controller board | Microcontroller | Included roles / keyboards |
| --- | --- | --- |
| nice!nano v2 | Nordic nRF52840 | Sofle v2, Lily58 and Lily58-compatible Silakka54 Wireless halves; Sofle central dongle |
| SuperMini compatible with the nice!nano v2 profile | Nordic nRF52840 | The same profiles, with a matching pinout and UF2 bootloader; the author's Sofle uses these controllers |
| Seeed Studio XIAO nRF52840, original model | Nordic nRF52840 | **Sofle central dongle only**, paired with nice!nano/SuperMini halves |
| RP2040 Zero | Raspberry Pi RP2040 | **Silakka54 Wired only**, using its documented full-duplex UART wiring |

A microcontroller family is not a controller-board profile. A generic “Pro Micro”, “nRF52840” or “RP2040” label does not establish compatibility. XIAO's dongle profile does not make it a supported replacement for the controllers in the keyboard halves. The current profiles do not cover XIAO RP2040/ESP32/Plus variants, AVR ATmega32U4 Pro Micro, Raspberry Pi Pico, other RP2040 boards or arbitrary nRF52840 controllers. A board needing another flashing protocol also requires support beyond the current UF2 flow.

Wireless setups support USB from their central to the computer while using Bluetooth between parts. A [Sofle USB dongle setup](./dongle) keeps both halves as peripherals; use the listed dongle profile and matching reset firmware. A stock TRRS-wired Sofle is outside the included profiles; see [USB and inter-half cables](#sofle-usb-and-inter-half-cables).

For an unlisted keyboard/controller combination, [request support](https://github.com/Henriquex25/Z-MapFlow/issues/new?template=keyboard.yml) or [contribute a plugin](../plugins). Importing a keymap uses the selected profile and does not add hardware compatibility.

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

## Sofle USB and inter-half cables

The supported wireless Sofle can use **USB from its central to the computer** while the halves communicate over Bluetooth. This also applies to a USB dongle. Choose USB output from the palette when needed.

A stock TRRS-wired Sofle is not an included Z-MapFlow profile. Many such builds use QMK/Vial. The pinned ZMK wired transport requires full-duplex UART and a compatible hardware definition; enabling a flag does not convert a stock Sofle TRRS link. No wired Sofle conversion is added here. See [ZMK split transports](https://zmk.dev/docs/features/split-keyboards).
