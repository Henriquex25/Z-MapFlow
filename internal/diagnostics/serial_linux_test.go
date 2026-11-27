//go:build linux

package diagnostics

import (
	"fmt"
	"go.bug.st/serial"
	"golang.org/x/sys/unix"
	"os"
	"strings"
	"testing"
	"time"
)

// Exercise the real serial transport using a virtual terminal, never a controller.
func TestLinuxSerialCaptureOnVirtualTerminal(t *testing.T) {
	fd, err := unix.Open("/dev/ptmx", unix.O_RDWR|unix.O_NOCTTY|unix.O_CLOEXEC, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fd)
	if err := unix.IoctlSetPointerInt(fd, unix.TIOCSPTLCK, 0); err != nil {
		t.Fatal(err)
	}
	index, err := unix.IoctlGetInt(fd, unix.TIOCGPTN)
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("/dev/pts/%d", index)
	// Keep the virtual slave open while simulating its data stream.
	slave, err := os.OpenFile(name, os.O_RDWR, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer slave.Close()
	m := &Manager{
		list: func() ([]string, error) { return []string{name}, nil },
		// Virtual terminals lack modem-line ioctls; test the real read/timeout/
		// close transport here. DTR assertion needs a USB CDC device.
		open: func(name string) (reader, error) { return serial.Open(name, &serial.Mode{BaudRate: 115200}) },
	}
	if err := m.Start(name); err != nil {
		t.Fatal(err)
	}
	defer m.Stop()
	if _, err := unix.Write(fd, []byte("Security failed: simulated\r\n")); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(2 * time.Second)
	for !strings.Contains(m.Display().Text, "Security failed: simulated") {
		if time.Now().After(deadline) {
			t.Fatal("real serial transport did not receive virtual output")
		}
		time.Sleep(time.Millisecond)
	}
	m.Stop()
	if m.Display().Running {
		t.Fatal("capture did not stop")
	}
}
