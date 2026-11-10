package main

import (
	"embed"
	"fmt"
	"os"
	"z-mapflow/internal/desktopassets"
	"z-mapflow/internal/updates"
	"z-mapflow/internal/version"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	if len(os.Args) == 2 && os.Args[1] == "--version" {
		fmt.Println(version.Version)
		return
	}
	if err := updates.WaitForParent(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	if err := desktopassets.RefreshIcon(appIcon); err != nil {
		fmt.Fprintln(os.Stderr, "Could not refresh the application icon:", err)
	}
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Z-MapFlow",
		Width:  1440,
		Height: 900,
		Linux:  &linux.Options{Icon: appIcon, ProgramName: "z-mapflow", WebviewGpuPolicy: linux.WebviewGpuPolicyNever},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		OnBeforeClose:    app.beforeClose,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
