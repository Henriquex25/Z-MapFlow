# Build, export and flash firmware

## Build

Start Docker and save your project. **Save and build** runs the complete flow; **Build** uses the last saved revision. Builds use temporary containers and persistent caches to reduce repeat downloads.

Follow the current stage and logs in the bottom panel. You may keep editing during a build: its snapshot remains tied to the saved revision that started it.

## Export

After a successful build, choose **Export firmware** and select a folder. A toast confirms the completed export and shows the destination. Cancelling the folder selector does not report success.

Build history lets you recover previous artifacts. Check the revision and target before flashing.

## UF2 flashing

Choose **Flash firmware** to open the step-by-step wizard. The progress bar shows the current stage, and **Previous step** lets you review earlier choices before sending.

1. **Choose half.** Select the half you will connect, then choose **Next step**.
2. **Connect.** Follow your controller's bootloader instructions. A single detected volume is selected automatically. If several are present, choose one, or use **Select volume manually**. Continue with **Next step** once a volume is selected.
3. **Send.** Review the selected half, bootloader drive and firmware filename. Choose **Send firmware** to start the transfer. Navigation is disabled while it is sending; if a detected drive disappears before sending, the wizard returns to the connection step.
4. **Result.** Wait for the keyboard to restart and test the new layout. The result distinguishes a completed file transfer, an unconfirmed final write and an interrupted copy. Use **Flash next half** to start the next half, or **Finish** after all targets have been sent.

For Sofle profiles, the app first checks the installed topology. Changing between a half central and a USB dongle central adds a required **Reset every device → Install keyboard firmware** sequence. Keyboard firmware stays locked until every reset transfer and restart acknowledgement is recorded. See the [migration and resume guide](./dongle#required-migration-steps-and-resuming). Ordinary updates on the recorded topology skip mandatory cleanup.

Each screen shows only the controls for its current step. Advancing requires a selected half or drive, as appropriate. Nothing is sent until you explicitly choose **Send firmware** on the review screen.
The app selects the artifact associated with the target. A completed copy confirms transfer, but you must verify the firmware’s behavior on the keyboard. Bootloader entry is manual.

![Z-MapFlow flash wizard reviewing the left half, bootloader drive and matching UF2 firmware before sending](/images/z-mapflow-flash-wizard.png)

*Example of step 3: review the target, firmware and build revision before choosing Send firmware.*

## Correct an accidental setup choice

Before the first transfer, **Undo setup choice** returns to the installed-setup selection so you can correct a mistaken click, including **I'm not sure**. It can also undo an accidental **I flashed outside the app or changed controllers** report and restore the previous workflow. The available undo survives closing and reopening the app.

Only the guide’s selection is reversed. Once a transfer starts, the app removes this undo option because a controller may already have changed, even if the write later reports an error. **Close** still lets you leave and resume; pending acknowledgements and required cleanup are retained. Returning to a previous choice never cancels a USB write or skips an existing migration.

The first setup screen uses the available modal space. On smaller windows, its choices scroll together rather than being clipped to a short panel.

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


## A transfer that stays pending

During sending, the wizard shows separate drive-check, opening, copy, final USB write and close phases. The byte count reports data accepted by the operating system; it is **not** confirmation that the controller has programmed flash. After 30 seconds without phase/byte progress, a warning explains that the system is still waiting. The app keeps the transfer pending, does not retry automatically and rejects another simultaneous transfer.

If it remains stuck, disconnect the selected controller, cancel any queued file-manager copy, reconnect in bootloader mode and wait for the previous operation to return before retrying. A blocked USB filesystem write can also block a second manual copy. Repeat only the matching keyboard firmware; pairing reset is needed for initial topology migration, not every failed transfer.

The app saves the latest transfer's stages and outcome in `flash/latest.json` under its configuration directory (`~/.config/z-mapflow/flash/latest.json` on Linux with the default XDG location). This records the build/target, volume, OS byte count, timestamps and any returned error for diagnosis. A pending record alone does not prove successful or failed programming. Linux USB timeouts and an inaccessible volume need investigation independently of the desktop UI.

## Windows USB drives

On Windows, put the connected half into bootloader mode and wait for its UF2 drive to appear in Explorer. The app discovers local drives through Win32 and checks `INFO_UF2.TXT` against the selected controller. If discovery misses it, select the drive root manually, such as `E:\`. Choose the connected half explicitly; the drive alone cannot identify left versus right. Flashing copies directly from the Windows app to the drive, without Docker USB passthrough. Physical Windows keyboard validation is still pending.
