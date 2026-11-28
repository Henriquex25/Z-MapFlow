# ZMK configuration and languages

Settings are organized into **Keyboard and firmware**, **Application** and **Diagnostics** tabs. Application preferences are local; firmware options belong to the project. For USB logging and live serial capture, see [diagnostics](./diagnostics).

## Import a configuration

Select the correct keyboard/variant, then open its `.keymap`. The app also looks for the matching `.conf`, local `.h` headers and a nearby `build.yaml`. Geometry and physical binding order come from the selected plugin. Import does not modify your original repository.

Layers, macros, behaviors, combos and encoders are loaded. Omitted encoder rotations preserve inheritance. Import does not automatically add support for an unknown keyboard: see [keyboard plugins](../plugins).

Local `.dtsi` includes, conditionals and function-like defines in the keymap require prior expansion. Import is not a general-purpose preprocessor for every ZMK repository. Advanced properties and child nodes without dedicated controls are preserved and remain subject to compiler validation.

## Flags and transports

In **Settings**, configure available options and additional Kconfig flags such as `CONFIG_ZMK_STUDIO=y`. The Studio USB preset applies the required flags and snippet to the central target. Confirm controller compatibility.

Snippets and CMake arguments belong to individual build targets. USB typing and Studio’s USB transport are separate features; select the options supported by your revision and hardware. See the [official ZMK documentation](https://zmk.dev/docs) for their dependencies.

## Choose the keyboard language

Open the **Languages** tab in the action palette and use its **Keyboard language** selector. The selector is shown only on that tab. Choose **US / ANSI** or **Portuguese (Brazil) — ABNT2**, or a previously imported header. The same selection is available in **Settings → Operating system layout**.

For ABNT2, select Portuguese and the palette opens **Languages** with its included characters, such as `Ç`. Drag a character onto a key, or click it and then click its destination. You can search by character or alias. Existing assignments keep their codes when you choose another language.

### Add another language

1. Open **Languages → Find languages**. This opens the [ZMK Locale Generator headers](https://github.com/joelspadin/zmk-locale-generator/releases/latest) in your browser. Download the `.h` matching the keyboard layout configured on your computer.
2. Choose **Add language (.h)** in the palette and select that file. Keep any local header dependencies beside it when importing.
3. The app selects the imported header and shows its aliases. Drag them onto your keyboard. If a header explicitly annotates a character, the app can display that symbol; otherwise it shows the alias name.

The app retains the imported files and include statements in the project, keymap export and firmware build. **Settings → Headers and languages** lets you create or edit a header as an advanced option. Import refuses conflicting files with different contents.

Configure the same keyboard layout in your operating system. The app does not switch the OS layout: [ZMK sends key codes interpreted by the host](https://zmk.dev/blog/2024/01/05/zmk-tools#zmk-locale-generator).

**Interface language is separate:** English or Brazilian Portuguese under **Settings → Application** changes app controls only. It does not enable ABNT2, change your firmware or translate user-created layer/macro names.

## OLED orientation

For Sofle v2, open **Settings → System layout and features → OLED orientation** and enable **Rotate Right OLED 180°** to turn the right screen toward you. The left OLED can be rotated independently. Both options start disabled and are available on the current and ZMK 0.3 profiles, **with or without a USB central dongle**. Enable **OLED status display** to change orientation; disabling the display retains your choices.

Save, rebuild and flash the selected half. Changing orientation alone needs no pairing reset. The setting preserves the existing horizontal status layout, colors and font sizes; it does not add information to a screen that the selected profile does not normally provide. Only 0° and 180° are offered, not a portrait layout.

Orientation is stored per build target in the project and exported `build.yaml`, and survives switching between supported Sofle profiles. Changing the central/controller can still require the [separate pairing-reset workflow](./dongle); orientation alone does not change that topology.

## Bluetooth and power

In **Settings → Bluetooth and power**, **Sleep timeout (minutes)** sets the inactivity period before automatic sleep. For example, `15` means 15 minutes and `1.5` means 90 seconds. The existing supported range remains one second to 24 hours; fractions of a minute are accepted.

The backend validates the value and converts it to milliseconds for the saved project and ZMK's `CONFIG_ZMK_IDLE_SLEEP_TIMEOUT`. Opening an existing project or importing a `.conf` preserves its exact millisecond value, including a value that is not a whole number of minutes. Enable **Automatic sleep** to use this timeout.

## Edit combos, macros and behaviors

Combos, macros, behaviors and conditional-layer rules start collapsed. Their name and header actions remain available. Use the arrow to expand one resource; other cards keep their state. Opening and closing is animated, with reduced-motion preferences respected and the header kept in place. An invalid unfinished field keeps its card open until corrected, so collapsing cannot hide a save error.

For a combo, expand its card and select at least two trigger positions in the keyboard preview. Under **Combo action**, choose a **Behavior**, then its parameters:

- **Key press (&kp):** click the key slot and choose from the palette, or enter a supported shortcut under **Advanced parameter**.
- **Macros / Behaviors:** choose a macro or custom behavior created in the project. Its invocation parameters appear when required.
- **Enter bootloader (&bootloader):** no parameter is needed, so no key field appears.

The behavior selector includes search: click it and type a name, code or group, such as `bootloader` or `Macros`. Use the arrow keys and Enter, or click a result. Escape cancels the search; typing a query alone does not change the binding. Long lists render only their visible options. The optional **Advanced parameter** field accepts validated shortcuts such as `LC(A)`.

Actions that are unavailable for the keyboard, invalid or recursive are disabled. You can still drag an action from the palette or use advanced ZMK code. Macro steps expose the action dropdown and parameter slots through the pencil icon; behavior child actions use the same controls, following their parameter limits. Combo layer checkboxes restrict activation; no layers selected means all layers.

For a dongle's bootloader, see [the combo shortcut](./dongle#enter-the-dongle-bootloader-with-a-combo).

Key and listed-parameter fields now use slots backed by the lower palette, filtered to the selected argument. Only the action-type selector remains a dropdown; advanced text entry is optional. See [choosing actions and parameters](./getting-started#choosing-actions-and-parameters).
