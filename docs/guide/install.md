# Installation and updates

The initial distribution supports **Linux x86_64**, GTK 3 and WebKitGTK 4.1, built on Ubuntu 22.04. Windows, macOS and other architectures do not have official packages yet.

## Install

1. Open [GitHub Releases](https://github.com/Henriquex25/Z-MapFlow/releases/latest) and download `z-mapflow_VERSION_linux_amd64.tar.gz`.
2. Extract the archive and run `./install.sh` in a terminal from the extracted directory. The installer opens the app and adds **Z-MapFlow** to your application menu.

Installation is per user and does not require `sudo`. You do not need Go, Node or development tools. If runtime libraries are missing on a compatible Ubuntu/Pop!_OS/Debian system:

```sh
sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0
```

The installer verifies the extracted files and checks that the executable can report its version before changing an existing installation. To verify the downloaded archive too, download `checksums.txt` from the same release and run in your downloads directory:

```sh
sha256sum --ignore-missing -c checksums.txt
```

Install and start [Docker](https://docs.docker.com/get-started/get-docker/) when you want to build firmware. Docker Desktop works when its context is available through the CLI. Editing and saving do not require Docker.

## Interface language

English is the default. Choose **Settings → Application → Interface language → Português (Brasil)** to switch without restarting. The preference is saved on this computer. It is independent of the operating system keyboard layout and does not change any bindings or mark the firmware project as edited.

The current app version appears beside the app name in the header.

## Automatic updates

At startup, the app checks the latest public stable release from the official repository. A popup lets you choose **Not now** or **Update**. If your project has unsaved changes, choose **Save and update**. Imported projects that have never been saved are saved too.

Correct invalid fields first. Firmware builds and transfers must finish or be cancelled before updating.

The updater selects the asset for your OS/architecture, verifies its size, SHA-256 and GitHub digest when available, checks the Linux executable format and architecture, and runs a version probe to check runtime dependencies. It makes a complete `.previous` backup, replaces the executable atomically and restarts after the old process exits. Immediate replacement or restart failures restore the previous executable.

This does not detect every functional problem after the new GUI starts. See [troubleshooting](./troubleshooting) for manual recovery.

The editor remains usable offline or when GitHub is unavailable. Click the update indicator in the header to retry. No token or GitHub login is required to check public releases. Prereleases are ignored.

## Data and uninstalling

Projects and builds live in the app’s configuration directory, normally `~/.config/z-mapflow`; `XDG_CONFIG_HOME` is respected. Updating the executable does not delete those files.

The executable is installed under `${XDG_DATA_HOME:-$HOME/.local/share}/z-mapflow`. To remove the app, remove that directory, its `applications/z-mapflow.desktop` launcher under the same data directory and `~/.local/bin/z-mapflow`. Keep the configuration directory if you want to reinstall later.
