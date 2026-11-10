// Package i18n shares the UI catalog with TypeScript, including native dialogs.
package i18n

import (
	_ "embed"
	"encoding/json"
)

//go:embed pt-BR.json
var source []byte
var portuguese map[string]string
var english map[string]string

func init() {
	if err := json.Unmarshal(source, &portuguese); err != nil {
		panic(err)
	}
	english = map[string]string{}
	for en, pt := range portuguese {
		english[pt] = en
	}
}
func Message(locale, message string) string {
	if en, ok := english[message]; ok {
		message = en
	}
	if locale == "pt-BR" {
		if pt, ok := portuguese[message]; ok {
			return pt
		}
	}
	return message
}
