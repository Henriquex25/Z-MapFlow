# Troubleshooting

## Installation stops after the package checks

If files show `OK` or `SUCESSO` and the next message mentions a missing `libwebkit2gtk-4.1.so.0`, the package verification passed and a required system dependency is missing. See [installation problems](./install#installation-problems) for the exact error and commands to install the runtime and retry.

## The app does not open

On Windows, use the x64 setup package, ensure Microsoft WebView2 is installed and close an existing instance before reinstalling. See [Windows installation](./install#windows-x64).

On Linux, check the architecture and GTK/WebKit libraries in the [installation guide](./install). Run the executable from a terminal to inspect the system error. Official Linux packages use WebKitGTK 4.1.

## Scrolling or animations feel slow on Linux

Running `./build/bin/z-mapflow` uses the normal desktop renderer. Rebuild after source changes; restarting an older binary does not load them. The app allows WebKit hardware acceleration when available and avoids re-rendering editors for unchanged build status.

If a graphics driver causes a blank window or rendering problems, close the app and try the software fallback from a terminal:

```sh
ZMAPFLOW_DISABLE_GPU=1 ./build/bin/z-mapflow
```

For an installed release, replace the path with its executable. The variable affects that launch only. Include the app version, Linux distribution, GPU/driver and whether the fallback changes the behavior in a bug report. Rendering speed still depends on the system’s WebKit and graphics stack.

## Docker is not available

Start Docker Desktop or the Docker service. Check `docker info` and `docker context show` in your terminal. The app needs access to the same context and socket. Do not run the entire app as root.

On Windows, Docker Desktop must be using Linux containers. Confirm the Docker server is using Linux containers:

```powershell
docker info --format '{{.OSType}}'
```

The output must be `linux`. If Docker was just installed, reopen Z-MapFlow so it receives the updated environment. The app also checks standard Docker Desktop executable locations when Start has an older PATH.

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

If a new release opens but behaves incorrectly, close the app and restore `z-mapflow.previous` in its installation directory, or reinstall an earlier release. On Windows, the backup is `z-mapflow.exe.previous`: close Z-MapFlow, keep a copy of the failing executable and copy the backup back to `z-mapflow.exe`, or rerun a known working official setup package. An update helper cannot replace the app until its previous process exits; if a native update error appears, inspect its message before retrying. Export your project before downgrading across data schema versions.

## Report a problem

Open an [issue](https://github.com/Henriquex25/Z-MapFlow/issues/new/choose) with the version shown in the header, OS, keyboard/variant, reproduction steps and relevant logs. Review configuration files before attaching them so you do not publish personal data. See [contributing](../community/contributing).

Some older Windows builds of Z-MapFlow restart the updated app with its window hidden. If the update completes but no window appears and opening the app again does nothing, end the Z-MapFlow process in Task Manager and reopen it normally. Its settings are preserved. The updater fix applies to updates initiated by a version containing the fix, because the helper is copied from the running app.
