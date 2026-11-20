package updates

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"z-mapflow/internal/hostcmd"
	"z-mapflow/internal/storage"

	"golang.org/x/sys/windows"
)

func applyPlatformUpdate(ctx context.Context, staged, target, version string, sum []byte, _ func(string) error) (retained bool, err error) {
	helper, err := os.CreateTemp(filepath.Dir(target), ".z-mapflow-helper-*.exe")
	if err != nil {
		return false, err
	}
	helperName := helper.Name()
	helper.Close()
	planName := helperName + ".json"
	defer func() {
		if !retained {
			os.Remove(helperName)
			os.Remove(planName)
			os.Remove(planName + ".ready")
			os.Remove(planName + ".error.txt")
		}
	}()
	if err := backupExecutable(target, helperName); err != nil {
		return false, err
	}
	plan := updatePlan{ParentPID: os.Getpid(), Target: filepath.Base(target), Staged: filepath.Base(staged), Version: version, SHA256: hex.EncodeToString(sum)}
	if err := plan.validate(); err != nil {
		return false, err
	}
	if err := storage.AtomicJSON(planName, plan); err != nil {
		return false, err
	}
	cmd := hostcmd.Command(helperName, "--apply-update", planName)
	if err := cmd.Start(); err != nil {
		return false, err
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	deadline := time.NewTimer(12 * time.Second)
	defer deadline.Stop()
	poll := time.NewTicker(50 * time.Millisecond)
	defer poll.Stop()
	for {
		select {
		case <-poll.C:
			if _, err := os.Stat(planName + ".ready"); err == nil {
				return true, nil
			}
			if data, err := os.ReadFile(planName + ".error.txt"); err == nil {
				cmd.Process.Kill()
				<-done
				return false, fmt.Errorf("update helper: %s", data)
			}
		case err := <-done:
			if data, e := os.ReadFile(planName + ".error.txt"); e == nil {
				return false, fmt.Errorf("update helper: %s", data)
			}
			return false, fmt.Errorf("update helper stopped before becoming ready: %v", err)
		case <-deadline.C:
			cmd.Process.Kill()
			<-done
			return false, errors.New("the update helper did not become ready; the app was not changed")
		case <-ctx.Done():
			cmd.Process.Kill()
			<-done
			return false, ctx.Err()
		}
	}
}

// HandleHelper runs before Wails/WebView2, so updates need no extra GUI process.
// A native process handle, rather than PID polling, prevents PID reuse races.
func HandleHelper(args []string) (bool, error) {
	if len(args) == 0 || args[0] != "--apply-update" {
		cleanupHelpers()
		return false, nil
	}
	if len(args) != 2 {
		return true, errors.New("invalid update helper arguments")
	}
	self, err := os.Executable()
	if err != nil {
		return true, err
	}
	self, err = filepath.EvalSymlinks(self)
	if err != nil {
		return true, err
	}
	planName, err := filepath.EvalSymlinks(args[1])
	if err != nil {
		return true, err
	}
	if !strings.HasPrefix(filepath.Base(self), ".z-mapflow-helper-") || !strings.EqualFold(planName, self+".json") {
		return true, errors.New("invalid update helper location")
	}
	err = runWindowsPlan(planName)
	if err != nil {
		os.WriteFile(planName+".error.txt", []byte(err.Error()), 0600)
		// Before readiness the original UI is still alive and reports the error.
		// After readiness it has exited, so use a native error message instead.
		if _, ready := os.Stat(planName + ".ready"); ready == nil {
			showUpdateError(err.Error())
		}
	}
	os.Remove(planName)
	os.Remove(planName + ".ready")
	return true, err
}

func runWindowsPlan(planName string) error {
	plan, err := readPlan(planName)
	if err != nil {
		return err
	}
	root := filepath.Dir(planName)
	target := filepath.Join(root, plan.Target)
	staged := filepath.Join(root, plan.Staged)
	defer os.Remove(staged)
	if err := verifyFileHash(staged, plan.SHA256); err != nil {
		return err
	}
	if err := validatePE(staged); err != nil {
		return err
	}
	parent, err := windows.OpenProcess(windows.SYNCHRONIZE|windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(plan.ParentPID))
	if err != nil {
		return fmt.Errorf("could not open the previous process: %w", err)
	}
	defer windows.CloseHandle(parent)
	buffer := make([]uint16, 32768)
	size := uint32(len(buffer))
	if err := windows.QueryFullProcessImageName(parent, 0, &buffer[0], &size); err != nil {
		return err
	}
	actual, err := filepath.EvalSymlinks(windows.UTF16ToString(buffer[:size]))
	if err != nil || !strings.EqualFold(filepath.Clean(actual), filepath.Clean(target)) {
		return errors.New("the previous process is not the application being updated")
	}
	if err := os.WriteFile(planName+".ready", []byte("ready"), 0600); err != nil {
		return err
	}
	event, err := windows.WaitForSingleObject(parent, 60000)
	if err != nil {
		return err
	}
	if event != windows.WAIT_OBJECT_0 {
		return errors.New("the previous app did not close; no files were replaced")
	}
	// Recheck bytes and version after the parent exits, immediately before replacement.
	if err := verifyFileHash(staged, plan.SHA256); err != nil {
		restartWindows(target)
		return err
	}
	if err := validateExecutable(context.Background(), staged, plan.Version); err != nil {
		restartWindows(target)
		return err
	}
	original, err := os.ReadFile(target)
	if err != nil {
		restartWindows(target)
		return err
	}
	_, err = replaceAndRestart(context.Background(), staged, target, plan.Version, nil, restartWindows)
	if err != nil {
		// A backup failure also leaves the old target intact. Only relaunch it
		// when we can prove it is the original or was successfully rolled back.
		if current, e := os.ReadFile(target); e == nil && bytes.Equal(current, original) {
			restartWindows(target)
		}
		return fmt.Errorf("Windows update failed; previous executable: %s.previous: %w", target, err)
	}
	return nil
}

func restartWindows(target string) error {
	// The replacement is a GUI app. hostcmd hides child windows for CLI tools,
	// which also hides Wails' first window and leaves an invisible single instance.
	cmd := exec.Command(target)
	if err := cmd.Start(); err != nil {
		return err
	}
	go cmd.Wait()
	return nil
}

func WaitForParent(args []string) error {
	if len(args) == 0 || args[0] != "--wait-for-parent" {
		return nil
	}
	if len(args) != 2 {
		return errors.New("invalid restart arguments")
	}
	pid, err := strconv.Atoi(args[1])
	if err != nil || pid <= 1 || pid == os.Getpid() {
		return errors.New("invalid previous process")
	}
	handle, err := windows.OpenProcess(windows.SYNCHRONIZE, false, uint32(pid))
	if err != nil {
		return err
	}
	defer windows.CloseHandle(handle)
	event, err := windows.WaitForSingleObject(handle, 20000)
	if err != nil {
		return err
	}
	if event != windows.WAIT_OBJECT_0 {
		return errors.New("the previous app did not close")
	}
	return nil
}

var showUpdateError = func(message string) {
	text, _ := windows.UTF16PtrFromString(message)
	title, _ := windows.UTF16PtrFromString("Z-MapFlow update")
	windows.MessageBox(0, text, title, windows.MB_OK|windows.MB_ICONERROR)
}

func cleanupHelpers() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	files, _ := filepath.Glob(filepath.Join(filepath.Dir(exe), ".z-mapflow-helper-*"))
	for _, file := range files {
		if info, err := os.Lstat(file); err == nil && info.Mode().IsRegular() && time.Since(info.ModTime()) > time.Hour {
			os.Remove(file)
		}
	}
}
