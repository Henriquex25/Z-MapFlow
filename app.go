package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"z-mapflow/internal/community"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/devices/lily58"
	"z-mapflow/internal/devices/silakka54"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/firmware"
	"z-mapflow/internal/flash"
	"z-mapflow/internal/i18n"
	"z-mapflow/internal/keymap"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
	"z-mapflow/internal/storage"
	"z-mapflow/internal/updates"
	"z-mapflow/internal/version"
)

type App struct {
	ctx          context.Context
	projects     *project.Service
	builds       *firmware.Manager
	registry     *devices.Registry
	initErr      error
	mu           sync.Mutex
	operation    sync.Mutex
	updater      *updates.Manager
	updating     atomic.Bool
	restartReady atomic.Bool
	uiLocale     atomic.Value
	community    *community.Service
	topologies   *flash.TopologyStore
}

func NewApp() *App { return &App{} }
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.updater = updates.New(version.Version)
	root, err := storage.DataDir()
	if err != nil {
		a.initErr = err
		return
	}
	a.registry, err = devices.NewRegistry(soflev2.NewDevice(), lily58.NewDevice(), silakka54.NewWirelessDevice(), silakka54.NewWiredDevice())
	if err != nil {
		a.initErr = err
		return
	}
	a.projects = &project.Service{Root: root, Registry: a.registry}
	a.topologies = &flash.TopologyStore{Root: root}
	a.community, err = community.Start(root)
	if err != nil {
		runtime.LogWarning(ctx, "Community invitations unavailable: "+err.Error())
	}
	a.builds = &firmware.Manager{Root: root, Registry: a.registry}
	if err := a.builds.Restore(); err != nil {
		runtime.LogWarning(ctx, "Histórico de compilação indisponível: "+err.Error())
	}
}

func (a *App) GetCommunityStatus() (community.Status, error) {
	if a.community == nil {
		return community.Status{}, fmt.Errorf("community preferences unavailable")
	}
	return a.community.Status(), nil
}

func (a *App) RecordCommunityMinute() (community.Status, error) {
	if a.community == nil {
		return community.Status{}, fmt.Errorf("community preferences unavailable")
	}
	return a.community.RecordMinute()
}

func (a *App) DismissCommunityPrompt(kind string) error {
	if a.community == nil {
		return fmt.Errorf("community preferences unavailable")
	}
	return a.community.Dismiss(kind)
}
func (a *App) shutdown(context.Context) {
	if a.builds != nil {
		a.builds.Close()
	}
}
func (a *App) ready() error {
	if a.updating.Load() {
		return fmt.Errorf("aguarde a conclusão da atualização")
	}
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
func (a *App) ImportProject(pluginID, variantID string) (models.Session, error) {
	if err := a.ready(); err != nil {
		return models.Session{}, err
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: a.tr("Import project or keymap"), Filters: []runtime.FileFilter{{DisplayName: a.tr("Projects and keymaps"), Pattern: "*.json;*.keymap"}, {DisplayName: a.tr("Z-MapFlow project"), Pattern: "*.json"}, {DisplayName: a.tr("Keymap ZMK"), Pattern: "*.keymap"}}})
	if err != nil || path == "" {
		return models.Session{}, err
	}
	f, err := os.Open(path)
	if err != nil {
		return models.Session{}, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 4*1024*1024+1))
	if err != nil {
		return models.Session{}, err
	}
	if len(data) > 4*1024*1024 {
		return models.Session{}, fmt.Errorf("o arquivo excede o limite de 4 MB")
	}
	var p models.Project
	if strings.EqualFold(filepath.Ext(path), ".keymap") {
		if pluginID == "" {
			plugins := a.registry.List()
			if len(plugins) != 1 {
				return models.Session{}, fmt.Errorf("selecione um teclado antes de importar o .keymap")
			}
			pluginID = plugins[0].ID
		}
		p, err = a.projects.New(pluginID)
		if err != nil {
			return models.Session{}, err
		}
		if variantID != "" {
			p.VariantID = variantID
		}
		p, err = keymap.ImportFile(path, p, a.registry)
		if err != nil {
			return models.Session{}, err
		}
	} else {
		if err = json.Unmarshal(data, &p); err != nil {
			return models.Session{}, fmt.Errorf("arquivo de projeto inválido: %w", err)
		}
	}
	p = project.Migrate(p)
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
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: a.tr("Export project"), DefaultFilename: "z-mapflow.json", Filters: []runtime.FileFilter{{DisplayName: a.tr("Z-MapFlow project"), Pattern: "*.json"}}})
	if err != nil || path == "" {
		return "", err
	}
	return path, storage.AtomicJSON(path, p)
}

