# ARM display smoke test

This runs the actual `module/screen.c`, pinned Zephyr/LVGL and their allocator on QEMU Cortex-M3 with a monochrome 128×32 dummy display. Only ZMK event delivery, radio state and battery are stubs. It exercises initial waiting state, 100 updates and stale state. It does not validate a physical OLED, radio or UF2 transfer.

Use the same Zephyr workspace/SDK as the Sofle dongle build, with `ZEPHYR_BASE` pointing to its `zephyr` directory. The app restricts module discovery to LVGL and CMSIS so a personal configuration's board/shield files are not loaded.

```sh
west build -p always -b qemu_cortex_m3 -s /path/to/z-mapflow/internal/zmkmodules/statussync/testdata/display -d /tmp/zmapflow-display-smoke
west build -d /tmp/zmapflow-display-smoke -t run
```

Expect `POOL=8192 DISPLAY_READY=1` and `SCREEN_OK`. QEMU stays idle after the marker; exit with Ctrl+A, X. The default comes from the real synchronization module Kconfig. The former 2048-byte configuration failed during screen creation. An explicit `-DCONFIG_LV_Z_MEM_POOL_SIZE=2048` reproduces insufficient allocation; production module CMake now rejects that size instead of building it.
