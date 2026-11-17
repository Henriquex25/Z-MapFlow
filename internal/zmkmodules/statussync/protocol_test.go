package statussync

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestActualTransportWithSimulatedBluetooth(t *testing.T) {
	cc, err := exec.LookPath("cc")
	if err != nil {
		t.Skip("host C compiler unavailable")
	}
	stubs := t.TempDir()
	// Child compiler reads are not tracked by Go's test cache. Record fixtures.
	for _, name := range []string{"runtime_fake.h", "sender_test.c", "receiver_test.c"} {
		if _, err := os.ReadFile(filepath.Join("testdata", name)); err != nil {
			t.Fatal(err)
		}
	}
	for _, name := range []string{"zephyr/kernel.h", "zephyr/init.h", "zephyr/bluetooth/conn.h", "zephyr/bluetooth/gatt.h", "zephyr/bluetooth/uuid.h", "zmk/event_manager.h", "zmk/ble.h", "zmk/endpoints.h", "zmk/keymap.h", "zmk/events/layer_state_changed.h", "zmk/events/endpoint_changed.h", "zmk/events/ble_active_profile_changed.h", "zmk/events/usb_conn_state_changed.h"} {
		path := filepath.Join(stubs, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte("#include <runtime_fake.h>\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for _, name := range []string{"sender", "receiver"} {
		t.Run(name, func(t *testing.T) {
			bin := filepath.Join(t.TempDir(), "transport-test")
			args := []string{"-std=c11", "-Wall", "-Wextra", "-Werror", "-Wno-unused-parameter", "-I" + stubs, "-Itestdata", "-Imodule/include", "-Imodule", "testdata/" + name + "_test.c", "-o", bin}
			if out, err := exec.Command(cc, args...).CombinedOutput(); err != nil {
				t.Fatalf("compile: %v\n%s", err, out)
			}
			if out, err := exec.Command(bin).CombinedOutput(); err != nil {
				t.Fatalf("runtime: %v\n%s", err, out)
			}
		})
	}
}

func TestWireProtocolOnHost(t *testing.T) {
	if _, err := os.ReadFile("testdata/protocol_test.c"); err != nil {
		t.Fatal(err)
	}
	cc, err := exec.LookPath("cc")
	if err != nil {
		t.Skip("host C compiler unavailable; real ARM builds remain opt-in")
	}
	bin := filepath.Join(t.TempDir(), "protocol-test")
	cmd := exec.Command(cc, "-std=c11", "-Wall", "-Wextra", "-Werror", "-Imodule/include", "testdata/protocol_test.c", "-o", bin)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("compile: %v\n%s", err, out)
	}
	if out, err := exec.Command(bin).CombinedOutput(); err != nil {
		t.Fatalf("protocol: %v\n%s", err, out)
	}
}
