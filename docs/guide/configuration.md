# ZMK configuration and languages

## Import a configuration

Select the correct keyboard/variant, then open its `.keymap`. The app also looks for the matching `.conf`, local `.h` headers and a nearby `build.yaml`. Geometry and physical binding order come from the selected plugin. Import does not modify your original repository.

Layers, macros, behaviors, combos and encoders are loaded. Omitted encoder rotations preserve inheritance. Import does not automatically add support for an unknown keyboard: see [keyboard plugins](../plugins).

Local `.dtsi` includes, conditionals and function-like defines in the keymap require prior expansion. Import is not a general-purpose preprocessor for every ZMK repository. Advanced properties and child nodes without dedicated controls are preserved and remain subject to compiler validation.

## Flags and transports

In **Settings**, configure available options and additional Kconfig flags such as `CONFIG_ZMK_STUDIO=y`. The Studio USB preset applies the required flags and snippet to the central target. Confirm controller compatibility.

Snippets and CMake arguments belong to individual build targets. USB typing and Studio’s USB transport are separate features; select the options supported by your revision and hardware. See the [official ZMK documentation](https://zmk.dev/docs) for their dependencies.

## Choose the keyboard language

Use the **Keyboard language** selector in the action palette. Choose **US / ANSI** or **Portuguese (Brazil) — ABNT2**, or a previously imported header. The same selection is available in **Settings → Operating system layout**.

For ABNT2, select Portuguese and the palette opens **Languages** with its included characters, such as `Ç`. Drag a character onto a key, or click it and then click its destination. You can search by character or alias. Existing assignments keep their codes when you choose another language.

### Add another language

1. Open **Languages → Find languages**. This opens the [ZMK Locale Generator headers](https://github.com/joelspadin/zmk-locale-generator/releases/latest) in your browser. Download the `.h` matching the keyboard layout configured on your computer.
2. Choose **Add language (.h)** in the palette and select that file. Keep any local header dependencies beside it when importing.
3. The app selects the imported header and shows its aliases. Drag them onto your keyboard. If a header explicitly annotates a character, the app can display that symbol; otherwise it shows the alias name.

The app retains the imported files and include statements in the project, keymap export and firmware build. **Settings → Headers and languages** lets you create or edit a header as an advanced option. Import refuses conflicting files with different contents.

Configure the same keyboard layout in your operating system. The app does not switch the OS layout: [ZMK sends key codes interpreted by the host](https://zmk.dev/blog/2024/01/05/zmk-tools#zmk-locale-generator).

**Interface language is separate:** English or Brazilian Portuguese under **Settings → Application** changes app controls only. It does not enable ABNT2, change your firmware or translate user-created layer/macro names.

## Bluetooth and power

In **Settings → Bluetooth and power**, **Sleep timeout (minutes)** sets the inactivity period before automatic sleep. For example, `15` means 15 minutes and `1.5` means 90 seconds. The existing supported range remains one second to 24 hours; fractions of a minute are accepted.

The backend validates the value and converts it to milliseconds for the saved project and ZMK's `CONFIG_ZMK_IDLE_SLEEP_TIMEOUT`. Opening an existing project or importing a `.conf` preserves its exact millisecond value, including a value that is not a whole number of minutes. Enable **Automatic sleep** to use this timeout.
