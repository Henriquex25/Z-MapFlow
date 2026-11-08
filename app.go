package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"io"
	"os"
	"path/filepath"
	"sync"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/firmware"
	"z-mapflow/internal/flash"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
	"z-mapflow/internal/storage"
)

type App struct {
	ctx       context.Context
	projects  *project.Service
	builds    *firmware.Manager
	registry  *devices.Registry
	initErr   error
	mu        sync.Mutex
	operation sync.Mutex
}

func NewApp() *App { return &App{} }
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	root, err := storage.DataDir()
	if err != nil {
		a.initErr = err
		return
	}
	a.registry, err = devices.NewRegistry(soflev2.NewDevice())
	if err != nil {
		a.initErr = err
		return
	}
	a.projects = &project.Service{Root: root, Registry: a.registry}
	a.builds = &firmware.Manager{Root: root, Registry: a.registry}
	if err := a.builds.Restore(); err != nil {
		runtime.LogWarning(ctx, "Histórico de compilação indisponível: "+err.Error())
	}
}
func (a *App) shutdown(context.Context) {
	if a.builds != nil {
		a.builds.Close()
	}
}
func (a *App) ready() error {
	if a.initErr != nil {
		return a.initErr
	}
	if a.projects == nil {
		return fmt.Errorf("o aplicativo ainda não iniciou")
	}
	return nil
}
func (a *App) LoadProject() (models.Session, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := a.ready(); err != nil {
		return models.Session{}, err
	}
	return a.projects.Load()
}
func (a *App) ListPlugins() ([]models.Plugin, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.registry.List(), nil
}
func (a *App) NewProject(id string) (models.Session, error) {
	if err := a.ready(); err != nil {
		return models.Session{}, err
	}
	p, err := a.projects.New(id)
	if err != nil {
		return models.Session{}, err
	}
	d, _ := a.registry.Get(id)
	return models.Session{Project: p, Plugin: d.Descriptor()}, nil
}
func (a *App) SaveProject(p models.Project) (models.Project, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := a.ready(); err != nil {
		return p, err
	}
	return a.projects.Save(p)
}
func (a *App) StartBuild() (*firmware.Build, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := a.ready(); err != nil {
		return nil, err
	}
	session, err := a.projects.Load()
	if err != nil {
		return nil, err
	}
	return a.builds.Start(a.ctx, session.Project)
}

