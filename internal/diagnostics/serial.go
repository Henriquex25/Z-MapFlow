// Package diagnostics captures firmware USB serial output without sending commands.
package diagnostics

import (
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"go.bug.st/serial"
)

const maxLog = 256 * 1024

type Snapshot struct {
	Port      string `json:"port"`
	Running   bool   `json:"running"`
	Text      string `json:"text"`
	Error     string `json:"error"`
	Truncated bool   `json:"truncated"`
}
type reader interface {
	Read([]byte) (int, error)
	Close() error
	SetReadTimeout(time.Duration) error
}
type Manager struct {
	op    sync.Mutex
	mu    sync.Mutex
	state Snapshot
	stop  chan struct{}
	done  chan struct{}
	// Injectable ports/transport for bounded-capture and disconnect tests.
	list func() ([]string, error)
	open func(string) (reader, error)
}

func Ports() ([]string, error) { return serial.GetPortsList() }
func (m *Manager) Snapshot() Snapshot {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.state
}
func (m *Manager) Start(name string) error {
	m.op.Lock()
	defer m.op.Unlock()
	m.mu.Lock()
	running := m.state.Running
	m.mu.Unlock()
	if running {
		return fmt.Errorf("Stop the current capture before opening another port.")
	}
	list := m.list
	if list == nil {
		list = Ports
	}
	ports, err := list()
	if err != nil {
		return err
	}
	found := false
	for _, p := range ports {
		found = found || p == name
	}
	if !found {
		return fmt.Errorf("The serial port is no longer available. Refresh the port list.")
	}
	open := m.open
	if open == nil {
		open = func(name string) (reader, error) {
			return serial.Open(name, &serial.Mode{BaudRate: 115200, InitialStatusBits: &serial.ModemOutputBits{DTR: true, RTS: false}})
		}
	}
	p, err := open(name)
	if err != nil {
		return err
	}
	if err = p.SetReadTimeout(200 * time.Millisecond); err != nil {
		p.Close()
		return err
	}
	m.stopLocked()
	m.mu.Lock()
	m.state = Snapshot{Port: name, Running: true}
	m.stop = make(chan struct{})
	m.done = make(chan struct{})
	stop, done := m.stop, m.done
	m.mu.Unlock()
	go m.read(name, p, stop, done)
	return nil
}
func (m *Manager) append(data []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state.Text += string(data)
	if len(m.state.Text) > maxLog {
		m.state.Text = m.state.Text[len(m.state.Text)-maxLog:]
		m.state.Truncated = true
	}
}
func (m *Manager) read(name string, p reader, stop, done chan struct{}) {
	defer close(done)
	defer func() { p.Close(); m.mu.Lock(); m.state.Running = false; m.mu.Unlock() }()
	buf := make([]byte, 4096)
	lastCheck := time.Now()
	list := m.list
	if list == nil {
		list = Ports
	}
	for {
		select {
		case <-stop:
			return
		default:
		}
		n, err := p.Read(buf)
		if n > 0 {
			m.append(buf[:n])
		}
		if err == nil && time.Since(lastCheck) >= 2*time.Second {
			lastCheck = time.Now()
			if ports, e := list(); e == nil {
				present := false
				for _, port := range ports {
					present = present || port == name
				}
				if !present {
					err = fmt.Errorf("The serial device disconnected.")
				}
			}
		}
		if err != nil {
			m.mu.Lock()
			m.state.Error = err.Error()
			m.mu.Unlock()
			return
		}
	}
}
func (m *Manager) stopLocked() {
	m.mu.Lock()
	stop, done := m.stop, m.done
	m.stop = nil
	m.done = nil
	m.mu.Unlock()
	if stop != nil {
		close(stop)
		<-done
	}
}
func (m *Manager) Stop() { m.op.Lock(); defer m.op.Unlock(); m.stopLocked() }
func (m *Manager) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.state.Text = ""
	m.state.Truncated = false
}
func (m *Manager) Export() string {
	s := m.Snapshot()
	return fmt.Sprintf("Z-MapFlow firmware diagnostics\nPort: %s\nExported: %s\nTruncated: %t\nCapture error: %s\n\n%s", s.Port, time.Now().UTC().Format(time.RFC3339), s.Truncated, s.Error, strings.ToValidUTF8(s.Text, "�"))
}
func (m *Manager) Display() Snapshot {
	s := m.Snapshot()
	if !utf8.ValidString(s.Text) {
		s.Text = strings.ToValidUTF8(s.Text, "�")
	}
	return s
}
