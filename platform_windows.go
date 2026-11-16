package main

import (
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
	"path/filepath"
	"z-mapflow/internal/storage"
)

func configurePlatform(app *options.App) error {
	root, err := storage.DataDir()
	if err != nil {
		return err
	}
	// Keep language and editor preferences when launching the installer binary,
	// a portable download or the replacement executable after an update.
	app.Windows = &windows.Options{WebviewUserDataPath: filepath.Join(root, "webview2")}
	app.SingleInstanceLock = &options.SingleInstanceLock{UniqueId: "01db25a7-5a15-4a35-babe-ef066613032e"}
	return nil
}
