package community

import (
	"os"
	"path/filepath"
	"testing"
	"time"
	"z-mapflow/internal/storage"
)

func seeded(t *testing.T, state preferences) (*Service, string) {
	t.Helper()
	root := t.TempDir()
	state.Schema = 1
	if err := storage.AtomicJSON(filepath.Join(root, "community.json"), state); err != nil {
		t.Fatal(err)
	}
	s, err := Start(root)
	if err != nil {
		t.Fatal(err)
	}
	return s, root
}

func TestInvitationSchedule(t *testing.T) {
	for _, tc := range []struct {
		name              string
		launches, minutes int
		star, donation    bool
		responseLaunch    int
		want              string
	}{
		{"first launch", 1, 120, false, false, 0, ""},
		{"second launch", 2, 120, false, false, 0, ""},
		{"too few launches", 4, 120, false, false, 0, ""},
		{"too little use", 5, 29, false, false, 0, ""},
		{"star eligible", 5, 30, false, false, 0, Star},
		{"star before donation", 10, 120, false, false, 0, Star},
		{"donation too soon", 9, 120, true, false, 5, ""},
		{"donation needs more use", 10, 119, true, false, 5, ""},
		{"same session", 10, 120, true, false, 10, ""},
		{"next session", 11, 120, true, false, 10, ""},
		{"second session after", 12, 120, true, false, 10, ""},
		{"donation eligible", 13, 120, true, false, 10, Donation},
		{"both dismissed", 13, 120, true, true, 10, ""},
		{"manual donation leaves star", 5, 30, false, true, 0, Star},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := &Service{state: preferences{Launches: tc.launches, ActiveMinutes: tc.minutes, StarDismissed: tc.star, DonationDismissed: tc.donation, StarResponseLaunch: tc.responseLaunch}}
			if got := s.Status().Prompt; got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestResponsesPersistAndInvitationsNeverFollowEachOther(t *testing.T) {
	s, root := seeded(t, preferences{Launches: 9, ActiveMinutes: 120})
	if err := s.Dismiss(Star); err != nil {
		t.Fatal(err)
	}
	for range 20 {
		if got := s.Status().Prompt; got != "" {
			t.Fatalf("prompt after answering star: %s", got)
		}
	}
	for i := range 3 {
		var err error
		s, err = Start(root)
		if err != nil {
			t.Fatal(err)
		}
		want := ""
		if i == 2 {
			want = Donation
		}
		if got := s.Status().Prompt; got != want {
			t.Fatalf("session %d: %q, want %q", i, got, want)
		}
	}
	if err := s.Dismiss(Donation); err != nil {
		t.Fatal(err)
	}
	s, err := Start(root)
	if err != nil {
		t.Fatal(err)
	}
	if !s.state.StarDismissed || !s.state.DonationDismissed || s.Status().Prompt != "" {
		t.Fatal("response lost across restart")
	}
	launch := s.state.StarResponseLaunch
	if err := s.Dismiss(Star); err != nil {
		t.Fatal(err)
	}
	if s.state.StarResponseLaunch != launch {
		t.Fatal("manual link moved the original response date")
	}
}

func TestOnlyNativeStartCountsLaunches(t *testing.T) {
	s, root := seeded(t, preferences{})
	for range 20 {
		s.Status()
		s.RecordMinute()
	}
	if s.state.Launches != 1 || s.state.ActiveMinutes != 0 {
		t.Fatal("reads or duplicate calls counted as usage/launches")
	}
	s, err := Start(root)
	if err != nil {
		t.Fatal(err)
	}
	if s.state.Launches != 2 {
		t.Fatalf("launches: %d", s.state.Launches)
	}
}

func TestUsageCheckpointAndCap(t *testing.T) {
	s, root := seeded(t, preferences{Launches: 4, ActiveMinutes: 29})
	s.lastMinute = time.Now().Add(-10 * time.Minute)
	status, err := s.RecordMinute()
	if err != nil {
		t.Fatal(err)
	}
	if s.state.ActiveMinutes != 30 || status.Prompt != Star {
		t.Fatal("missing eligible invitation")
	}
	s, err = Start(root)
	if err != nil {
		t.Fatal(err)
	}
	if s.state.ActiveMinutes != 30 {
		t.Fatal("usage checkpoint not persisted")
	}
	s.state.ActiveMinutes = 120
	s.lastMinute = time.Now().Add(-time.Hour)
	if _, err := s.RecordMinute(); err != nil {
		t.Fatal(err)
	}
	if s.state.ActiveMinutes != 120 {
		t.Fatal("counter should stop after two hours")
	}
}

func TestFailedDismissDoesNotClaimPersistence(t *testing.T) {
	s, _ := seeded(t, preferences{Launches: 4, ActiveMinutes: 30})
	// An existing file cannot serve as the parent directory for an atomic write.
	s.path = filepath.Join(s.path, "unwritable.json")
	if err := s.Dismiss(Star); err == nil {
		t.Fatal("expected write failure")
	}
	if s.state.StarDismissed || s.Status().Prompt != Star {
		t.Fatal("failed write changed the response")
	}
	if err := s.Dismiss("unknown"); err == nil {
		t.Fatal("unknown invitation accepted")
	}
}

func TestCorruptPreferencesArePreserved(t *testing.T) {
	for _, contents := range []string{`broken`, `{"schema":2}`, `{"schema":1,"activeMinutes":-1}`} {
		root := t.TempDir()
		path := filepath.Join(root, "community.json")
		if err := os.WriteFile(path, []byte(contents), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := Start(root); err == nil {
			t.Fatal("corrupt preferences accepted")
		}
		data, err := os.ReadFile(path)
		if err != nil || string(data) != contents {
			t.Fatal("corrupt preferences silently replaced")
		}
	}
}