func (a *App) ExportKeymap(p models.Project) (string, error) {
	if err := a.ready(); err != nil {
		return "", err
	}
	files, err := firmware.Generate(p, a.registry)
	if err != nil {
		return "", err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{Title: a.tr("Export ZMK keymap"), DefaultFilename: files[0].Name, Filters: []runtime.FileFilter{{DisplayName: a.tr("Keymap ZMK"), Pattern: "*.keymap"}}})
	if err != nil || path == "" {
		return "", err
	}
	if !strings.EqualFold(filepath.Ext(path), ".keymap") {
		path += ".keymap"
	}
	bundle := firmware.KeymapBundle(path, files)
	conflicts, err := firmware.BundleConflicts(path, bundle)
	if err != nil {
		return "", err
	}
	if len(conflicts) > 0 {
		answer, e := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{Type: runtime.QuestionDialog, Title: a.tr("Replace export files?"), Message: a.tr("The keymap includes .conf, build.yaml and required headers. These files already exist with different contents:\n") + strings.Join(conflicts, "\n"), Buttons: []string{a.tr("Replace files"), a.tr("Cancel")}, DefaultButton: a.tr("Cancel"), CancelButton: a.tr("Cancel")})
		if e != nil {
			return "", e
		}
		if answer != a.tr("Replace files") {
			return "", nil
		}
	}
	return path, firmware.WriteKeymapBundle(path, bundle, true)
}
func (a *App) ExportFirmware(buildID string) (string, error) {
	if err := a.ready(); err != nil {
		return "", err
	}
	b, resultErr := a.builds.Result(buildID)
	if resultErr != nil || b.Status != "success" {
		return "", fmt.Errorf("nenhum firmware disponível")
	}
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: a.tr("Export firmware — select a folder")})
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
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: a.tr("Select the UF2 bootloader volume")})
	if err != nil || path == "" {
		return flash.Volume{}, err
	}
	return flash.Inspect(path, v)
}
func (a *App) FlashFirmware(buildID, targetID, volumePath string) (flash.Result, error) {
	return a.flashDevice(buildID, targetID, volumePath, false, false)
}