// SaveAndBuild holds the project lock so a different save cannot race the snapshot.
func (a *App) SaveAndBuild(p models.Project) (models.Project, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := a.ready(); err != nil {
		return p, err
	}
	if b := a.builds.Current(); b != nil && b.Status == "running" {
		return p, fmt.Errorf("aguarde ou cancele a compilação atual")
	}
	saved, err := a.projects.Save(p)
	if err != nil {
		return p, err
	}
	_, err = a.builds.Start(a.ctx, saved)
	return saved, err
}
func (a *App) GetBuildStatus() *firmware.Build {
	if a.builds == nil {
		return nil
	}
	return a.builds.Current()
}
func (a *App) CancelBuild() {
	if a.builds != nil {
		a.builds.Cancel()
	}
}
func (a *App) PreviewSources(p models.Project) ([]firmware.SourceFile, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return firmware.Generate(p, a.registry)
}
func (a *App) ImportProject() (models.Session, error) {
	if err := a.ready(); err != nil {
		return models.Session{}, err
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: "Importar projeto", Filters: []runtime.FileFilter{{DisplayName: "Projeto Z-MapFlow", Pattern: "*.json"}}})
	if err != nil || path == "" {
		return models.Session{}, err
	}
	f, err := os.Open(path)
	if err != nil {
		return models.Session{}, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 4*1024*1024))
	if err != nil {
		return models.Session{}, err
	}
	var p models.Project
	if err = json.Unmarshal(data, &p); err != nil {
		return models.Session{}, fmt.Errorf("arquivo de projeto inválido: %w", err)
	}
	if err = project.Validate(p, a.registry); err != nil {
		return models.Session{}, err
	}
	p.Revision = ""
	p.SavedAt = ""
	d, _ := a.registry.Get(p.PluginID)
	return models.Session{Project: p, Plugin: d.Descriptor()}, nil
}
func (a *App) ExportProject(p models.Project) (string, error) {
	if err := a.ready(); err != nil {
		return "", err
	}
	if err := project.Validate(p, a.registry); err != nil {
		return "", err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: "Exportar projeto", DefaultFilename: "z-mapflow.json", Filters: []runtime.FileFilter{{DisplayName: "Projeto Z-MapFlow", Pattern: "*.json"}}})
	if err != nil || path == "" {
		return "", err
	}
	return path, storage.AtomicJSON(path, p)
}
func (a *App) ExportFirmware(buildID string) (string, error) {
	if err := a.ready(); err != nil {
		return "", err
	}
	b, resultErr := a.builds.Result(buildID)
	if resultErr != nil || b.Status != "success" {
		return "", fmt.Errorf("nenhum firmware disponível")
	}
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Exportar firmware — selecione uma pasta"})
	if err != nil || dir == "" {
		return "", err
	}
	for _, artifact := range b.Artifacts {
		source, aFile, _, e := a.builds.ArtifactPath(buildID, artifact.TargetID)
		if e != nil {
			return "", e
		}
		data, e := os.ReadFile(source)
		if e != nil {
			return "", e
		}
		target := filepath.Join(dir, aFile.Name)
		if _, e = os.Lstat(target); e == nil {
			return "", fmt.Errorf("o arquivo %s já existe; escolha outra pasta", aFile.Name)
		}
		f, e := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
		if e != nil {
			return "", e
		}
		_, e = f.Write(data)
		closeErr := f.Close()
		if e != nil {
			return "", e
		}
		if closeErr != nil {
			return "", closeErr
		}
	}
	return dir, nil
}
func (a *App) buildVariant(buildID string) (models.Variant, error) {
	b, resultErr := a.builds.Result(buildID)
	if resultErr != nil || b.Status != "success" {
		return models.Variant{}, fmt.Errorf("nenhum build disponível para flash")
	}
	d, err := a.registry.Get(b.PluginID)
	if err != nil {
		return models.Variant{}, err
	}
	return project.Variant(models.Project{VariantID: b.VariantID}, d.Descriptor())
}
func (a *App) FindBootloaders(buildID string) ([]flash.Volume, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	v, err := a.buildVariant(buildID)
	if err != nil {
		return nil, err
	}
	return flash.Discover(v)
}
func (a *App) SelectBootloader(buildID string) (flash.Volume, error) {
	if err := a.ready(); err != nil {
		return flash.Volume{}, err
	}
	v, err := a.buildVariant(buildID)
	if err != nil {
		return flash.Volume{}, err
	}
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: "Selecione o volume de bootloader UF2"})
	if err != nil || path == "" {
		return flash.Volume{}, err
	}
	return flash.Inspect(path, v)
}
func (a *App) FlashFirmware(buildID, targetID, volumePath string) error {
	a.operation.Lock()
	defer a.operation.Unlock()
	if err := a.ready(); err != nil {
		return err
	}
	source, artifact, p, err := a.builds.ArtifactPath(buildID, targetID)
	if err != nil {
		return err
	}
	d, err := a.registry.Get(p.PluginID)
	if err != nil {
		return err
	}
	variant, err := project.Variant(p, d.Descriptor())
	if err != nil {
		return err
	}
	if err = firmware.ValidateUF2(source, variant.UF2Family); err != nil {
		return err
	}
	return flash.Copy(source, volumePath, artifact.Name, variant)
}

func (a *App) ListBuilds() ([]firmware.Build, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.builds.History(), nil
}
func (a *App) GetBuild(id string) (*firmware.Build, error) {
	if err := a.ready(); err != nil {
		return nil, err
	}
	return a.builds.Result(id)
}
