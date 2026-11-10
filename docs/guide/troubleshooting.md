# Troubleshooting

## The app does not open

Check the architecture and GTK/WebKit libraries in the [installation guide](./install). Run the executable from a terminal to inspect the system error. Official Linux packages use WebKitGTK 4.1.

## Docker is not available

Start Docker Desktop or the Docker service. Check `docker info` and `docker context show` in your terminal. The app needs access to the same context and socket. Do not run the entire app as root.

## A binding is highlighted in red

Check its parameters and code. Each action accepts specific counts and types; a keycode field is not arbitrary text. Custom aliases must be declared in a project header or define. Correct or discard the draft.

## Import fails

Check the selected keyboard/variant and key count. Keep local headers beside your keymap. Unsupported local `.dtsi` includes, conditionals and function-like keymap defines require expansion first. A failed import preserves your existing editor state.

## My keyboard is not listed

ZMK firmware support alone does not provide the app with geometry, binding order or controller metadata. A Z-MapFlow plugin supplies that information. Read the [plugin guide](../plugins) or open a keyboard support issue with public hardware/ZMK references.

## A final write warning appears during flashing

See [restart and final write warnings](./firmware#restart-and-final-write-warnings) if flashing reports `sync …: input/output error` or **Transfer not confirmed**. A controller restart can produce this warning even when the new layout works, but a real I/O failure can look the same. Test the keyboard before confirming or retrying.

## Updates are unavailable or fail

Updates require public stable releases and internet access. Prereleases are ignored. API limits, a missing asset for your architecture or a non-writable installation may prevent an update. Retry from the header and use the official per-user installation.

If a new release opens but behaves incorrectly, close the app and restore `z-mapflow.previous` in its installation directory, or reinstall an earlier release. Export your project before downgrading across data schema versions.

## Report a problem

Open an [issue](https://github.com/Henriquex25/Z-MapFlow/issues/new/choose) with the version shown in the header, OS, keyboard/variant, reproduction steps and relevant logs. Review configuration files before attaching them so you do not publish personal data. See [contributing](../community/contributing).
