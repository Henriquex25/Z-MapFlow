package firmware

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"z-mapflow/internal/devices"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
	"z-mapflow/internal/storage"
)

type Artifact struct {
	TargetID string `json:"targetId"`
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	SHA256   string `json:"sha256"`
}
type Build struct {
	ID         string     `json:"id"`
	Revision   string     `json:"revision"`
	PluginID   string     `json:"pluginId"`
	VariantID  string     `json:"variantId"`
	Status     string     `json:"status"`
	Stage      string     `json:"stage"`
	StartedAt  string     `json:"startedAt"`
	FinishedAt string     `json:"finishedAt"`
	Error      string     `json:"error"`
	Logs       []string   `json:"logs"`
	Artifacts  []Artifact `json:"artifacts"`
}

// Provider allows a future GitHub Actions implementation without changing the editor.
type Provider interface {
	Run(context.Context, string, models.Project, models.Plugin, func(string)) error
}
type DockerProvider struct{}

func (DockerProvider) Run(ctx context.Context, dir string, p models.Project, plugin models.Plugin, log func(string)) error {
	preflight, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	if out, err := exec.CommandContext(preflight, "docker", "info", "--format", "{{.ServerVersion}}").CombinedOutput(); err != nil {
		return fmt.Errorf("Docker indisponível. Inicie o Docker e confira o acesso do seu usuário: %s (%w)", strings.TrimSpace(string(out)), err)
	}
	variant, _ := project.Variant(p, plugin)
	// Every argument is shell-quoted; keymap and headers remain data files.
	var script strings.Builder
	script.WriteString("set -eu\necho ZMAPFLOW_STAGE:cache\nexec 9>/workspace/.zmapflow.lock\nflock -x 9\nrm -rf /workspace/config\nmkdir -p /workspace/config /output\ncp -R /input/. /workspace/config/\ncd /workspace\nif [ ! -d .west ]; then west init -l config; fi\nif [ ! -f .dependencies-ready ]; then\n echo ZMAPFLOW_STAGE:dependencies\n west update --fetch-opt=--filter=tree:0\n touch .dependencies-ready\nfi\nwest zephyr-export\n")
	for _, target := range variant.Targets {
		for _, s := range []string{variant.ID, target.ID, target.Board, target.Shield, target.Artifact} {
			if strings.ContainsAny(s, "'\n\r") {
				return fmt.Errorf("alvo inválido no plugin")
			}
		}
		fmt.Fprintf(&script, "echo ZMAPFLOW_STAGE:%s\n%s\ncp %s %s\n", target.ID, TargetBuildCommand(p, variant, target), shellQuote("build/"+variant.ID+"/"+target.ID+"/zephyr/zmk.uf2"), shellQuote("/output/"+target.Artifact))
	}
	cacheIdentity := plugin.ID + plugin.Version + plugin.ZMKRevision + plugin.BuildImage
	if len(plugin.Modules) > 0 {
		moduleData, _ := json.Marshal(plugin.Modules)
		cacheIdentity += string(moduleData)
	}
	sum := sha256.Sum256([]byte(cacheIdentity))
	cache := "zmapflow-" + hex.EncodeToString(sum[:])[:16]
	name := "zmapflow-" + filepath.Base(dir)
	// Copy through the Docker API: Docker Desktop and remote daemons cannot
	// necessarily bind-mount host paths (especially /tmp and Windows paths).
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_ = exec.CommandContext(cleanup, "docker", "rm", "-f", name).Run()
	}()
	log("Preparando container temporário e cache do ZMK…")
	create := exec.CommandContext(ctx, "docker", "create", "--name", name, "--mount", "type=volume,src="+cache+",dst=/workspace", "-w", "/workspace", plugin.BuildImage, "sh", "-c", script.String())
	if err := stream(create, log); err != nil {
		return fmt.Errorf("não foi possível criar o container: %w", err)
	}
	if out, err := exec.CommandContext(ctx, "docker", "cp", filepath.Join(dir, "config")+string(os.PathSeparator)+".", name+":/input").CombinedOutput(); err != nil {
		return fmt.Errorf("falha ao enviar configuração ao container: %s (%w)", out, err)
	}
	cmd := exec.CommandContext(ctx, "docker", "start", "-a", name)

	// Killing the Docker CLI alone leaves a daemon-owned container alive.
	cmd.Cancel = func() error {
		cleanup, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = exec.CommandContext(cleanup, "docker", "stop", "-t", "2", name).Run()
		return cmd.Process.Kill()
	}
	cmd.WaitDelay = 15 * time.Second
	if err := stream(cmd, log); err != nil {
		return err
	}
	exitCode, err := exec.CommandContext(ctx, "docker", "inspect", "--format", "{{.State.ExitCode}}", name).Output()
	if err != nil {
		return err
	}
	if strings.TrimSpace(string(exitCode)) != "0" {
		return fmt.Errorf("o compilador encerrou com código %s; veja os logs", strings.TrimSpace(string(exitCode)))
	}
	if out, err := exec.CommandContext(ctx, "docker", "cp", name+":/output/.", filepath.Join(dir, "artifacts")).CombinedOutput(); err != nil {
		return fmt.Errorf("falha ao recuperar firmware: %s (%w)", out, err)
	}
	return nil
}
func stream(cmd *exec.Cmd, log func(string)) error {
	reader, writer := io.Pipe()
	cmd.Stdout = writer
	cmd.Stderr = writer
	if err := cmd.Start(); err != nil {
		reader.Close()
		writer.Close()
		return err
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		scanner := bufio.NewScanner(reader)
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		for scanner.Scan() {
			log(scanner.Text())
		}
		if err := scanner.Err(); err != nil {
			log("Falha na leitura de logs: " + err.Error())
			_ = reader.CloseWithError(err)
		}
	}()
	err := cmd.Wait()
	writer.Close()
	<-done
	reader.Close()
	return err
}

