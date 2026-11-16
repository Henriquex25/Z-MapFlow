package flash

import (
	"fmt"
	"golang.org/x/sys/windows"
)

// Enumerate local drives using Win32; no PowerShell startup, execution policy,
// shell quoting or network-drive probing is needed to discover a UF2 volume.
func mountPaths() ([]string, error) {
	needed, err := windows.GetLogicalDriveStrings(0, nil)
	if err != nil {
		return nil, err
	}
	if needed == 0 || needed > 32768 {
		return nil, fmt.Errorf("invalid logical drive list")
	}
	buffer := make([]uint16, needed+1)
	written, err := windows.GetLogicalDriveStrings(uint32(len(buffer)), &buffer[0])
	if err != nil {
		return nil, err
	}
	if written >= uint32(len(buffer)) {
		return nil, fmt.Errorf("logical drive list changed; try again")
	}
	paths := []string{}
	for start, i := 0, 0; i < len(buffer); i++ {
		if buffer[i] != 0 {
			continue
		}
		if start == i {
			break
		}
		drive := windows.UTF16ToString(buffer[start:i])
		ptr, err := windows.UTF16PtrFromString(drive)
		if err != nil {
			return nil, err
		}
		kind := windows.GetDriveType(ptr)
		if kind == windows.DRIVE_REMOVABLE || kind == windows.DRIVE_FIXED {
			paths = append(paths, drive)
		}
		start = i + 1
	}
	return paths, nil
}
