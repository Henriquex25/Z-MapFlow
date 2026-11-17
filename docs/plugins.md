# Add support for another keyboard

Keyboard support is supplied by **plugins compiled into Z-MapFlow**. A plugin provides hardware metadata and a default layout; the shared core supplies the editor, persistence, validation, ZMK generation, builds and flashing. You do not need a separate React keyboard component.

A `.keymap` alone cannot describe every board’s geometry or wiring. If your keyboard is not listed, contribute a plugin through a pull request. Runtime loading of external plugin binaries and a plugin marketplace are not implemented.

## 1. Collect the hardware information

Start with a working ZMK configuration for the exact keyboard revision and controller. Record:

- The matrix transform’s binding order and total position count, including encoder click positions.
- Physical key coordinates, sizes, rotations and overall drawing bounds.
- Encoder order, rotation actions and click indices, if present.
- Board/shield names for each firmware target, plus which target is central, peripheral or standalone.
- The pinned ZMK revision, compatible build image and external west modules.
- Bootloader identifiers, UF2 family and instructions for entering bootloader mode.

Do not infer these details from the keyboard’s commercial name. Two revisions or controllers may require different variants. Use upstream ZMK hardware definitions and a configuration verified on the actual keyboard as references.

## 2. Create the device package

Create `internal/devices/<keyboard>/device.go`. Implement `devices.KeyboardDevice`:

```go
type KeyboardDevice interface {
    GetIdentifier() string
    GetName() string
    GetDefaultLayout() models.KeyboardLayout
    Descriptor() models.Plugin
}
```