func (a *App) flashSetup(buildID string) (flash.Setup, error) {
	if err := a.ready(); err != nil {
		return flash.Setup{}, err
	}
	b, err := a.builds.Result(buildID)
	if err != nil || b.Status != "success" {
		return flash.Setup{}, fmt.Errorf("nenhum build disponível para flash")
	}
	d, err := a.registry.Get(b.PluginID)
	if err != nil {
		return flash.Setup{}, err
	}
	v, err := project.Variant(models.Project{VariantID: b.VariantID}, d.Descriptor())
	if err != nil {
		return flash.Setup{}, err
	}
	resetAvailable := false
	for _, t := range v.Targets {
		if t.Kind == "settings-reset" {
			for _, artifact := range b.Artifacts {
				if artifact.TargetID == t.ID {
					resetAvailable = true
				}
			}
		}
	}
	return flash.Setup{Plugin: d.Descriptor(), Variant: v, BuildID: buildID, ResetAvailable: resetAvailable}, nil
}
func (a *App) GetFlashPlan(buildID string) (flash.FlashPlan, error) {
	ctx, err := a.flashSetup(buildID)
	if err != nil {
		return flash.FlashPlan{}, err
	}
	return a.topologies.Plan(ctx)
}
func (a *App) SetInstalledTopology(buildID, variantID string) (flash.FlashPlan, error) {
	if !a.operation.TryLock() {
		return flash.FlashPlan{}, fmt.Errorf("aguarde a conclusão do envio de firmware em andamento")
	}
	defer a.operation.Unlock()
	ctx, err := a.flashSetup(buildID)
	if err != nil {
		return flash.FlashPlan{}, err
	}
	return a.topologies.Declare(ctx, variantID)
}
func (a *App) ReportExternalFlash(buildID string) (flash.FlashPlan, error) {
	if !a.operation.TryLock() {
		return flash.FlashPlan{}, fmt.Errorf("aguarde a conclusão do envio de firmware em andamento")
	}
	defer a.operation.Unlock()
	ctx, err := a.flashSetup(buildID)
	if err != nil {
		return flash.FlashPlan{}, err
	}
	return a.topologies.Forget(ctx)
}
func (a *App) AcknowledgeFlash(buildID, receiptID string) (flash.FlashPlan, error) {
	if !a.operation.TryLock() {
		return flash.FlashPlan{}, fmt.Errorf("aguarde a conclusão do envio de firmware em andamento")
	}
	defer a.operation.Unlock()
	ctx, err := a.flashSetup(buildID)
	if err != nil {
		return flash.FlashPlan{}, err
	}
	return a.topologies.Acknowledge(ctx, receiptID)
}
func (a *App) FlashDevice(buildID, deviceID, volumePath string, reset bool) (flash.Result, error) {
	return a.flashDevice(buildID, deviceID, volumePath, reset, true)
}
func (a *App) flashDevice(buildID, deviceID, volumePath string, reset, guided bool) (flash.Result, error) {
	if !a.operation.TryLock() {
		return flash.Result{}, fmt.Errorf("aguarde a conclusão do envio de firmware em andamento")
	}
	defer a.operation.Unlock()
	if err := a.ready(); err != nil {
		return flash.Result{}, err
	}
	ctx, err := a.flashSetup(buildID)
	if err != nil {
		return flash.Result{}, err
	}
	targetID := deviceID
	if reset {
		targetID = ""
		for _, t := range ctx.Variant.Targets {
			if t.Kind == "settings-reset" {
				targetID = t.ID
			}
		}
	} else if !guided {
		for _, t := range ctx.Variant.Targets {
			if t.ID == deviceID && t.Kind == "settings-reset" {
				plan, err := a.topologies.Plan(ctx)
				if err != nil {
					return flash.Result{}, err
				}
				if plan.Supported {
					return flash.Result{}, fmt.Errorf("use the guided reset flow and select the physical device")
				}
			}
		}
	}
	source, artifact, p, err := a.builds.ArtifactPath(buildID, targetID)
	if err != nil {
		return flash.Result{}, err
	}
	if p.PluginID != ctx.Plugin.ID || p.VariantID != ctx.Variant.ID {
		return flash.Result{}, fmt.Errorf("the saved build configuration does not match its flash plan")
	}
	d, err := a.registry.Get(p.PluginID)
	if err != nil {
		return flash.Result{}, err
	}
	variant, err := project.Variant(p, d.Descriptor())
	if err != nil {
		return flash.Result{}, err
	}
	if err = firmware.ValidateUF2(source, variant.UF2Family); err != nil {
		return flash.Result{}, err
	}
	receipt, err := a.topologies.Begin(ctx, deviceID, reset)
	if err != nil {
		return flash.Result{}, err
	}
	trace := map[string]interface{}{"buildId": buildID, "targetId": targetID, "deviceId": deviceID, "reset": reset, "volume": volumePath, "startedAt": time.Now().UTC().Format(time.RFC3339Nano)}
	tracePath := filepath.Join(a.projects.Root, "flash", "latest.json")
	lastStage := ""
	writeTrace := func() {
		trace["updatedAt"] = time.Now().UTC().Format(time.RFC3339Nano)
		if err := storage.AtomicJSON(tracePath, trace); err != nil {
			runtime.LogWarning(a.ctx, "Could not save flash diagnostics: "+err.Error())
		}
	}
	result, err := flash.Copy(source, volumePath, artifact.Name, variant, func(progress flash.Progress) {
		trace["progress"] = progress
		if progress.Stage != lastStage {
			writeTrace()
			lastStage = progress.Stage
		}
		runtime.EventsEmit(a.ctx, "firmware:flash", map[string]interface{}{
			"buildId": buildID, "targetId": targetID, "stage": progress.Stage,
			"written": progress.Written, "total": progress.Total,
		})
	})
	if saveErr := a.topologies.Finish(ctx, receipt, result, err); saveErr != nil {
		err = fmt.Errorf("the USB write was attempted but its workflow could not be saved: %w", saveErr)
	}
	result.ReceiptID = receipt
	trace["status"], trace["detail"] = result.Status, result.Detail
	if err != nil {
		trace["status"], trace["detail"] = "failed", err.Error()
	}
	trace["finishedAt"] = time.Now().UTC().Format(time.RFC3339Nano)
	writeTrace()
	return result, err
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

// ImportHeaders bundles a language header and its local dependencies.
func (a *App) ImportHeaders() (models.HeaderBundle, error) {
	if err := a.ready(); err != nil {
		return models.HeaderBundle{}, err
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{Title: a.tr("Add language header"), Filters: []runtime.FileFilter{{DisplayName: a.tr("ZMK headers"), Pattern: "*.h"}}})
	if err != nil || path == "" {
		return models.HeaderBundle{}, err
	}
	files, err := keymap.LoadHeaders(filepath.Dir(path), "#include "+fmt.Sprintf("%q", filepath.Base(path)))
	return models.HeaderBundle{Name: filepath.Base(path), Files: files}, err
}

// CheckForUpdates always uses the fixed official public repository.
func (a *App) CheckForUpdates() (updates.Info, error) {
	if a.updater == nil {
		return updates.Info{}, fmt.Errorf("o aplicativo ainda não iniciou")
	}
	return a.updater.Check(a.ctx)
}
func (a *App) GetUpdateProgress() updates.Progress {
	if a.updater == nil {
		return updates.Progress{}
	}
	return a.updater.Status()
}
func (a *App) InstallUpdate(expectedVersion string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := a.ready(); err != nil {
		return err
	}
	if !a.operation.TryLock() {
		return fmt.Errorf("aguarde o envio do firmware antes de atualizar")
	}
	defer a.operation.Unlock()
	if b := a.builds.Current(); b != nil && b.Status == "running" {
		return fmt.Errorf("aguarde ou cancele a compilação antes de atualizar")
	}
	a.updating.Store(true)
	err := a.updater.Install(a.ctx, expectedVersion, func(exe string) error {
		cmd := exec.Command(exe, "--wait-for-parent", strconv.Itoa(os.Getpid()))
		if err := cmd.Start(); err != nil {
			return err
		}
		go cmd.Wait()
		return nil
	})
	if err != nil {
		a.updating.Store(false)
		return err
	}
	a.restartReady.Store(true)
	runtime.Quit(a.ctx)
	return nil
}

func (a *App) beforeClose(context.Context) bool { return a.updating.Load() && !a.restartReady.Load() }

// GetAppInfo is available even when project loading or the network fails.
func (a *App) GetAppInfo() version.Info { return version.Current() }

func (a *App) SleepTimeoutMilliseconds(minutes float64) (int, error) {
	return project.SleepTimeoutMilliseconds(minutes)
}

func (a *App) SetAppLanguage(locale string) error {
	if locale != "en" && locale != "pt-BR" {
		return fmt.Errorf("unsupported application language")
	}
	a.uiLocale.Store(locale)
	return nil
}
func (a *App) tr(message string) string {
	locale, _ := a.uiLocale.Load().(string)
	return i18n.Message(locale, message)
}
