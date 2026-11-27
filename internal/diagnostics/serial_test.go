package diagnostics

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakePort struct {
	chunks chan []byte
	closed chan struct{}
}

func (p *fakePort) SetReadTimeout(time.Duration) error { return nil }
func (p *fakePort) Close() error                       { close(p.closed); return nil }
func (p *fakePort) Read(b []byte) (int, error) {
	select {
	case data := <-p.chunks:
		if data == nil {
			return 0, errors.New("device unplugged")
		}
		return copy(b, data), nil
	case <-time.After(time.Millisecond):
		return 0, nil
	}
}
func TestCaptureBoundedDisconnectAndRestart(t *testing.T) {
	ports := []string{"serial-A"}
	var opened int
	var p *fakePort
	m := &Manager{list: func() ([]string, error) { return ports, nil }, open: func(string) (reader, error) {
		opened++
		p = &fakePort{chunks: make(chan []byte, 100), closed: make(chan struct{})}
		return p, nil
	}}
	if err := m.Start("/etc/passwd"); err == nil || opened != 0 {
		t.Fatal("unlisted path opened")
	}
	if err := m.Start("serial-A"); err != nil {
		t.Fatal(err)
	}
	if err := m.Start("serial-A"); err == nil {
		t.Fatal("second capture accepted")
	}
	for i := 0; i < 80; i++ {
		p.chunks <- []byte(strings.Repeat("X", 4096))
	}
	p.chunks <- []byte("final log\n")
	p.chunks <- nil
	select {
	case <-m.done:
	case <-time.After(time.Second):
		t.Fatal("disconnect did not close")
	}
	s := m.Display()
	if s.Running || s.Error == "" || !s.Truncated || len(s.Text) > maxLog || !strings.HasSuffix(s.Text, "final log\n") {
		t.Fatal(s.Running, s.Error, s.Truncated, len(s.Text))
	}
	if !strings.Contains(m.Export(), "final log") {
		t.Fatal("export lost capture")
	}
	m.Stop() // Must also be safe after disconnect.
	if err := m.Start("serial-A"); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); m.Display(); m.Clear(); m.Export() }()
	}
	m.Stop()
	wg.Wait()
	if m.Snapshot().Running {
		t.Fatal("stop did not complete")
	}
	select {
	case <-p.closed:
	default:
		t.Fatal("port not closed")
	}
	ports = nil
	if err := m.Start("serial-A"); err == nil {
		t.Fatal("stale port accepted")
	}
}
