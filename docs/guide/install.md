# Installation and updates

**Before downloading:** check the [keyboard and controller compatibility tables](./keyboards), including which combinations have physical testing and which remain experimental.

Z-MapFlow supports **Linux x86_64**, with **Windows x64 builds in initial testing**. The updated manual release workflow produces packages for both platforms; older published releases may contain Linux only. Native Windows CI covers builds and installer checks; physical keyboard validation on Windows remains pending. macOS and Windows ARM64 are not packaged yet.

## Linux x86_64

On Ubuntu, Pop!_OS or a compatible Debian system, install the desktop runtime once before running the downloaded package:

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-0
```

The package manager installs its GTK and other runtime dependencies too. These system packages require administrator access; the app itself installs into your user account.

1. Open [GitHub Releases](https://github.com/Henriquex25/Z-MapFlow/releases/latest) and download `z-mapflow_VERSION_linux_amd64.tar.gz`.
2. Extract the archive and run `./install.sh` in a terminal from the extracted directory. The installer opens the app and adds **Z-MapFlow** to your application menu.

Installation is per user and does not require `sudo`. You do not need Go, Node or development tools. Other Linux distributions need the GTK 3 and WebKitGTK 4.1 runtime packages from their package manager.

The installer verifies the extracted files and checks that the executable can report its version before changing an existing installation. To verify the downloaded archive too, download `checksums.txt` from the same release and run in your downloads directory:

```sh
sha256sum --ignore-missing -c checksums.txt
```

## Windows x64

1. Download `z-mapflow_VERSION_windows_amd64_setup.exe` from [Releases](https://github.com/Henriquex25/Z-MapFlow/releases/latest), when the Windows asset is available.
2. Close an existing Z-MapFlow instance, run the installer and choose **Install**. It installs under `%LOCALAPPDATA%\Programs\Z-MapFlow`, with Start menu and desktop shortcuts, without requiring administrator access for the app.
3. Open **Z-MapFlow** from Start or the installer finish page.

Windows 10/11 x64 and Microsoft WebView2 are required. The installer and app embed Microsoft's WebView2 bootstrapper; if the runtime is missing, installation needs internet access to obtain it. Go, Node and Wails are not required for users. These initial Windows executables are unsigned, so Windows may show an unknown-publisher/SmartScreen warning. Download only from the official release page and verify the installer if needed:

```powershell
Get-FileHash .\z-mapflow_VERSION_windows_amd64_setup.exe -Algorithm SHA256
```

Compare the hash with the matching line in `checksums.txt` from the same release. The raw `z-mapflow_windows_amd64.exe` asset is intended for auto-update; prefer the setup asset for installation.

For firmware builds, install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/), enable its Linux-container backend (normally WSL 2) and start it. Docker is not needed just to edit/export keymaps. Connect the keyboard to Windows directly in bootloader mode for flashing; no USB passthrough into Docker is needed. The app uses native Windows drive discovery, with manual drive selection as a fallback.

## Docker for firmware builds

**Docker must be installed and running to compile keyboard firmware.** Install [Docker Engine or Docker Desktop](https://docs.docker.com/get-started/get-docker/) and start the Docker service or Desktop app before choosing **Build** or **Save and build**.

Z-MapFlow needs access to the Docker daemon. Docker Desktop works when its active context is available through the CLI. If the app cannot access Docker, follow [Docker troubleshooting](./troubleshooting#docker-is-not-available).

Editing and saving layouts, and importing/exporting keymaps, work without Docker. See [build and flash firmware](./firmware) when you are ready to compile.

## Installation problems

### Missing WebKitGTK 4.1 library

**What you see**

The installer checks the package files successfully, then stops with:

```text
./z-mapflow: error while loading shared libraries: libwebkit2gtk-4.1.so.0: cannot open shared object file: No such file or directory
```

**What it means**

A required system library is missing. The downloaded archive uses the GTK 3 and WebKitGTK 4.1 libraries installed on your computer. Having WebKitGTK 4.0 installed does not supply the library required by the release.

Lines ending in `OK` or `SUCESSO` only confirm that package files match their checksums. The next check verifies whether the app can start with your system's libraries. When that check fails, installation stops before creating or replacing application files. New installer builds label the file verification, runtime check and installation as separate steps.

**How to fix it**

On Ubuntu, Pop!_OS or a compatible Debian system, run the following from the extracted package folder:

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-0
./install.sh
```

The package manager also installs the runtime's dependencies. This system setup is needed once; the app itself remains a per-user installation. Other distributions need GTK 3 and WebKitGTK 4.1 runtime packages from their package manager.

You can reuse the archive you already downloaded. Installation completes when the installer prints `Z-MapFlow installed. Open it from your application menu.` If another error remains, include the full terminal output and your Linux distribution/version in an [installation issue](https://github.com/Henriquex25/Z-MapFlow/issues/new/choose).

## Interface language

English is the default. Choose **Settings → Application → Interface language → Português (Brasil)** to switch without restarting. The preference is saved on this computer. It is independent of the operating system keyboard layout and does not change any bindings or mark the firmware project as edited.

The current app version appears beside the app name in the header.

## Automatic updates

At startup, the app checks the latest public stable release from the official repository. A popup lets you choose **Not now** or **Update**. If your project has unsaved changes, choose **Save and update**. Imported projects that have never been saved are saved too.

Correct invalid fields first. Firmware builds and transfers must finish or be cancelled before updating.

The updater selects the asset for your OS/architecture, verifies its size, SHA-256 and GitHub digest when available, checks the executable format and architecture (Linux ELF or Windows PE), and runs a version probe to check runtime dependencies. It makes a complete `.previous` backup, replaces the executable atomically and restarts after the old process exits. Immediate replacement or restart failures restore the previous executable.

On Windows, a helper first signals that it is ready, then waits for the old process to exit before replacing its locked `.exe`. It rechecks the downloaded file, keeps `z-mapflow.exe.previous` and restarts the app. Errors before handoff remain in the app; errors after exit are reported by a native message. Immediate replacement/restart failure preserves or restores the previous executable. Temporary helper executables are cleaned on a later startup once they are no longer in use.

This does not detect every functional problem after the new GUI starts. See [troubleshooting](./troubleshooting) for manual recovery.

The editor remains usable offline or when GitHub is unavailable. Click the update indicator in the header to retry. No token or GitHub login is required to check public releases. Prereleases are ignored.

## Data and uninstalling

Projects and builds live in the app’s configuration directory, normally `~/.config/z-mapflow`; `XDG_CONFIG_HOME` is respected. Updating the executable does not delete those files.

On Windows, projects, build history, support preferences and WebView2 preferences live under `%APPDATA%\z-mapflow`. The WebView2 data path remains stable after updates. Use **Settings → Apps → Z-MapFlow → Uninstall** to remove the app; configuration is preserved for reinstallation.

On Linux, the executable is installed under `${XDG_DATA_HOME:-$HOME/.local/share}/z-mapflow`. To remove the app, remove that directory, its `applications/z-mapflow.desktop` launcher under the same data directory and `~/.local/bin/z-mapflow`. Keep the configuration directory if you want to reinstall later.
