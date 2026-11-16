//go:build windows

package updates

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
	"z-mapflow/internal/hostcmd"
	"z-mapflow/internal/storage"
)

func init() {
	nativeTestMain = func() bool {
		if os.Getenv("ZMAPFLOW_WINDOWS_HELPER_TEST") != "1" {
			return false
		}
		showUpdateError = func(message string) { fmt.Fprintln(os.Stderr, message) }
		marker := os.Getenv("ZMAPFLOW_WINDOWS_HELPER_MARKER")
		if len(os.Args) == 2 && os.Args[1] == "--hold-update-parent" {
			os.WriteFile(marker+".parent", []byte("running"), 0600)
			time.Sleep(30 * time.Second)
			return true
		}
		if handled, err := HandleHelper(os.Args[1:]); handled {
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			return true
		}
		if len(os.Args) == 1 {
			os.WriteFile(marker, []byte("restarted"), 0600)
			return true
		}
		return false
	}
}

func waitForFile(t *testing.T, path string) {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(path); err == nil {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", path)
}

func TestNativeWindowsUpdateWaitsForLockedParentThenRestarts(t *testing.T) {
	root := filepath.Join(t.TempDir(), "app path with spaces")
	if err := os.Mkdir(root, 0700); err != nil {
		t.Fatal(err)
	}
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(self)
	if err != nil {
		t.Fatal(err)
	}
	old := append(append([]byte{}, data...), []byte("old bytes")...)
	updated := append(append([]byte{}, data...), []byte("new bytes")...)
	target := filepath.Join(root, "z-mapflow.exe")
	staged := filepath.Join(root, ".z-mapflow-update-test.exe")
	helper := filepath.Join(root, ".z-mapflow-helper-test.exe")
	for path, content := range map[string][]byte{target: old, staged: updated, helper: data} {
		if err := os.WriteFile(path, content, 0700); err != nil {
			t.Fatal(err)
		}
	}
	marker := filepath.Join(root, "restarted.txt")
	env := append(os.Environ(), "ZMAPFLOW_WINDOWS_HELPER_TEST=1", "ZMAPFLOW_UPDATE_VERSION_HELPER=1", "ZMAPFLOW_WINDOWS_HELPER_MARKER="+marker)
	parent := hostcmd.Command(target, "--hold-update-parent")
	parent.Env = env
	if err := parent.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { parent.Process.Kill() })
	waitForFile(t, marker+".parent")
	sum := sha256.Sum256(updated)
	plan := updatePlan{ParentPID: parent.Process.Pid, Target: filepath.Base(target), Staged: filepath.Base(staged), Version: "1.2.0", SHA256: hex.EncodeToString(sum[:])}
	if err := storage.AtomicJSON(helper+".json", plan); err != nil {
		t.Fatal(err)
	}
	worker := hostcmd.Command(helper, "--apply-update", helper+".json")
	worker.Env = env
	var output bytes.Buffer
	worker.Stdout, worker.Stderr = &output, &output
	if err := worker.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { worker.Process.Kill() })
	waitForFile(t, helper+".json.ready")
	if current, err := os.ReadFile(target); err != nil || !bytes.Equal(current, old) {
		t.Fatal("modified the locked parent before it exited")
	}
	parent.Process.Kill()
	parent.Wait()
	if err := worker.Wait(); err != nil {
		t.Fatalf("%v: %s", err, output.String())
	}
	waitForFile(t, marker)
	if current, err := os.ReadFile(target); err != nil || !bytes.Equal(current, updated) {
		t.Fatal("update was not installed")
	}
	if backup, err := os.ReadFile(target + ".previous"); err != nil || !bytes.Equal(backup, old) {
		t.Fatal("original backup missing")
	}
}
