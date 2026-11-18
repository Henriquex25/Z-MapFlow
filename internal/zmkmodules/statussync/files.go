// Package statussync supplies a self-contained, optional ZMK firmware module.
// It uses the existing encrypted split BLE connections, not another radio link.
package statussync

import (
	"embed"
	"io/fs"
)

//go:embed module
var sources embed.FS

func Files() map[string]string {
	files := map[string]string{"zephyr/module.yml": "name: zmapflow_status_sync\nbuild:\n  cmake: zmapflow-status\n  kconfig: zmapflow-status/Kconfig\n  settings:\n    board_root: .\n    snippet_root: .\n"}
	fs.WalkDir(sources, "module", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		data, err := sources.ReadFile(path)
		if err != nil {
			return err
		}
		files["zmapflow-status/"+path[len("module/"):]] = string(data)
		return nil
	})
	return files
}
