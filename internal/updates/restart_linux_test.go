//go:build linux

package updates

import (
	"os"
	"os/exec"
	"strconv"
	"testing"
)

func TestWaitForPreviousProcess(t *testing.T) {
	command := exec.Command("sh", "-c", "exit 0")
	if e := command.Start(); e != nil {
		t.Fatal(e)
	}
	if e := command.Wait(); e != nil {
		t.Fatal(e)
	}
	if e := WaitForParent([]string{"--wait-for-parent", strconv.Itoa(command.Process.Pid)}); e != nil {
		t.Fatal(e)
	}
	for _, args := range [][]string{{"--wait-for-parent"}, {"--wait-for-parent", "0"}, {"--wait-for-parent", "1"}, {"--wait-for-parent", strconv.Itoa(os.Getpid())}, {"--wait-for-parent", "bad"}} {
		if e := WaitForParent(args); e == nil {
			t.Fatalf("invalid restart arguments accepted: %v", args)
		}
	}
}
