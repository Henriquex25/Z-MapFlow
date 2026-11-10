// Package updates checks public GitHub releases and installs verified Linux binaries.
package updates

import (
	"bufio"
	"context"
	"crypto/sha256"
	"debug/elf"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

const Repository = "Henriquex25/Z-MapFlow"
const ReleasesURL = "https://github.com/" + Repository + "/releases"
const maxBinary = 256 << 20

var stableVersion = regexp.MustCompile(`^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$`)

type Info struct {
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	Available      bool   `json:"available"`
	Supported      bool   `json:"supported"`
	ReleaseURL     string `json:"releaseUrl"`
	Notes          string `json:"notes"`
	Message        string `json:"message"`
}
type Progress struct {
	Stage      string `json:"stage"`
	Downloaded int64  `json:"downloaded"`
	Total      int64  `json:"total"`
}
type asset struct {
	Name   string `json:"name"`
	URL    string `json:"browser_download_url"`
	Size   int64  `json:"size"`
	Digest string `json:"digest"`
}
type release struct {
	Tag        string  `json:"tag_name"`
	Draft      bool    `json:"draft"`
	Prerelease bool    `json:"prerelease"`
	Body       string  `json:"body"`
	Assets     []asset `json:"assets"`
}
type Manager struct {
	op             sync.Mutex
	mu             sync.Mutex
	progress       Progress
	client         *http.Client
	endpoint       string
	version        string
	goos, arch     string
	executable     func() (string, error)
	validateBinary func(context.Context, string, string) error
	allowLocal     bool // Only in same-package tests; never enabled by application configuration.
}

func New(version string) *Manager {
	return &Manager{version: version, goos: runtime.GOOS, arch: runtime.GOARCH, executable: os.Executable, validateBinary: validateExecutable,
		endpoint: "https://api.github.com/repos/" + Repository + "/releases/latest",
		client: &http.Client{Timeout: 5 * time.Minute, CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 || req.URL.Scheme != "https" {
				return errors.New("redirecionamento de download inválido")
			}
			return nil
		}}}
}
func (m *Manager) Status() Progress { m.mu.Lock(); defer m.mu.Unlock(); return m.progress }
func (m *Manager) progressTo(stage string, n, total int64) {
	m.mu.Lock()
	m.progress = Progress{stage, n, total}
	m.mu.Unlock()
}
func (m *Manager) request(ctx context.Context, target string) (*http.Response, error) {
	req, e := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if e != nil {
		return nil, e
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "Z-MapFlow/"+m.version)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	return m.client.Do(req)
}
func (m *Manager) latest(ctx context.Context) (release, error) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	resp, e := m.request(ctx, m.endpoint)
	if e != nil {
		return release{}, fmt.Errorf("não foi possível consultar atualizações: %w", e)
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return release{}, nil
	}
	if resp.StatusCode != 200 {
		return release{}, fmt.Errorf("GitHub respondeu %d ao consultar atualizações", resp.StatusCode)
	}
	data, e := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if e != nil {
		return release{}, e
	}
	var r release
	if e = json.Unmarshal(data, &r); e != nil {
		return release{}, fmt.Errorf("resposta de atualização inválida: %w", e)
	}
	if r.Draft || r.Prerelease || !stableVersion.MatchString(r.Tag) {
		return release{}, nil
	}
	return r, nil
}
func newer(candidate, current string) bool {
	a, b := stableVersion.FindStringSubmatch(candidate), stableVersion.FindStringSubmatch(current)
	if a == nil {
		return false
	}
	if current == "dev" {
		return true
	}
	if b == nil {
		return false
	}
	for i := 1; i <= 3; i++ {
		av, e1 := strconv.ParseUint(a[i], 10, 64)
		bv, e2 := strconv.ParseUint(b[i], 10, 64)
		if e1 != nil || e2 != nil {
			return false
		}
		if av != bv {
			return av > bv
		}
	}
	return false
}
func (m *Manager) assets(r release) (asset, asset) {
	name := "z-mapflow_" + m.goos + "_" + m.arch
	var binary, sum asset
	for _, a := range r.Assets {
		if a.Name == name {
			binary = a
		}
		if a.Name == "checksums.txt" {
			sum = a
		}
	}
	return binary, sum
}
func (m *Manager) info(r release) Info {
	result := Info{CurrentVersion: m.version, Supported: m.goos == "linux", ReleaseURL: ReleasesURL}
	if r.Tag == "" {
		result.Message = "Nenhuma versão pública estável disponível."
		return result
	}
	result.LatestVersion = strings.TrimPrefix(r.Tag, "v")
	result.Notes = r.Body
	result.ReleaseURL = ReleasesURL + "/tag/" + url.PathEscape(r.Tag)
	result.Available = newer(r.Tag, m.version)
	binary, sum := m.assets(r)
	if binary.Name == "" || sum.Name == "" {
		result.Supported = false
		result.Message = "Esta versão não oferece atualização para seu sistema e arquitetura."
	}
	if !result.Available {
		result.Message = "Você está usando a versão mais recente."
	}
	return result
}
func (m *Manager) Check(ctx context.Context) (Info, error) {
	m.op.Lock()
	defer m.op.Unlock()
	r, e := m.latest(ctx)
	if e != nil {
		return Info{CurrentVersion: m.version, ReleaseURL: ReleasesURL}, e
	}
	return m.info(r), nil
}
func (m *Manager) trusted(a asset, tag string) bool {
	u, e := url.Parse(a.URL)
	if e != nil {
		return false
	}
	if m.allowLocal {
		endpoint, e := url.Parse(m.endpoint)
		return e == nil && u.Scheme == "http" && u.Host == endpoint.Host
	}
	return u.Scheme == "https" && u.Host == "github.com" && u.User == nil && u.RawQuery == "" && u.Fragment == "" && u.Path == "/"+Repository+"/releases/download/"+tag+"/"+a.Name
}
func (m *Manager) checksum(ctx context.Context, a asset, tag, name string) ([]byte, error) {
	if !m.trusted(a, tag) {
		return nil, errors.New("origem dos checksums inválida")
	}
	resp, e := m.request(ctx, a.URL)
	if e != nil {
		return nil, e
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("download dos checksums: HTTP %d", resp.StatusCode)
	}
	data, e := io.ReadAll(io.LimitReader(resp.Body, (64<<10)+1))
	if e != nil {
		return nil, e
	}
	if len(data) > 64<<10 {
		return nil, errors.New("arquivo de checksums excede o limite")
	}
	var found []byte
	scanner := bufio.NewScanner(strings.NewReader(string(data)))
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) != 2 || strings.TrimPrefix(fields[1], "*") != name {
			continue
		}
		sum, e := hex.DecodeString(fields[0])
		if e != nil || len(sum) != sha256.Size || found != nil {
			return nil, errors.New("checksum inválido ou duplicado")
		}
		found = sum
	}
	if e = scanner.Err(); e != nil {
		return nil, e
	}
	if found == nil {
		return nil, errors.New("checksum da atualização não encontrado")
	}
	return found, nil
}

