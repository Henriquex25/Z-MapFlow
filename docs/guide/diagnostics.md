# Firmware diagnostics and update advice

## Settings categories

**Settings** has three tabs: **Keyboard and firmware** for project/build options, **Application** for local interface preferences, and **Diagnostics** for firmware logging and serial capture. Changes to logging are project edits: save and rebuild before flashing. Switching tabs does not save, build or flash automatically.

## Capture USB logs

1. In **Settings → Diagnostics**, enable **USB logs** only for the device to investigate. This adds ZMK's <code>zmk-usb-logging</code> snippet to that build target, preserving other snippets/flags. Manually configured logging flags are detected: remove them under **Keyboard and firmware** before using the affected logging controls.
2. Save, build, then flash that device's normal firmware. Logging alone does not change topology or require a pairing reset. The bootloader volume itself is not a log source.
3. Connect it by USB, refresh the serial ports and choose its logging port (<code>/dev/ttyACM…</code> on Linux or <code>COM…</code> on Windows). If Studio is enabled, do not select its RPC port.
4. Choose **Start capture**, reproduce the connection issue, then **Stop capture** and **Export firmware logs**. Export saves a text snapshot to a location you choose; canceling the file dialog exports nothing.
5. Remove the logging snippet after diagnosis, rebuild and flash the normal firmware again. Logging increases power use and may affect timing; it is not intended to remain enabled permanently.

Capture is receive-only at 115200 baud, with DTR asserted for the USB console. It sends no serial commands or 1200-baud bootloader reset. Only ports currently enumerated by the OS may be opened. Logs stay in memory until exported; only the latest 256 KiB are retained. **Clear logs** empties the buffer. A new capture starts a new buffer.

Switching settings tabs keeps capture running. Flashing, app update, disconnection/read error or app shutdown stops it. Reconnection requires a new capture; the app does not silently switch ports. A permission error on Linux may require your account's serial-device permissions (commonly the <code>dialout</code> group), and another serial monitor can hold the port. No ports usually means that normal firmware lacks logging or the device is in bootloader mode. Errors remain visible and captured text can still be exported.

Firmware logs may contain device identifiers and key events. Review the exported text before attaching it to an issue. These are live firmware logs, separate from **View logs** in the build panel.

See [ZMK USB logging](https://zmk.dev/docs/development/usb-logging).

## Which devices should I update?

The flash device-selection step shows a recommendation for each destination device. Advice compares the immutable build inputs against transfers recorded locally for that keyboard/device; it never reads firmware from a UF2 volume and never blocks an otherwise valid destination.

- With no usable history or an older build lacking comparison data, update all destination devices.
- A topology migration still requires cleanup and firmware for all destination devices. The existing retired-device skip exception remains unchanged.
- Individual key-binding/label and layer-name edits can leave peripheral inputs unchanged: in that case only the central is recommended. Other changes (including macros/behaviors, sensors, hardware, power, shared flags, headers, snippets and ZMK dependencies) are compared conservatively.
- Per-target logging/flags affect that target's recommendation. Generated support-source changes also invalidate comparisons.
- Failed/interrupted writes and resets invalidate the selected device's earlier record. An uncertain final USB write is recorded only after acknowledgement.
- A successful host transfer is recorded as a transfer, not proof of physical keyboard operation.

You may update every device anyway, or close the guide after updating just the central when the recommendations allow it. No devices are hidden by advice. **How this advice works → Forget recorded transfers** clears comparisons. Use **I flashed outside the app or changed controllers** in the topology workflow after external work; the app cannot detect that work or distinguish two physical keyboards of the same plugin automatically. Project JSON exports do not include local transfer history.