type Manager struct {
	Root     string
	Registry *devices.Registry
	Provider Provider
	mu       sync.Mutex
	build    *Build
	cancel   context.CancelFunc
	done     chan struct{}
}

func (m *Manager) jobDir(id string) string { return filepath.Join(m.Root, "builds", id) }
func clone(b *Build) *Build {
	if b == nil {
		return nil
	}
	c := *b
	c.Logs = append([]string{}, b.Logs...)
	c.Artifacts = append([]Artifact{}, b.Artifacts...)
	return &c
}
func (m *Manager) Current() *Build { m.mu.Lock(); defer m.mu.Unlock(); return clone(m.build) }
func (m *Manager) Restore() error {
	data, err := os.ReadFile(filepath.Join(m.Root, "last-build.json"))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	var b Build
	if err = json.Unmarshal(data, &b); err != nil {
		return err
	}
	if b.Status == "running" {
		b.Status = "failed"
		b.Stage = "interrupted"
		b.Error = "A compilação foi interrompida ao fechar o aplicativo. Compile novamente."
	}
	if b.ID == "" || filepath.Base(b.ID) != b.ID {
		return fmt.Errorf("identidade de build inválida")
	}
	m.mu.Lock()
	m.build = &b
	m.mu.Unlock()
	return nil
}
func (m *Manager) Start(parent context.Context, p models.Project) (*Build, error) {
	if p.Revision == "" {
		return nil, fmt.Errorf("salve a configuração antes de compilar")
	}
	data, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	var snapshot models.Project
	if err = json.Unmarshal(data, &snapshot); err != nil {
		return nil, err
	}
	p = snapshot
	files, err := Generate(p, m.Registry)
	if err != nil {
		return nil, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.build != nil && m.build.Status == "running" {
		return nil, fmt.Errorf("já existe uma compilação em andamento")
	}
	id := fmt.Sprintf("%d", time.Now().UnixNano())
	dir := m.jobDir(id)
	for _, sub := range []string{"config", "artifacts"} {
		if err = os.MkdirAll(filepath.Join(dir, sub), 0700); err != nil {
			return nil, err
		}
	}
	for _, f := range files {
		if !storage.SafeRelative(f.Name) {
			return nil, fmt.Errorf("nome de arquivo inválido no plugin")
		}
		filePath := filepath.Join(dir, "config", filepath.FromSlash(f.Name))
		if err = os.MkdirAll(filepath.Dir(filePath), 0700); err != nil {
			return nil, err
		}
		if err = os.WriteFile(filePath, []byte(f.Content), 0600); err != nil {
			return nil, err
		}
	}
	if err = storage.AtomicJSON(filepath.Join(dir, "project.json"), p); err != nil {
		return nil, err
	}
	b := &Build{ID: id, Revision: p.Revision, PluginID: p.PluginID, VariantID: p.VariantID, Status: "running", Stage: "preparing", StartedAt: time.Now().UTC().Format(time.RFC3339), Logs: []string{}, Artifacts: []Artifact{}}
	if err = storage.AtomicJSON(filepath.Join(m.Root, "last-build.json"), b); err != nil {
		return nil, err
	}
	m.build = b
	ctx, cancel := context.WithTimeout(parent, 45*time.Minute)
	m.cancel = cancel
	d, _ := m.Registry.Get(p.PluginID)
	provider := m.Provider
	if provider == nil {
		provider = DockerProvider{}
	}
	done := make(chan struct{})
	m.done = done
	go func() { defer close(done); m.run(ctx, cancel, provider, p, BuildProfile(p, d.Descriptor()), id, dir) }()
	return clone(b), nil
}
func (m *Manager) run(ctx context.Context, cancel context.CancelFunc, provider Provider, p models.Project, plugin models.Plugin, id, dir string) {
	defer cancel()
	logFile, _ := os.OpenFile(filepath.Join(dir, "build.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if logFile != nil {
		defer logFile.Close()
	}
	var logMu sync.Mutex
	log := func(line string) {
		logMu.Lock()
		defer logMu.Unlock()
		if logFile != nil {
			fmt.Fprintln(logFile, line)
		}
		m.mu.Lock()
		defer m.mu.Unlock()
		m.build.Logs = append(m.build.Logs, line)
		if len(m.build.Logs) > 1500 {
			m.build.Logs = m.build.Logs[len(m.build.Logs)-1500:]
		}
		if strings.HasPrefix(line, "ZMAPFLOW_STAGE:") {
			m.build.Stage = strings.TrimPrefix(line, "ZMAPFLOW_STAGE:")
		}
	}
	err := provider.Run(ctx, dir, p, plugin, log)
	var artifacts []Artifact
	if err == nil {
		variant, _ := project.Variant(p, plugin)
		for _, target := range variant.Targets {
			path := filepath.Join(dir, "artifacts", target.Artifact)
			info, e := os.Stat(path)
			if e != nil || !info.Mode().IsRegular() {
				err = fmt.Errorf("firmware não gerado para %s", target.Name)
				break
			}
			sum, e := HashFile(path)
			if e != nil {
				err = e
				break
			}
			if e = ValidateUF2(path, variant.UF2Family); e != nil {
				err = fmt.Errorf("firmware %s: %w", target.Name, e)
				break
			}
			artifacts = append(artifacts, Artifact{TargetID: target.ID, Name: target.Artifact, Size: info.Size(), SHA256: sum})
		}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	b := m.build
	b.FinishedAt = time.Now().UTC().Format(time.RFC3339)
	b.Stage = "finished"
	b.Status = "success"
	b.Artifacts = artifacts
	if err != nil {
		b.Status = "failed"
		b.Error = err.Error()
		b.Artifacts = []Artifact{}
		if ctx.Err() != nil {
			b.Status = "cancelled"
			b.Error = "Compilação cancelada ou tempo limite excedido."
		}
	}
	if e := storage.AtomicJSON(filepath.Join(dir, "result.json"), b); e != nil {
		b.Error += " Não foi possível salvar o resultado: " + e.Error()
	}
	if e := storage.AtomicJSON(filepath.Join(m.Root, "last-build.json"), b); e != nil {
		b.Error += " Não foi possível salvar o histórico: " + e.Error()
	}
	m.cancel = nil
}
func (m *Manager) Cancel() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cancel != nil {
		m.cancel()
	}
}
func (m *Manager) ArtifactPath(buildID, targetID string) (string, Artifact, models.Project, error) {
	var p models.Project
	var empty Artifact
	b, err := m.Result(buildID)
	if err != nil || b.Status != "success" {
		return "", empty, p, fmt.Errorf("selecione uma compilação concluída com sucesso")
	}
	data, err := os.ReadFile(filepath.Join(m.jobDir(b.ID), "project.json"))
	if err != nil {
		return "", empty, p, err
	}
	if err = json.Unmarshal(data, &p); err != nil {
		return "", empty, p, err
	}
	for _, a := range b.Artifacts {
		if a.TargetID == targetID {
			if filepath.Base(a.Name) != a.Name {
				return "", empty, p, fmt.Errorf("nome de artefato inválido")
			}
			path := filepath.Join(m.jobDir(b.ID), "artifacts", a.Name)
			sum, e := HashFile(path)
			if e != nil || sum != a.SHA256 {
				return "", empty, p, fmt.Errorf("artefato ausente ou alterado; compile novamente")
			}
			return path, a, p, nil
		}
	}
	return "", empty, p, fmt.Errorf("artefato não encontrado")
}

func HashFile(path string) (string, error) {
	f, e := os.Open(path)
	if e != nil {
		return "", e
	}
	defer f.Close()
	h := sha256.New()
	if _, e = io.Copy(h, f); e != nil {
		return "", e
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func (m *Manager) Result(id string) (*Build, error) {
	if id == "" || strings.ContainsAny(id, `/\`) || strings.Trim(id, "0123456789") != "" {
		return nil, fmt.Errorf("identidade de compilação inválida")
	}
	if b := m.Current(); b != nil && b.ID == id {
		return b, nil
	}
	data, err := os.ReadFile(filepath.Join(m.jobDir(id), "result.json"))
	if err != nil {
		return nil, err
	}
	var b Build
	if err = json.Unmarshal(data, &b); err != nil {
		return nil, err
	}
	if b.ID != id {
		return nil, fmt.Errorf("resultado incompatível")
	}
	return &b, nil
}
func (m *Manager) History() []Build {
	results := []Build{}
	entries, _ := os.ReadDir(filepath.Join(m.Root, "builds"))
	for i := len(entries) - 1; i >= 0 && len(results) < 30; i-- {
		if !entries[i].IsDir() {
			continue
		}
		if b, e := m.Result(entries[i].Name()); e == nil {
			b.Logs = []string{}
			results = append(results, *b)
		}
	}
	return results
}

func (m *Manager) Close() {
	m.mu.Lock()
	cancel, done := m.cancel, m.done
	m.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	if done != nil {
		select {
		case <-done:
		case <-time.After(20 * time.Second):
		}
	}
}
