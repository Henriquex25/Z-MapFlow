package main

import (
	"fmt"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"os"
	"z-mapflow/internal/diagnostics"
	"z-mapflow/internal/version"
)

func (a *App) ListDiagnosticPorts() ([]string, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	ports, err := diagnostics.Ports()
	if ports == nil {
		ports = []string{}
	}
	return ports, err
}
func (a *App) StartDiagnostics(port string) error {
	if !a.operation.TryLock() {
		return fmt.Errorf("aguarde a conclusão do envio de firmware em andamento")
	}
	defer a.operation.Unlock()
	if err := a.ready(); err != nil {
		return err
	}
	return a.diagnostics.Start(port)
}
func (a *App) StopDiagnostics()                     { a.diagnostics.Stop() }
func (a *App) ClearDiagnostics()                    { a.diagnostics.Clear() }
func (a *App) GetDiagnostics() diagnostics.Snapshot { return a.diagnostics.Display() }
func (a *App) ExportDiagnostics() (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: a.tr("Export firmware logs"), DefaultFilename: "zmapflow-firmware-logs.txt", Filters: []runtime.FileFilter{{DisplayName: "Text", Pattern: "*.txt"}}})
	if err != nil || path == "" {
		return "", err
	}
	if err = os.WriteFile(path, []byte("App version: "+version.Version+"\n"+a.diagnostics.Export()), 0600); err != nil {
		return "", err
	}
	return path, nil
}
