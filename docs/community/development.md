# Development

## Environment

Use Go as required by `go.mod`, Node 24/npm and Wails CLI matching the Go module (`v2.15.0` currently). Official Linux builds use GCC, GTK 3 and WebKitGTK 4.1.

```sh
sudo apt install build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev
go install github.com/wailsapp/wails/v2/cmd/wails@v2.15.0
npm ci --prefix frontend
python3 scripts/wails.py dev -tags webkit2_41
```

Docker is needed for firmware builds and the opt-in integration test. If your existing environment uses WebKitGTK 4.0, omit `-tags webkit2_41` from Go/Wails commands.

## Checks

```sh
npm run format:check --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
go test -race -tags webkit2_41 ./...
go vet -tags webkit2_41 ./...
python3 -m unittest discover -s scripts -p 'test_*.py' -v
python3 scripts/wails.py build -tags webkit2_41
```

After changing Go models or exported API methods, regenerate the bridge:

```sh
python3 scripts/wails.py generate module -tags webkit2_41
```

Frontend data types derive from these models; do not maintain separate geometry types or edit generated bindings manually. Preserve immutable snapshots, stable IDs and plugin compatibility. Read `AGENT.md` before changing core behavior.

## Version

`internal/version/VERSION` is the single version source. Go embeds it, and the CLI, header, updater and package scripts consume it. `scripts/wails.py` temporarily supplies this value to Wails native package metadata and restores the configuration afterwards. Do not add independent app versions to frontend manifests or linker flags.

## Interface translation

English strings are the canonical keys. The shared English/Brazilian Portuguese catalog is `internal/i18n/pt-BR.json`, used by React and native Go dialogs. Use `tr()` for app text and placeholders for dynamic values. Components subscribe with `useLocale()` so changes take effect without remounting the editor.

Application preferences are persisted independently of the firmware project. Never translate ZMK code, filenames, IDs or user-created names. Update the catalog and test both languages when changing visible controls.

## Documentation

```sh
npm ci --prefix docs
npm run dev --prefix docs
npm run build --prefix docs
```

The [VitePress](https://vitepress.dev/) site uses English at the root and Brazilian Portuguese under `/pt-BR/`, with local search. The Pages workflow publishes `main`; PRs validate the build. Keep corresponding pages up to date.

## Firmware integration

```sh
ZMAPFLOW_DOCKER_TEST=1 go test ./internal/firmware -run '^TestDockerIntegration$' -v -timeout 45m
```

This downloads dependencies and compiles firmware without flashing hardware. Automated copy tests must use simulated volumes.
