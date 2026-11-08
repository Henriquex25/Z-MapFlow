package flash

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
	"z-mapflow/internal/models"
)

type Volume struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	Board string `json:"board"`
}

func Inspect(path string, variant models.Variant) (Volume, error) {
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		return Volume{}, err
	}
	resolved, err = filepath.Abs(resolved)
	if err != nil {
		return Volume{}, err
	}
	info, err := os.Stat(resolved)
	if err != nil || !info.IsDir() {
		return Volume{}, fmt.Errorf("selecione a pasta raiz do volume de bootloader")
	}
	metadata, err := os.Open(filepath.Join(resolved, "INFO_UF2.TXT"))
	if err != nil {
		return Volume{}, fmt.Errorf("volume sem INFO_UF2.TXT; conecte o teclado em modo bootloader")
	}
	defer metadata.Close()
	data, err := io.ReadAll(io.LimitReader(metadata, 32768))
	if err != nil {
		return Volume{}, err
	}
	text := string(data)
	compatible := false
	for _, board := range variant.BootloaderBoards {
		if strings.Contains(strings.ToLower(text), strings.ToLower(board)) {
			compatible = true
			break
		}
	}
	if !compatible {
		return Volume{}, fmt.Errorf("bootloader não corresponde à controladora selecionada")
	}
	board := ""
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "Board-ID:") || strings.HasPrefix(line, "Model:") {
			board += strings.TrimSpace(line) + " "
		}
	}
	return Volume{Path: resolved, Name: filepath.Base(resolved), Board: strings.TrimSpace(board)}, nil
}
func Discover(variant models.Variant) ([]Volume, error) {
	paths, err := mountPaths()
	if err != nil {
		return nil, err
	}
	volumes := []Volume{}
	seen := map[string]bool{}
	for _, path := range paths {
		volume, e := Inspect(path, variant)
		if e == nil && !seen[volume.Path] {
			volumes = append(volumes, volume)
			seen[volume.Path] = true
		}
	}
	return volumes, nil
}
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
	case "windows":
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		output, err := exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_LogicalDisk | ForEach-Object { $_.DeviceID + '\\' }").Output()
		if err != nil {
			return nil, err
		}
		for _, line := range strings.Split(string(output), "\n") {
			if p := strings.TrimSpace(line); p != "" {
				paths = append(paths, p)
			}
		}
	default:
		return nil, fmt.Errorf("descoberta de volumes indisponível neste sistema; selecione o volume manualmente")
	}
	return paths, nil
}

// Copy sends a verified artifact. It does not claim the keyboard booted successfully.
func Copy(source, destination, name string, variant models.Variant) error {
	volume, err := Inspect(destination, variant)
	if err != nil {
		return err
	}
	if filepath.Base(name) != name || strings.ToLower(filepath.Ext(name)) != ".uf2" {
		return fmt.Errorf("nome de firmware inválido")
	}
	dest := filepath.Join(volume.Path, name)
	if info, e := os.Lstat(dest); e == nil && (!info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0) {
		return fmt.Errorf("destino de firmware inválido")
	}
	in, err := os.Open(source)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	if _, err = io.Copy(out, in); err != nil {
		out.Close()
		return fmt.Errorf("envio interrompido; reconecte em bootloader e tente novamente: %w", err)
	}
	if err = out.Sync(); err != nil {
		out.Close()
		return fmt.Errorf("não foi possível confirmar a gravação no volume; confira a reinicialização do teclado: %w", err)
	}
	return out.Close()
}
