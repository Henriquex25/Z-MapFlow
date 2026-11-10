# Build Directory

The build directory is used to house all the build files and assets for your application. 

The structure is:

* bin - Output directory
* darwin - macOS specific files
* windows - Windows specific files

## Mac

The `darwin` directory holds files specific to Mac builds.
These may be customised and used as part of the build. To return these files to the default state, simply delete them
and
build with `wails build`.

The directory contains the following files:

- `Info.plist` - the main plist file used for Mac builds. It is used when building using `wails build`.
- `Info.dev.plist` - same as the main plist file but used when building using `wails dev`.

## Windows

The `windows` directory contains the manifest and rc files used when building with `wails build`.
These may be customised for your application. To return these files to the default state, simply delete them and
build with `wails build`.

- `icon.ico` - The icon used for the application. This is used when building using `wails build`. If you wish to
  use a different icon, simply replace this file with your own. If it is missing, a new `icon.ico` file
  will be created using the `appicon.png` file in the build directory.
- `installer/*` - The files used to create the Windows installer. These are used when building using `wails build`.
- `info.json` - Application details used for Windows builds. The data here will be used by the Windows installer,
  as well as the application itself (right click the exe -> properties -> details)
- `wails.exe.manifest` - The main application manifest file.

## Source icon

Replace `build/appicon.png` with the project's square PNG logo (1024×1024 recommended). Linux embeds this file as the window icon and the release installer uses it for the application launcher. Preserve vector sources, when available, under `assets/branding/`.

The `build/windows/icon.ico` file is derived from the same PNG. Regenerate it when changing the logo so Windows packaging does not reuse an old derivative. See `docs/community/branding.md`.

## Application version

Edit only `internal/version/VERSION`. Run Wails through `python3 scripts/wails.py build` (or `dev` / `generate module`) so native metadata is supplied from that source. `wails.json` deliberately has no independently maintained `productVersion`; platform templates consume the generated value during the command.

The in-app header and browser favicon import `build/appicon.png` directly. Linux embeds the same source as the window icon; the installer copies it for the application launcher. An installed Linux app refreshes that launcher image from its embedded icon on startup after a binary update. The Windows `build/windows/icon.ico` derivative has also been regenerated from this logo.
