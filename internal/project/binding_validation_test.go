package project_test

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"z-mapflow/internal/models"
	"z-mapflow/internal/project"
)

func TestSharedBindingValidationCases(t *testing.T) {
	data, e := os.ReadFile("../zmkdata/cases.json")
	if e != nil {
		t.Fatal(e)
	}
	var cases []struct {
		Code         string
		Valid, Macro bool
	}
	if e = json.Unmarshal(data, &cases); e != nil {
		t.Fatal(e)
	}
	s := service(t)
	p, _ := s.New("sofle_v2")
	p.Options.BluetoothProfiles = 3
	p.Options.Pointing = true
	p.Preamble = "#define MY_KEY A\n#define MY_WRAP(k) LC(k)\n#define MY_STRING \"text\"\n"
	d, _ := s.Registry.Get(p.PluginID)
	for _, c := range cases {
		t.Run(c.Code, func(t *testing.T) {
			e := project.ValidateBinding(c.Code, p, d.Descriptor(), c.Macro)
			if (e == nil) != c.Valid {
				t.Fatalf("valid=%v, error=%v", c.Valid, e)
			}
		})
	}
}
func TestInvalidParameterCannotBeSaved(t *testing.T) {
	s := service(t)
	p, _ := s.New("sofle_v2")
	p.Layout.Layers[0].Keys[0].Code = "&kp FDSFSD"
	if _, e := s.Save(p); e == nil || !strings.Contains(e.Error(), "FDSFSD") {
		t.Fatal("invalid keycode was accepted", e)
	}
}
func TestManagedModifierMasks(t *testing.T) {
	s := service(t)
	p, _ := s.New("sofle_v2")
	for value, valid := range map[string]bool{"<(MOD_LSFT|MOD_RSFT)>": true, "<FDSFSD>": false, "<A>": false} {
		e := project.ValidateBehaviorValues(models.Behavior{Properties: map[string]string{"mods": value}}, p)
		if (e == nil) != valid {
			t.Fatalf("%s: %v", value, e)
		}
	}
}
