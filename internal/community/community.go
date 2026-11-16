// Package community keeps optional support invitations local to this installation.
package community

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
	"z-mapflow/internal/storage"
)

const (
	Star     = "star"
	Donation = "donation"
)

type preferences struct {
	Schema             int  `json:"schema"`
	Launches           int  `json:"launches"`
	ActiveMinutes      int  `json:"activeMinutes"`
	StarDismissed      bool `json:"starDismissed"`
	DonationDismissed  bool `json:"donationDismissed"`
	StarResponseLaunch int  `json:"starResponseLaunch"`
}

type Status struct {
	Prompt string `json:"prompt"`
}

type Service struct {
	mu         sync.Mutex
	path       string
	state      preferences
	lastMinute time.Time
}

// Start counts one native application launch. Reads and webview reloads never count.
func Start(root string) (*Service, error) {
	s := &Service{path: filepath.Join(root, "community.json"), state: preferences{Schema: 1}, lastMinute: time.Now()}
	data, err := os.ReadFile(s.path)
	if err == nil {
		if err := json.Unmarshal(data, &s.state); err != nil {
			return nil, err
		}
		if s.state.Schema != 1 || s.state.Launches < 0 || s.state.ActiveMinutes < 0 || s.state.ActiveMinutes > 120 || s.state.StarResponseLaunch < 0 || s.state.StarResponseLaunch > s.state.Launches {
			return nil, fmt.Errorf("invalid community preferences")
		}
	} else if !os.IsNotExist(err) {
		return nil, err
	}
	s.state.Launches++
	if err := storage.AtomicJSON(s.path, s.state); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Service) status() Status {
	if !s.state.StarDismissed && s.state.Launches >= 5 && s.state.ActiveMinutes >= 30 {
		return Status{Prompt: Star}
	}
	if s.state.StarDismissed && !s.state.DonationDismissed && s.state.Launches >= 10 && s.state.ActiveMinutes >= 120 && s.state.Launches-s.state.StarResponseLaunch >= 3 {
		return Status{Prompt: Donation}
	}
	return Status{}
}

func (s *Service) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status()
}

// RecordMinute is called after a full foreground minute in the editor. The
// native clock prevents duplicate calls/reloads from accelerating the counter.
func (s *Service) RecordMinute() (Status, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	if now.Sub(s.lastMinute) < time.Minute || s.state.ActiveMinutes >= 120 {
		return s.status(), nil
	}
	next := s.state
	next.ActiveMinutes++
	if err := storage.AtomicJSON(s.path, next); err != nil {
		return Status{}, err
	}
	s.state = next
	s.lastMinute = now
	return s.status(), nil
}

// Dismiss is also used by the positive action and the permanent header buttons.
// It has its own atomic write so project/language saves cannot re-enable a prompt.
func (s *Service) Dismiss(kind string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := s.state
	switch kind {
	case Star:
		if next.StarDismissed {
			return nil
		}
		next.StarDismissed = true
		next.StarResponseLaunch = next.Launches
	case Donation:
		if next.DonationDismissed {
			return nil
		}
		next.DonationDismissed = true
	default:
		return fmt.Errorf("unknown community invitation")
	}
	if err := storage.AtomicJSON(s.path, next); err != nil {
		return err
	}
	s.state = next
	return nil
}
