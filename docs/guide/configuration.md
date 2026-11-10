# ZMK configuration and languages

## Import a configuration

Select the correct keyboard/variant, then open its `.keymap`. The app also looks for the matching `.conf`, local `.h` headers and a nearby `build.yaml`. Geometry and physical binding order come from the selected plugin. Import does not modify your original repository.

Layers, macros, behaviors, combos and encoders are loaded. Omitted encoder rotations preserve inheritance. Import does not automatically add support for an unknown keyboard: see [keyboard plugins](../plugins).

Local `.dtsi` includes, conditionals and function-like defines in the keymap require prior expansion. Import is not a general-purpose preprocessor for every ZMK repository. Advanced properties and child nodes without dedicated controls are preserved and remain subject to compiler validation.

## Flags and transports

In **Settings**, configure available options and additional Kconfig flags such as `CONFIG_ZMK_STUDIO=y`. The Studio USB preset applies the required flags and snippet to the central target. Confirm controller compatibility.

Snippets and CMake arguments belong to individual build targets. USB typing and Studio’s USB transport are separate features; select the options supported by your revision and hardware. See the [official ZMK documentation](https://zmk.dev/docs) for their dependencies.

## Keyboard language headers

Import or create a local header such as `keys_pt_abnt2.h` and use its corresponding include when needed. Defined aliases appear in the **Languages** palette and accompany the project, export and firmware build.

The operating system keyboard layout must match the codes the keyboard sends. Changing the palette’s system layout does not rewrite existing bindings.

**Interface language is separate:** English or Brazilian Portuguese under **Settings → Application** changes app controls only. It does not enable ABNT2, change your firmware or translate user-created layer/macro names.
