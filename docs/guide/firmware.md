# Build, export and flash firmware

## Build

Start Docker and save your project. **Save and build** runs the complete flow; **Build** uses the last saved revision. Builds use temporary containers and persistent caches to reduce repeat downloads.

Follow the current stage and logs in the bottom panel. You may keep editing during a build: its snapshot remains tied to the saved revision that started it.

## Export

After a successful build, choose **Export firmware** and select a folder. A toast confirms the completed export and shows the destination. Cancelling the folder selector does not report success.

Build history lets you recover previous artifacts. Check the revision and target before flashing.

## UF2 flashing

Choose **Flash firmware** to open the visual guide. Its three numbered cards walk you through connecting, choosing a half and checking the drive:

1. **Connect by USB.** Connect one half in bootloader mode. Open **Bootloader instructions** for your controller's instructions.
2. **Choose the connected half.** Select its large button so the app can use the matching firmware.
3. **Check the bootloader drive.** A single detected volume is selected automatically. If several are present, choose one, or use **Select volume manually**.
4. Choose **Send firmware**, wait for the controller to restart and test the new layout. Repeat for the remaining targets as required.

The app selects the artifact associated with the target. A completed copy confirms transfer, but you must verify the firmware’s behavior on the keyboard. Bootloader entry is manual.

## Restart and final write warnings

UF2 bootloaders can restart automatically after receiving firmware, removing their USB drive before the operating system finishes its final write confirmation. On SuperMini nRF52840, the project author observed a working keyboard after the app reported:

```text
sync /media/user/NICENANO/sofle-right.uf2: input/output error
```

This can also happen when copying a UF2 through a file manager. It is consistent with a bootloader restart, but the error alone does not prove that flashing succeeded. UF2 bootloaders can [reset once their blocks have been transferred](https://github.com/microsoft/uf2#rationale).

When the full file copy returns successfully but the final sync or close fails, the app displays **Transfer not confirmed** in an amber panel. The original system error is under **Technical details**. The selected half is not marked as sent automatically.

- Wait for the keyboard to restart, reconnect normally if necessary and test the new layout. If it works, choose **Keyboard works — confirm**. The half is marked **Confirmed by you**, and you can continue to the other half.
- If it does not work, choose **Reconnect and retry**, enter bootloader mode again, check the selected half and drive, and send again.
- If the copy itself is interrupted, the app reports an error. It does not offer the final-write confirmation flow for an incomplete copy.

The app does not retry or declare the keyboard functional based only on the drive disappearing.