type progressWriter struct {
	m        *Manager
	n, total int64
}

func (w *progressWriter) Write(p []byte) (int, error) {
	w.n += int64(len(p))
	w.m.progressTo("downloading", w.n, w.total)
	return len(p), nil
}

// Install rechecks the selected release and never accepts download URLs from the UI.
// restart must launch the replacement successfully before returning. Failure rolls back.
func (m *Manager) Install(ctx context.Context, expected string, restart func(string) error) (err error) {
	m.op.Lock()
	defer m.op.Unlock()
	m.progressTo("checking", 0, 0)
	defer func() {
		if err != nil {
			m.progressTo("error", 0, 0)
		}
	}()
	r, err := m.latest(ctx)
	if err != nil {
		return err
	}
	info := m.info(r)
	if !info.Available || !info.Supported || info.LatestVersion != expected {
		return errors.New("a versão selecionada não está mais disponível para atualização; consulte novamente")
	}
	binary, sum := m.assets(r)
	if !m.trusted(binary, r.Tag) || binary.Size <= 0 || binary.Size > maxBinary {
		return errors.New("arquivo de atualização inválido")
	}
	hash, err := m.checksum(ctx, sum, r.Tag, binary.Name)
	if err != nil {
		return err
	}
	if binary.Digest != "" && binary.Digest != "sha256:"+hex.EncodeToString(hash) {
		return errors.New("checksum não corresponde ao digest publicado pelo GitHub")
	}
	target, err := m.executable()
	if err != nil {
		return err
	}
	target, err = filepath.EvalSymlinks(target)
	if err != nil {
		return err
	}
	// Stage beside the target, checking write access before any large download.
	stage, err := os.CreateTemp(filepath.Dir(target), ".z-mapflow-update-*")
	if err != nil {
		return fmt.Errorf("sem permissão para atualizar; reinstale na pasta do usuário: %w", err)
	}
	staged := stage.Name()
	defer os.Remove(staged)
	defer stage.Close()
	resp, err := m.request(ctx, binary.URL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("download da atualização: HTTP %d", resp.StatusCode)
	}
	digest := sha256.New()
	progress := &progressWriter{m: m, total: binary.Size}
	n, err := io.Copy(io.MultiWriter(stage, digest, progress), io.LimitReader(resp.Body, binary.Size+1))
	if err != nil {
		return err
	}
	m.progressTo("verifying", n, binary.Size)
	if n != binary.Size || !strings.EqualFold(hex.EncodeToString(digest.Sum(nil)), hex.EncodeToString(hash)) {
		return errors.New("a integridade da atualização não foi confirmada; tente novamente")
	}
	if err = stage.Chmod(0755); err != nil {
		return err
	}
	if err = stage.Sync(); err != nil {
		return err
	}
	if err = stage.Close(); err != nil {
		return err
	}
	if err = m.validateBinary(ctx, staged, info.LatestVersion); err != nil {
		return err
	}
	m.progressTo("installing", n, binary.Size)
	backup := target + ".previous"
	if err = backupExecutable(target, backup); err != nil {
		return err
	}
	rollback := func(cause error) error {
		if e := os.Rename(backup, target); e != nil {
			return fmt.Errorf("%v; restaure o executável de %s: %w", cause, backup, e)
		}
		return cause
	}
	if err = os.Rename(staged, target); err != nil {
		return err // The original executable is still at target.
	}
	if err = restart(target); err != nil {
		return rollback(fmt.Errorf("não foi possível reiniciar: %w", err))
	}
	m.progressTo("restarting", n, binary.Size)
	return nil
}

