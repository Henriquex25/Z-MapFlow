# Build, export and flash firmware

## Build

Start Docker and save your project. **Save and build** runs the complete flow; **Build** uses the last saved revision. Builds use temporary containers and persistent caches to reduce repeat downloads.

Follow the current stage and logs in the bottom panel. You may keep editing during a build: its snapshot remains tied to the saved revision that started it.

## Export

After a successful build, choose **Export firmware** and select a folder. A toast confirms the completed export and shows the destination. Cancelling the folder selector does not report success.

Build history lets you recover previous artifacts. Check the revision and target before flashing.

## UF2 flashing

1. Choose **Flash firmware** and select the connected half.
2. Connect the controller by USB in bootloader mode.
3. Select the detected volume or choose one manually.
4. Send the firmware, then repeat for the remaining targets as required.

The app selects the artifact associated with the target. A completed copy confirms transfer, but you must verify the firmware’s behavior on the keyboard. Bootloader entry is manual.
