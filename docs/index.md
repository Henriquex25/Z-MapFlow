---
layout: home
hero:
  name: Z-MapFlow
  text: Drag, drop, build and flash
  tagline: Configure your ZMK keyboard visually, compile firmware locally and flash it—all in one desktop app.
  actions:
    - theme: brand
      text: Get started
      link: /guide/install
    - theme: alt
      text: Add a keyboard plugin
      link: /plugins
features:
  - title: Drag and drop your keys
    details: Drag actions onto keys or encoders, swap assignments and organize layers, macros and behaviors while seeing your physical layout.
  - title: Build from the editor
    details: Save and compile locally with Docker. Follow progress and logs, and keep editing while your saved revision builds.
  - title: Flash from the same app
    details: Follow the guided UF2 flow for each half. Connect it in bootloader mode and let the app send the matching firmware, or export it for later.
---

## Your keyboard workflow, in one place

Z-MapFlow brings layout editing, firmware compilation and guided flashing into the same workspace. Turn an idea into a key assignment, build the saved configuration and send it to your keyboard with fewer steps between changes.

![Z-MapFlow showing a Sofle v2 layout, layers on the left, the action palette below and firmware controls at the bottom](/images/z-mapflow-layout.png)

*The current editor: layers on the left, your layout in the center, actions in the palette below and save/build controls on the right. Firmware progress, export and flash are available at the bottom.*

[Install the app](/guide/install), follow the [first editing steps](/guide/getting-started), then [build and flash your firmware](/guide/firmware).

## Grow with the community

Contribute fixes, documentation, translations or [a plugin for another keyboard](/plugins).

**Available for Linux x86_64 only**, with Sofle v2 as the first supported keyboard. macOS and Windows releases are outside the current scope. Other keyboards can be added through plugins. The interface defaults to English, with Brazilian Portuguese available in Settings → Application. Successful compilation does not replace hardware validation.