// Keep a complete backup, then replace target atomically: there is never a gap
// during which the application's executable path is missing.
func backupExecutable(target, backup string) error {
	source, err := os.Open(target)
	if err != nil {
		return err
	}
	defer source.Close()
	stat, err := source.Stat()
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(target), ".z-mapflow-backup-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	defer file.Close()
	if _, err = io.Copy(file, source); err != nil {
		return err
	}
	if err = file.Chmod(stat.Mode().Perm()); err != nil {
		return err
	}
	if err = file.Sync(); err != nil {
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), backup)
}

func validateELF(filename string) error {
	f, e := elf.Open(filename)
	if e != nil {
		return fmt.Errorf("o download não é um executável Linux válido: %w", e)
	}
	defer f.Close()
	want := map[string]elf.Machine{"amd64": elf.EM_X86_64, "arm64": elf.EM_AARCH64}[runtime.GOARCH]
	if f.Machine != want || (f.Type != elf.ET_EXEC && f.Type != elf.ET_DYN) {
		return errors.New("o executável não corresponde à arquitetura deste aplicativo")
	}
	return nil
}

// The version probe also checks the dynamic loader and runtime libraries before
// replacing the running application. It never opens a second GUI.
func validateExecutable(ctx context.Context, filename, expected string) error {
	if err := validateELF(filename); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, filename, "--version").Output()
	if err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) {
			return fmt.Errorf("a atualização não pode iniciar neste sistema: %s", strings.TrimSpace(string(exit.Stderr)))
		}
		return fmt.Errorf("não foi possível conferir o novo executável: %w", err)
	}
	if strings.TrimSpace(string(output)) != expected {
		return errors.New("a versão do executável não corresponde à release selecionada")
	}
	return nil
}
