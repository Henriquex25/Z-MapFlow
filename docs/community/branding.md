# Logo and icons

Replace **`build/appicon.png`** with the main app logo. Use a square PNG, preferably **1024×1024**, with internal padding and transparency where appropriate.

Linux embeds this file as the window icon and includes it in the installer for the application menu. Rebuild to incorporate a new image. The source file is preserved by builds.

For future Windows packaging, regenerate `build/windows/icon.ico` whenever the source PNG changes so Wails does not reuse an outdated derivative. Apply the same care to an existing macOS `.icns` derivative.

If you have a vector original, keep it under `assets/branding/logo.svg` and export the PNG to `build/appicon.png`. Only contribute artwork you have permission to distribute, preserving relevant third-party notices.

The in-app header and browser favicon import `build/appicon.png` directly. Linux embeds the same source as the window icon; the installer copies it for the application launcher. An installed Linux app refreshes that launcher image from its embedded icon on startup after a binary update. The Windows `build/windows/icon.ico` derivative has also been regenerated from this logo.
