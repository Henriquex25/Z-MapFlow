//go:build !windows

package flash

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

func mountPaths() ([]string, error) {
	paths := []string{}
	switch runtime.GOOS {
	case "linux":
		f, err := os.Open("/proc/self/mountinfo")
		if err != nil {
			return nil, err
		}
		defer f.Close()
		scanner := bufio.NewScanner(f)
		decode := strings.NewReplacer(`\040`, " ", `\011`, "\t", `\012`, "\n", `\134`, `\`)
		for scanner.Scan() {
			fields := strings.Fields(scanner.Text())
			if len(fields) > 5 {
				paths = append(paths, decode.Replace(fields[4]))
			}
		}
		if err = scanner.Err(); err != nil {
			return nil, err
		}
	case "darwin":
		entries, err := os.ReadDir("/Volumes")
		if err != nil {
			return nil, err
		}
		for _, entry := range entries {
			paths = append(paths, filepath.Join("/Volumes", entry.Name()))
		}
	default:
		return nil, fmt.Errorf("descoberta de volumes indisponível neste sistema; selecione o volume manualmente")
	}
	return paths, nil
}
