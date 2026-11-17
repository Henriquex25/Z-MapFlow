package flash

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
	"z-mapflow/internal/models"
)

func TestInspectAndCopyOnSimulatedVolume(t *testing.T) {
	volume := t.TempDir()
	v := models.Variant{BootloaderBoards: []string{"nRF52840"}}
	if _, err := Inspect(volume, v); err == nil {
		t.Fatal("ordinary folder accepted")
	}
	if err := os.WriteFile(filepath.Join(volume, "INFO_UF2.TXT"), []byte("Model: nRF52840\nBoard-ID: nRF52840-SuperMini\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Inspect(volume, v); err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(t.TempDir(), "left.uf2")
	if err := os.WriteFile(source, []byte("verified by firmware service before copying"), 0600); err != nil {
		t.Fatal(err)
	}
	if result, err := Copy(source, volume, "left.uf2", v); err != nil || result.Status != "sent" {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(volume, "left.uf2"))
	if err != nil || len(got) == 0 {
		t.Fatal("not copied", err)
	}
	if _, err := Copy(source, volume, "../outside.uf2", v); err == nil {
		t.Fatal("path traversal accepted")
	}
	if _, err := Inspect(volume, models.Variant{BootloaderBoards: []string{"other"}}); err == nil {
		t.Fatal("incompatible bootloader accepted")
	}
}

type waitingSyncWriter struct {
	simulatedWriter
	entered chan struct{}
	release chan struct{}
}

func (w *waitingSyncWriter) Sync() error {
	close(w.entered)
	<-w.release
	return w.simulatedWriter.Sync()
}

func TestProgressDoesNotConfirmBlockedFinalWrite(t *testing.T) {
	w := &waitingSyncWriter{entered: make(chan struct{}), release: make(chan struct{})}
	released := false
	defer func() {
		if !released {
			close(w.release)
		}
	}()
	payload := bytes.Repeat([]byte("UF2-block"), 8192)
	events := make(chan Progress, 100)
	done := make(chan Result, 1)
	errCh := make(chan error, 1)
	go func() {
		r, err := copyWithProgress(w, bytes.NewReader(payload), int64(len(payload)), func(p Progress) { events <- p })
		done <- r
		errCh <- err
	}()
	select {
	case <-w.entered:
	case <-time.After(3 * time.Second):
		t.Fatal("sync was not reached")
	}
	var progress Progress
	for len(events) > 0 {
		progress = <-events
	}
	if progress.Stage != "syncing" || progress.Written != int64(len(payload)) || progress.Total != int64(len(payload)) {
		t.Fatalf("wrong progress before blocked flush: %+v", progress)
	}
	select {
	case <-done:
		t.Fatal("blocked USB write was marked complete")
	default:
	}
	close(w.release)
	released = true
	if r := <-done; r.Status != "sent" {
		t.Fatal(r)
	}
	if err := <-errCh; err != nil {
		t.Fatal(err)
	}
}

type simulatedWriter struct {
	data                        bytes.Buffer
	writeErr, syncErr, closeErr error
	synced, closed              bool
}

func (w *simulatedWriter) Write(p []byte) (int, error) {
	if w.writeErr != nil {
		return 0, w.writeErr
	}
	return w.data.Write(p)
}
func (w *simulatedWriter) Sync() error  { w.synced = true; return w.syncErr }
func (w *simulatedWriter) Close() error { w.closed = true; return w.closeErr }

func TestTransferConfirmation(t *testing.T) {
	failure := errors.New("input/output error")
	for _, tc := range []struct {
		name      string
		writer    simulatedWriter
		status    string
		wantError bool
	}{
		{name: "complete transfer", status: "sent"},
		{name: "sync failure after copy", writer: simulatedWriter{syncErr: failure}, status: "unconfirmed"},
		{name: "close failure after copy", writer: simulatedWriter{closeErr: failure}, status: "unconfirmed"},
		{name: "write interrupted", writer: simulatedWriter{writeErr: failure}, wantError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			payload := []byte("firmware data")
			result, err := copyToVolume(&tc.writer, bytes.NewReader(payload))
			if (err != nil) != tc.wantError || result.Status != tc.status {
				t.Fatalf("result=%+v err=%v", result, err)
			}
			if !tc.writer.closed {
				t.Fatal("destination not closed")
			}
			if tc.wantError {
				if !errors.Is(err, failure) || tc.writer.synced {
					t.Fatal("interrupted copy treated as completed")
				}
			} else if !bytes.Equal(tc.writer.data.Bytes(), payload) || !tc.writer.synced {
				t.Fatal("full transfer required before confirmation")
			}
			if tc.status == "unconfirmed" && result.Detail != failure.Error() {
				t.Fatal("original I/O error lost")
			}
		})
	}
}