Use a stable lowercase identifier such as `my_keyboard_v1`. Follow the included [Sofle implementation](https://github.com/Henriquex25/Z-MapFlow/blob/main/internal/devices/soflev2/device.go). Keep helper code inside your device package, rather than adding keyboard-specific branches to shared generation or React components.

A package starts with this shape:

```go
package mykeyboard

import "z-mapflow/internal/models"

type Device struct{}

func NewDevice() *Device { return &Device{} }
func (*Device) GetIdentifier() string { return "my_keyboard_v1" }
func (*Device) GetName() string { return "My Keyboard v1" }

// Implement Descriptor() and GetDefaultLayout() using your verified hardware data.
// The declarations below are the required signatures, not ready-to-build hardware.
// func (*Device) Descriptor() models.Plugin { ... }
// func (*Device) GetDefaultLayout() models.KeyboardLayout { ... }
```

## 3. Define geometry and binding order

`Descriptor()` returns `models.Plugin`, with `ContractVersion: 1`, identity/version, keymap filename prefix, dimensions and all positions.

Each `models.Position` has a stable physical `ID`, a real `KeymapIndex`, `X`, `Y`, `Width`, `Height`, `Rotation` and an optional `SensorID`. `Hidden: true` retains an unpopulated matrix slot in projects and generated bindings without drawing a nonexistent switch (see Silakka54 Wireless). Dimensions use key units and rotation uses degrees.

For example, if the matrix transform defines two consecutive positions:

```go
Positions: []models.Position{
    {ID: "key_0", KeymapIndex: 0, X: 0, Y: 0, Width: 1, Height: 1},
    {ID: "key_1", KeymapIndex: 1, X: 1, Y: 0, Width: 1, Height: 1},
},
```

This is an illustration of geometry only; replace it with the complete mapping for your device. Set `KeyCount` to the matrix transform position count and declare exactly one position per index. Array order and screen coordinates do not replace `KeymapIndex`. The generator sorts bindings by that real index.

A rotation-only encoder may add a position with `KeymapIndex: -1` and `SensorID`, plus a sensor with `ClickKeymapIndex: -1` and empty `CodeClick`. This supplementary control does not increase `KeyCount` and is omitted from physical-position pickers. Never invent a click index: matrix-wired encoder buttons remain ordinary keys. The Lily58 plugin demonstrates this case.

Set `DisableSleep: true` when the controller does not implement deep sleep. New projects then default to sleep disabled, Settings hides that control, validation rejects enabling it and generation omits its unsupported timeout. Existing plugins retain their previous defaults.

IDs must remain stable across cosmetic layout changes. Changing binding order reinterprets existing projects and requires an explicit migration or incompatible plugin version.

## 4. Provide a valid default layout

`GetDefaultLayout()` returns a `models.KeyboardLayout` with at least one layer. Give each layer a stable ID and one `models.KeyAction` for every physical index:

```go
Layers: []models.LayerData{{
    ID: "base", Name: "Base",
    Keys: []models.KeyAction{
        {KeymapIndex: 0, Code: "&kp A", Label: "A"},
        {KeymapIndex: 1, Code: "&kp B", Label: "B"},
    },
    Sensors: []models.SensorAction{},
}},
```

The two-key example must be expanded to match the real descriptor. Initialize empty resource collections where appropriate. Use valid ZMK bindings, and ensure each encoder click matches the associated physical key.

Layer references inside projects use stable IDs, for example `&lt @{navigation} SPACE`. The generator resolves them to numeric ZMK indices. Do not hardcode layer indices into editor logic.

## 5. Declare controllers, build targets and flashing

Add `models.Variant` entries for supported controller/firmware combinations. Each variant identifies its `Targets`, bootloader board identifiers, UF2 family and user instructions.

Each `models.Target` specifies its stable `ID`, display `Name`, `Board`, `Shield`, artifact filename and optional `Role` (`central`, `peripheral` or `standalone`). For a split keyboard, describe both firmware targets; do not assume the left half is always central.

Use English for built-in plugin labels and instructions. Unknown contributed labels fall back to their source text; common labels can use the shared translation catalog. User-created layer/macro names are preserved.

Pin a compatible `ZMKRevision` and `BuildImage` at plugin or variant level. Optional `Features` declare revision-dependent support, such as `layer-locking`; the core does not infer features from a commit SHA. `Target.Role` lets the Studio USB preset find the central target without guessing from its name.

`BootloaderBoards` values are matched against `INFO_UF2.TXT`. They identify compatible controllers, not automatically which physical half is connected. The user selects the connected half before flashing.

**Current transport:** UF2 copied to a mounted bootloader volume. Hardware requiring another flashing protocol needs a shared transport implementation in the core, with an explicit plugin declaration and tests. Do not claim that unsupported transports already work.

## 6. Supply hardware files, modules and extra actions

| Descriptor field | Purpose |
| --- | --- |
| `Config`, `Overlay` | Device-specific Kconfig and Devicetree additions. |
| `Files` | Additional text files relative to the ZMK config directory, including `boards/shields/...`. Use `/` separators and stay inside the config tree. |
| `Modules` | Pinned west dependencies with unique name, HTTPS URL, revision and optional manifest import. |
| `BindingArities` | Plugin-specific behavior labels with parameter counts from 0 to 2; do not redefine built-ins. |
| `Actions` | Extra named actions offered in the palette. |
| `Capabilities` | Supported editor features: `layers`, `macros`, `combos`, `hold-tap`, `tap-dance`, `encoders`, `bluetooth`, `display`, `pointing`. |

Never overwrite generated `west.yml`, `.keymap`, `.conf` or reserved header files. Consult the validation in [`internal/devices/device.go`](https://github.com/Henriquex25/Z-MapFlow/blob/main/internal/devices/device.go) and the models in [`internal/models/keyboard.go`](https://github.com/Henriquex25/Z-MapFlow/blob/main/internal/models/keyboard.go).

Project-specific snippets/CMake arguments live in `Project.BuildTargets` by target ID, while board/shield names and artifact identity belong to the plugin. User language headers live in `Project.Headers`; they must not replace plugin files.

## 7. Register the plugin

Import the new package in `app.go`, then add its device to the existing composition:

```go
a.registry, err = devices.NewRegistry(
    soflev2.NewDevice(),
    mykeyboard.NewDevice(),
)
```

Use the actual package name and preserve existing plugins. Registry validation rejects incompatible contracts, duplicate IDs, missing positions, invalid indices and unsafe files. The frontend reads the descriptor through Wails and automatically builds the keyboard selector and layout.

## 8. Test the shared workflow

Add focused tests for your descriptor and default project, then exercise generation through the same registry/service used by other keyboards. The [independent keyboard integration test](https://github.com/Henriquex25/Z-MapFlow/blob/main/internal/firmware/plugin_test.go) demonstrates this, including additional files and a west module.

Test at least:

- Complete/unique geometry, physical indices and default bindings.
- Generated keymap order, filenames and target metadata.
- Encoder rotations/click consistency and inheritance where relevant.
- Hardware files, pinned modules and custom binding arities.
- Project save/load and keymap export/import where supported.

Run the repository’s [development checks](./community/development). If you change exported Go models/API methods, regenerate Wails bindings. Do not create a second frontend geometry definition.

For firmware compatibility, build **every declared target** using the actual board/shield/revision. Then test bootloader discovery and flashing on the physical keyboard. Automated copy tests use temporary simulated volumes. Clearly distinguish schema validation, successful compilation, transfer and confirmed hardware behavior.

## 9. Open a pull request

Include the keyboard/controller revision, public ZMK/hardware references, supported features, pinned dependencies and validation results. Add an image of the layout and note which targets you physically tested. Explain any limitation rather than enabling unsupported capabilities.

Read [contributing](./community/contributing). If the hardware configuration is not known yet, start with the **keyboard support issue** form so the community can help collect the information.

## Compatibility and advanced behaviors

The plugin contract is version 1 and persisted projects use schema 2. Projects record plugin identity/version. Do not silently reinterpret saved indices or field meanings; add a migration when necessary.

Macros and custom behaviors use `zm_` IDs; `zm_sensor_` is reserved for generated sensor behaviors. Hold-taps forward one argument to each zero/one-parameter child. Macros can have up to two parameters. Unsupported or invalid references and cycles are rejected; compiler validation still determines which hardware/module features exist in the selected revision.

Encoder order is hardware metadata. Layers may omit rotation overrides and inherit from lower layers. Clicks remain independent physical bindings, and hardware `TriggersPerRotation` must agree across layers.

## Dongles and managed target settings

A variant may declare a receiver central, multiple peripheral targets and an optional shared reset target. `Target.Kind` is empty/`keyboard`, `dongle` or `settings-reset`; `Target.Role` still describes the transport role. The generic flash wizard lists operational devices and offers the reset artifact in a separate mode, tracking reset/firmware progress independently. Share a reset artifact only when all devices use that variant’s controller/UF2 family.

`Target.Config` is a map of required `CONFIG_` names to Kconfig values. Generation adds those flags to local build commands and exported `build.yaml`, deduplicating identical user arguments and rejecting contradictory target values. Settings displays managed values read-only; keep user-adjustable options out of this map. Bluetooth generation reserves connection/pairing slots for the declared peripherals in addition to the selected host profiles.

`Variant.Files` supplies safe configuration-relative files for that variant, merged over `Plugin.Files`. Generated filenames and out-of-tree paths are rejected. `Variant.Overlay` is optional: nil inherits the plugin overlay; a non-nil empty string removes it. This lets a dongle retain transform/sensor indices without enabling local GPIO encoders. Neither extension changes existing project schema or historical variant IDs. See the [Sofle dongle guide](./guide/dongle) and `internal/firmware/dongle_test.go` for a working example.

## Optional peripheral status synchronization

A verified variant can declare `peripheral-status-sync` in `Features` and include the common module from `internal/zmkmodules/statussync.Files()`. `Options.peripheralStatusSync` is optional/default false and requires that feature; unsupported variants reject it. Changing profiles clears it when unsupported. The generator owns `CONFIG_ZMAPFLOW_STATUS_SYNC` and selects a custom receiver screen only with synchronization and Display enabled; a screenless central must disable `CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM` in its managed flags. Keep synchronization off by default and preserve existing keymap indices.

The embedded module uses public APIs of the pinned ZMK revision, 20-byte versioned snapshots, encrypted writes on existing split links and initial/reconnection refresh. It is not an additional west dependency. Exported sources include its Zephyr module metadata and C files. Other boards/Zephyr/LVGL versions need their own compile and hardware verification. The stock widgets are not made to read fake local layer/output state. See [dongle synchronization](./guide/dongle#optional-layer-and-connection-synchronization).

## Required topology migration workflow

Opt a compatible variant into `pairing-migration` and include a `settings-reset` target. Give each physical device a stable target ID and accurate central/peripheral role; manage role Kconfig values in `Target.Config` so raw target flags cannot contradict the recorded topology. Sofle's current/legacy normal profiles and dongle profile implement this contract. Keep ordinary firmware targets separate from reset artifacts; a normal two-half profile may build three artifacts while exposing only two devices for final firmware.

The generic flash service compares operational target IDs, roles and kinds rather than saved-project variants or toolchain board aliases. Initial installed-role knowledge comes from an explicit user declaration; later attempted/completed transfers and native receipts are local workflow state. Required cleanup uses the union of old, partially migrated and destination devices. Retired receivers are reset-only and disappear from final-firmware selection. A shared reset is permitted only for matching UF2 controller families; different families need a verified dedicated implementation.

The backend persists the write intent before USB I/O and unlocks final firmware only after each actual reset copy and explicit restart acknowledgement. Copy errors/pending writes cannot produce acknowledgements; final sync uncertainty requires user acknowledgement. State survives reopening and compatible rebuilds, while stale firmware progress is discarded. Imports/build history cannot change physical-state records. See `internal/flash/topology_test.go` and the [migration guide](./guide/dongle#required-migration-steps-and-resuming). The app cannot identify left/right from a volume or observe external flashes, so device selection and external-change reporting remain explicit.
