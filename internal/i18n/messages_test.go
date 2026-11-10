package i18n

import (
	"regexp"
	"sort"
	"strings"
	"testing"
)

func TestNativeDialogLanguage(t *testing.T) {
	for _, c := range []struct{ locale, key, want string }{{"en", "Import project", "Import project"}, {"pt-BR", "Import project", "Importar projeto"}, {"en", "Importar projeto", "Import project"}, {"pt-BR", "Replace files", "Substituir arquivos"}, {"en", "keys_pt_abnt2.h", "keys_pt_abnt2.h"}} {
		if got := Message(c.locale, c.key); got != c.want {
			t.Fatalf("%s/%s: %q", c.locale, c.key, got)
		}
	}
}
func TestTranslationPlaceholdersMatch(t *testing.T) {
	pattern := regexp.MustCompile(`\{[0-9]+\}`)
	for en, pt := range portuguese {
		a, b := pattern.FindAllString(en, -1), pattern.FindAllString(pt, -1)
		sort.Strings(a)
		sort.Strings(b)
		if strings.Join(a, ",") != strings.Join(b, ",") {
			t.Errorf("placeholder mismatch: %s / %s", en, pt)
		}
	}
}
