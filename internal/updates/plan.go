package updates

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// Only basenames travel to the Windows helper. All files must remain in the
// writable application directory; UI input never supplies paths or commands.
type updatePlan struct {
	ParentPID int    `json:"parentPid"`
	Target    string `json:"target"`
	Staged    string `json:"staged"`
	Version   string `json:"version"`
	SHA256    string `json:"sha256"`
}

func (p updatePlan) validate() error {
	for _, name := range []string{p.Target, p.Staged} {
		if name == "" || filepath.Base(name) != name || strings.ContainsAny(name, `/\:`) || !strings.HasSuffix(name, ".exe") {
			return errors.New("invalid Windows update filename")
		}
	}
	if p.ParentPID <= 1 || p.Target == p.Staged || strings.HasPrefix(p.Target, ".z-mapflow-") || !strings.HasPrefix(p.Staged, ".z-mapflow-update-") || !stableVersion.MatchString(p.Version) {
		return errors.New("invalid Windows update plan")
	}
	sum, err := hex.DecodeString(p.SHA256)
	if err != nil || len(sum) != sha256.Size {
		return errors.New("invalid Windows update checksum")
	}
	return nil
}

func readPlan(name string) (updatePlan, error) {
	var p updatePlan
	info, err := os.Lstat(name)
	if err != nil {
		return p, err
	}
	if !info.Mode().IsRegular() || info.Size() > 8192 {
		return p, errors.New("invalid Windows update plan file")
	}
	f, err := os.Open(name)
	if err != nil {
		return p, err
	}
	defer f.Close()
	decoder := json.NewDecoder(io.LimitReader(f, 8193))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&p); err != nil {
		return p, err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return p, errors.New("unexpected Windows update plan content")
	}
	if err := p.validate(); err != nil {
		return p, err
	}
	// The updater helper must never wait for itself. The parent app creates and
	// validates this same plan before launching the helper, so its PID is valid
	// there and can only be rejected in the helper process that reads the plan.
	if p.ParentPID == os.Getpid() {
		return p, errors.New("invalid Windows update plan")
	}
	return p, nil
}

func verifyFileHash(name, expected string) error {
	info, err := os.Lstat(name)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() || info.Size() <= 0 || info.Size() > maxBinary {
		return errors.New("invalid update file")
	}
	f, err := os.Open(name)
	if err != nil {
		return err
	}
	defer f.Close()
	digest := sha256.New()
	if _, err := io.Copy(digest, io.LimitReader(f, maxBinary+1)); err != nil {
		return err
	}
	if !strings.EqualFold(hex.EncodeToString(digest.Sum(nil)), expected) {
		return errors.New("the staged update checksum changed")
	}
	return nil
}
