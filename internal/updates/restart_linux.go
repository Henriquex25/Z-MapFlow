//go:build linux

package updates

import (
	"fmt"
	"os"
	"strconv"
	"syscall"
	"time"
)

// WaitForParent delays the new GUI until the old process has shut down.
func WaitForParent(args []string) error {
	if len(args) == 0 || args[0] != "--wait-for-parent" {
		return nil
	}
	if len(args) != 2 {
		return fmt.Errorf("argumentos de reinicialização inválidos")
	}
	pid, e := strconv.Atoi(args[1])
	if e != nil || pid <= 1 || pid == os.Getpid() {
		return fmt.Errorf("processo anterior inválido")
	}
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		e = syscall.Kill(pid, 0)
		if e == syscall.ESRCH {
			return nil
		}
		if e != nil {
			return fmt.Errorf("não foi possível aguardar o processo anterior: %w", e)
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("o aplicativo anterior não encerrou; abra o Z-MapFlow novamente")
}
