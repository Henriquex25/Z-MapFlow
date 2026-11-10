# Z-MapFlow

A desktop ZMK keymap editor inspired by VIAL. Configure your keyboard visually, save and build firmware locally, then flash the correct artifact to each controller.

**[Documentation](https://henriquex25.github.io/Z-MapFlow/)** · [Install](https://henriquex25.github.io/Z-MapFlow/guide/install) · [Create a keyboard plugin](https://henriquex25.github.io/Z-MapFlow/plugins) · [Releases](https://github.com/Henriquex25/Z-MapFlow/releases) · [Contribute](CONTRIBUTING.md) · [MIT license](LICENSE)

## Install and use

The initial distribution supports **Linux x86_64** with GTK 3 and WebKitGTK 4.1. Download the `.tar.gz` package from Releases, extract it, and run `./install.sh` from the extracted directory. The installer creates an application menu entry and installs into your user account. Go and Node are not required. See the [installation guide](https://henriquex25.github.io/Z-MapFlow/guide/install) for runtime dependencies.

The interface defaults to **English**. Choose **Settings → Application → Interface language → Português (Brasil)** to switch immediately. This preference is saved on your computer, separately from your project. It does not change the operating system keyboard layout, ZMK keycodes or firmware settings.

Docker is required to build firmware, but editing and saving work without it. At startup, the app checks public stable GitHub releases. You can defer an update or save your changes, download and verify the update, install it and restart. The previous executable is retained for recovery.

## Keyboard support and plugins

**Sofle v2** is the first included keyboard plugin. Keyboard support is extensible: a plugin describes geometry, ZMK binding order, encoders, controller variants, build targets and bootloader compatibility. The shared editor, project storage, firmware generation, Docker builds and UF2 flashing belong to the core.

A keyboard supported by ZMK still needs a Z-MapFlow plugin to describe its physical layout and build configuration. Importing a `.keymap` uses the selected plugin; it does not infer an unknown keyboard’s geometry or wiring.

The community can add other keyboards through pull requests:

1. Implement `devices.KeyboardDevice` under `internal/devices/<keyboard>/`.
2. Define the physical positions and their real `keymapIndex`, default bindings, controller variants, board/shield names and firmware targets.
3. Supply hardware files or pinned west modules when the keyboard needs them.
4. Register the plugin in `app.go`, test it through the shared core, and document build and hardware validation.

Read the **[step-by-step plugin guide](https://henriquex25.github.io/Z-MapFlow/plugins)**, or its [Markdown source](docs/plugins.md). The included [Sofle plugin](internal/devices/soflev2/device.go) and [independent keyboard integration test](internal/firmware/plugin_test.go) are working references. Plugins currently ship with the application; there is no runtime plugin installer or marketplace. Devices that require a flashing protocol other than mounted-volume UF2 also need a shared core transport implementation.

## Features

- Assign and swap keys and encoder actions using clicks or drag and drop.
- Create and reorder layers, macros, combos, hold-taps, tap-dances and other behaviors.
- Validate action names, parameter counts and types before assignments; invalid drafts preserve the last valid value.
- Import/export JSON projects and ZMK `.keymap` configurations, including supported `.conf`, local `.h` headers and `build.yaml` settings.
- Configure Kconfig flags, target snippets, CMake arguments, pointing features, lighting and Studio USB presets.
- Add language headers and use their aliases from the action palette.
- Build immutable saved revisions in Docker, inspect logs and recover artifacts from build history.
- Export firmware with a completion notification, then follow the UF2 flashing flow for each target.

**Save** persists the current project. **Build** compiles the last saved revision. **Save and build** saves and builds that exact revision. Editing during a build does not change its snapshot.

## Development

Use the Go version required by `go.mod`, Node 24, Wails v2 and the native Linux development libraries:

```sh
sudo apt install build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
npm ci --prefix frontend
python3 scripts/wails.py dev -tags webkit2_41
```

Build the desktop application:

```sh
python3 scripts/wails.py build -tags webkit2_41
```

The wrapper supplies native package metadata from the central version file. If your existing development environment uses WebKitGTK 4.0, omit `-tags webkit2_41` from Go/Wails commands. The official packages use 4.1.

```sh
npm run format:check --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
go test -race -tags webkit2_41 ./...
go vet -tags webkit2_41 ./...
python3 -m unittest discover -s scripts -p 'test_*.py' -v
```

The firmware integration test is opt-in and does not flash a keyboard:

```sh
ZMAPFLOW_DOCKER_TEST=1 go test ./internal/firmware -run '^TestDockerIntegration$' -v -timeout 45m
```

See the [development guide](https://henriquex25.github.io/Z-MapFlow/community/development) and `AGENT.md` for architecture and compatibility rules. Regenerate API bindings with `python3 scripts/wails.py generate module -tags webkit2_41` whenever Go models or exported Wails methods change.

## Documentation and contribution

The [GitHub Pages documentation](https://henriquex25.github.io/Z-MapFlow/) uses VitePress and Markdown. English is the default; Brazilian Portuguese is available through the language menu.

```sh
npm ci --prefix docs
npm run dev --prefix docs
npm run build --prefix docs
```

Use [issues](https://github.com/Henriquex25/Z-MapFlow/issues/new/choose) for bugs, feature requests and proposed keyboards. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR. CI checks the frontend, Go code, installer and documentation. Dependabot monitors Go, npm and GitHub Actions dependencies.

## Version and releases

**Edit only [`internal/version/VERSION`](internal/version/VERSION) to change the application version.** Go embeds this file; the CLI, header badge, updater, native build metadata and release packaging all read it. The frontend has no separate application version.

A release tag must match that file. The release workflow verifies the match, runs CI, builds the app and uploads all assets and checksums before publishing the release. See [publishing releases](https://henriquex25.github.io/Z-MapFlow/community/releases).

Place the square PNG app logo in [`build/appicon.png`](build/appicon.png), preferably at 1024×1024. See [branding](https://henriquex25.github.io/Z-MapFlow/community/branding) for platform-specific derivatives.

## Current limits

The initial distribution and hardware integration target Linux and Sofle v2. Windows/macOS packaging and physical validation remain future work. UF2 transfer requires manual bootloader entry and selection of the connected half. A successful build or file copy does not prove the firmware works on your hardware.

Keymap import supports a defined subset of Devicetree: local `.dtsi` includes, conditionals and function-like defines in the keymap itself require prior expansion. Advanced module properties still depend on the selected ZMK revision and compiler validation. See [configuration](https://henriquex25.github.io/Z-MapFlow/guide/configuration) and [troubleshooting](https://henriquex25.github.io/Z-MapFlow/guide/troubleshooting).
