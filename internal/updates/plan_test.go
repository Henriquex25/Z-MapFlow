package updates

import (
	"crypto/sha256"
	"debug/pe"
	"encoding/binary"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func TestWindowsUpdatePlansRejectUnconfinedPaths(t *testing.T) {
	valid := updatePlan{ParentPID: 2, Target: "z-mapflow.exe", Staged: ".z-mapflow-update-test.exe", Version: "1.2.3", SHA256: hex.EncodeToString(make([]byte, 32))}
	if err := valid.validate(); err != nil {
		t.Fatal(err)
	}
	for _, alter := range []func(*updatePlan){
		func(p *updatePlan) { p.Target = "../z-mapflow.exe" },
		func(p *updatePlan) { p.Target = `C:\\app.exe` },
		func(p *updatePlan) { p.Target = "app.exe:stream.exe" },
		func(p *updatePlan) { p.Staged = "other.exe" },
		func(p *updatePlan) { p.ParentPID = os.Getpid() },
		func(p *updatePlan) { p.Version = "1.2.3-beta" },
		func(p *updatePlan) { p.SHA256 = "bad" },
	} {
		p := valid
		alter(&p)
		if err := p.validate(); err == nil {
			t.Fatalf("accepted invalid plan: %+v", p)
		}
	}
}

func TestStagedWindowsUpdateIsRecheckedBeforeReplacement(t *testing.T) {
	path := filepath.Join(t.TempDir(), "stage.exe")
	if err := os.WriteFile(path, []byte("verified bytes"), 0600); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte("verified bytes"))
	if err := verifyFileHash(path, hex.EncodeToString(sum[:])); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(path, []byte("changed bytes"), 0600)
	if err := verifyFileHash(path, hex.EncodeToString(sum[:])); err == nil {
		t.Fatal("changed stage accepted")
	}
}

func TestWindowsPEFormatAndArchitecture(t *testing.T) {
	for _, tc := range []struct {
		name           string
		machine, flags uint16
		valid          bool
	}{
		{"x64 executable", pe.IMAGE_FILE_MACHINE_AMD64, pe.IMAGE_FILE_EXECUTABLE_IMAGE, true},
		{"32 bit", pe.IMAGE_FILE_MACHINE_I386, pe.IMAGE_FILE_EXECUTABLE_IMAGE, false},
		{"library", pe.IMAGE_FILE_MACHINE_AMD64, pe.IMAGE_FILE_EXECUTABLE_IMAGE | pe.IMAGE_FILE_DLL, false},
		{"object", pe.IMAGE_FILE_MACHINE_AMD64, 0, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "sample.exe")
			f, err := os.Create(path)
			if err != nil {
				t.Fatal(err)
			}
			dos := make([]byte, 128)
			copy(dos, "MZ")
			binary.LittleEndian.PutUint32(dos[60:], 128)
			f.Write(dos)
			f.Write([]byte{'P', 'E', 0, 0})
			binary.Write(f, binary.LittleEndian, pe.FileHeader{Machine: tc.machine, SizeOfOptionalHeader: 240, Characteristics: tc.flags})
			binary.Write(f, binary.LittleEndian, pe.OptionalHeader64{Magic: 0x20b, Subsystem: 2, NumberOfRvaAndSizes: 16})
			f.Close()
			if err := validatePE(path); (err == nil) != tc.valid {
				t.Fatalf("valid=%v: %v", tc.valid, err)
			}
		})
	}
}
