package flash

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
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
	name := filepath.Base(resolved)
	if drive := filepath.VolumeName(resolved); drive != "" && strings.TrimRight(resolved, `\/`) == drive {
		name = drive
	}
	return Volume{Path: resolved, Name: name, Board: strings.TrimSpace(board)}, nil
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

// Result separates a completed host transfer from a transfer whose final flush
// could not be confirmed. Neither state proves the keyboard booted successfully.
type Result struct {
	Status string `json:"status"` // sent or unconfirmed
	Detail string `json:"detail"`
}

// Copy sends a verified artifact. Final sync/close failures remain unconfirmed:
// UF2 bootloaders can reboot before the host finishes, but real I/O failures can
// produce the same error. Interrupted copies always return an error.
func Copy(source, destination, name string, variant models.Variant) (Result, error) {
	volume, err := Inspect(destination, variant)
	if err != nil {
		return Result{}, err
	}
	if filepath.Base(name) != name || strings.ToLower(filepath.Ext(name)) != ".uf2" {
		return Result{}, fmt.Errorf("nome de firmware inválido")
	}
	dest := filepath.Join(volume.Path, name)
	if info, e := os.Lstat(dest); e == nil && (!info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0) {
		return Result{}, fmt.Errorf("destino de firmware inválido")
	}
	in, err := os.Open(source)
	if err != nil {
		return Result{}, err
	}
	defer in.Close()
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return Result{}, err
	}
	return copyToVolume(out, in)
}

type volumeWriter interface {
	io.Writer
	Sync() error
	Close() error
}

func copyToVolume(out volumeWriter, in io.Reader) (Result, error) {
	var err error
	if _, err = io.Copy(out, in); err != nil {
		out.Close()
		return Result{}, fmt.Errorf("envio interrompido; reconecte em bootloader e tente novamente: %w", err)
	}
	if err = out.Sync(); err != nil {
		out.Close()
		return Result{Status: "unconfirmed", Detail: err.Error()}, nil
	}
	if err = out.Close(); err != nil {
		return Result{Status: "unconfirmed", Detail: err.Error()}, nil
	}
	return Result{Status: "sent"}, nil
}
