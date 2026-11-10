package updates

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestVersionOrdering(t *testing.T) {
	for _, c := range []struct {
		next, current string
		newer         bool
	}{
		{"v1.10.0", "1.9.9", true}, {"v2.0.0", "1.99.99", true}, {"v1.2.1", "v1.2.0", true},
		{"v1.2.0", "1.2.0", false}, {"v1.1.9", "1.2.0", false}, {"v1.0.0-beta.1", "0.9.0", false},
		{"v01.0.0", "0.9.0", false}, {"nightly", "0.9.0", false}, {"v1.0.0", "dev", true},
	} {
		if got := newer(c.next, c.current); got != c.newer {
			t.Errorf("%s > %s = %v", c.next, c.current, got)
		}
	}
}

type fixture struct {
	m       *Manager
	target  string
	mu      sync.Mutex
	release release
	body    []byte
	sums    string
	status  int
}

func testManager(t *testing.T) *fixture {
	t.Helper()
	body := []byte("new executable")
	hash := sha256.Sum256(body)
	f := &fixture{body: body, status: 200}
	f.target = filepath.Join(t.TempDir(), "z-mapflow")
	if e := os.WriteFile(f.target, []byte("original executable"), 0755); e != nil {
		t.Fatal(e)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			t.Error("public update must not send credentials")
		}
		f.mu.Lock()
		defer f.mu.Unlock()
		switch r.URL.Path {
		case "/latest":
			w.WriteHeader(f.status)
			if f.status == 200 {
				json.NewEncoder(w).Encode(f.release)
			}
		case "/checksums.txt":
			fmt.Fprint(w, f.sums)
		case "/z-mapflow_linux_amd64":
			w.Write(f.body)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	f.release = release{Tag: "v1.2.0", Body: "Fixes", Assets: []asset{
		{Name: "z-mapflow_linux_amd64", URL: server.URL + "/z-mapflow_linux_amd64", Size: int64(len(body)), Digest: "sha256:" + hex.EncodeToString(hash[:])},
		{Name: "checksums.txt", URL: server.URL + "/checksums.txt", Size: 90}}}
	f.sums = fmt.Sprintf("%x  z-mapflow_linux_amd64\n", hash)
	f.m = New("1.1.0")
	f.m.endpoint = server.URL + "/latest"
	f.m.client = server.Client()
	f.m.allowLocal = true
	f.m.goos = "linux"
	f.m.arch = "amd64"
	f.m.executable = func() (string, error) { return f.target, nil }
	f.m.validateBinary = func(context.Context, string, string) error { return nil }
	return f
}
func TestCheckRelease(t *testing.T) {
	f := testManager(t)
	info, e := f.m.Check(context.Background())
	if e != nil || !info.Available || !info.Supported || info.LatestVersion != "1.2.0" {
		t.Fatal(info, e)
	}
	if !strings.HasPrefix(info.ReleaseURL, ReleasesURL+"/tag/") {
		t.Fatal(info)
	}
	f.m.arch = "arm64"
	info, e = f.m.Check(context.Background())
	if e != nil || info.Supported || !info.Available {
		t.Fatal(info, e)
	}
}
func TestIgnoreUnavailableReleases(t *testing.T) {
	for _, kind := range []string{"prerelease", "draft", "missing", "invalid-version", "same-version", "older"} {
		t.Run(kind, func(t *testing.T) {
			f := testManager(t)
			f.mu.Lock()
			switch kind {
			case "prerelease":
				f.release.Prerelease = true
			case "draft":
				f.release.Draft = true
			case "missing":
				f.status = 404
			case "invalid-version":
				f.release.Tag = "nightly"
			case "same-version":
				f.release.Tag = "v1.1.0"
			case "older":
				f.release.Tag = "v1.0.0"
			}
			f.mu.Unlock()
			info, e := f.m.Check(context.Background())
			if e != nil || info.Available {
				t.Fatal(info, e)
			}
		})
	}
}
func TestSuccessfulInstallAndBackup(t *testing.T) {
	f := testManager(t)
	started := false
	e := f.m.Install(context.Background(), "1.2.0", func(path string) error {
		started = true
		data, e := os.ReadFile(path)
		if e != nil {
			return e
		}
		if string(data) != "new executable" {
			return fmt.Errorf("incorrect binary")
		}
		return nil
	})
	if e != nil || !started {
		t.Fatal(e)
	}
	old, e := os.ReadFile(f.target + ".previous")
	if e != nil || string(old) != "original executable" {
		t.Fatal(string(old), e)
	}
	stat, _ := os.Stat(f.target)
	if stat.Mode().Perm() != 0755 {
		t.Fatal(stat.Mode())
	}
	if f.m.Status().Stage != "restarting" {
		t.Fatal(f.m.Status())
	}
}
func TestBadDownloadsNeverReplaceExecutable(t *testing.T) {
	for _, kind := range []string{"corrupt", "size", "digest", "missing-checksum", "duplicate-checksum", "origin", "release-changed", "wrong-binary", "http-error", "platform"} {
		t.Run(kind, func(t *testing.T) {
			f := testManager(t)
			f.mu.Lock()
			switch kind {
			case "corrupt":
				f.body = []byte("corrupt bytes!")
			case "size":
				f.release.Assets[0].Size++
			case "digest":
				f.release.Assets[0].Digest = "sha256:" + strings.Repeat("0", 64)
			case "missing-checksum":
				f.sums = strings.Repeat("0", 64) + "  other-file\n"
			case "duplicate-checksum":
				f.sums += f.sums
			case "origin":
				f.release.Assets[0].URL = "http://example.com/not-the-official-release"
			case "release-changed":
				f.release.Tag = "v1.3.0"
			case "wrong-binary":
				f.m.validateBinary = func(context.Context, string, string) error { return fmt.Errorf("wrong architecture") }
			case "http-error":
				f.status = 503
			case "platform":
				f.m.goos = "darwin"
			}
			f.mu.Unlock()
			started := false
			e := f.m.Install(context.Background(), "1.2.0", func(string) error { started = true; return nil })
			if e == nil || started {
				t.Fatal("invalid update accepted", e)
			}
			data, _ := os.ReadFile(f.target)
			if string(data) != "original executable" {
				t.Fatal("changed active application")
			}
			files, _ := filepath.Glob(filepath.Join(filepath.Dir(f.target), ".z-mapflow-update-*"))
			if len(files) != 0 {
				t.Fatal("staged download leaked", files)
			}
		})
	}
}
func TestRestartFailureRollsBack(t *testing.T) {
	f := testManager(t)
	e := f.m.Install(context.Background(), "1.2.0", func(string) error { return fmt.Errorf("cannot exec") })
	if e == nil {
		t.Fatal("failed restart accepted")
	}
	data, _ := os.ReadFile(f.target)
	if string(data) != "original executable" {
		t.Fatal("rollback failed")
	}
}
func TestTrustedPublicAssetOrigin(t *testing.T) {
	m := New("1.0.0")
	good := "https://github.com/" + Repository + "/releases/download/v1.2.0/z-mapflow_linux_amd64"
	for _, u := range []string{good, "http" + strings.TrimPrefix(good, "https"), good + "?redirect=1", strings.Replace(good, Repository, "other/repo", 1), strings.Replace(good, "github.com", "github.com.evil.test", 1)} {
		if m.trusted(asset{Name: "z-mapflow_linux_amd64", URL: u}, "v1.2.0") != (u == good) {
			t.Fatal(u)
		}
	}
}
func TestELFValidation(t *testing.T) {
	if _, e := os.Stat("/proc/self/exe"); e != nil {
		t.Skip("Linux ELF validation")
	}
	if e := validateELF("/proc/self/exe"); e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(t.TempDir(), "binary")
	os.WriteFile(path, []byte("not ELF"), 0755)
	if e := validateELF(path); e == nil {
		t.Fatal("invalid ELF accepted")
	}
}

func TestMain(m *testing.M) {
	if os.Getenv("ZMAPFLOW_UPDATE_VERSION_HELPER") == "1" && len(os.Args) == 2 && os.Args[1] == "--version" {
		fmt.Println("1.2.0")
		os.Exit(0)
	}
	os.Exit(m.Run())
}
func TestNewExecutableVersionProbe(t *testing.T) {
	if _, e := os.Stat("/proc/self/exe"); e != nil {
		t.Skip("Linux executable probe")
	}
	t.Setenv("ZMAPFLOW_UPDATE_VERSION_HELPER", "1")
	filename, e := os.Executable()
	if e != nil {
		t.Fatal(e)
	}
	if e := validateExecutable(context.Background(), filename, "1.2.0"); e != nil {
		t.Fatal(e)
	}
	if e := validateExecutable(context.Background(), filename, "1.3.0"); e == nil {
		t.Fatal("misstamped executable accepted")
	}
}
