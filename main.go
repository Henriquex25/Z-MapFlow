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

//go:embed VERSION
var appVersion string

func init() {
	if err := version.Set(appVersion); err != nil {
		panic(err)
	}
}

func main() {
	if len(os.Args) == 2 && os.Args[1] == "--version" {
		fmt.Println(version.Version)
		return
	}
	if handled, err := updates.HandleHelper(os.Args[1:]); handled {
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
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
	appOptions := &options.App{
		Title:  "Z-MapFlow",
		Width:  1440,
		Height: 900,
		Linux:  &linux.Options{Icon: appIcon, ProgramName: "z-mapflow", WebviewGpuPolicy: webviewGpuPolicy()},
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
	}
	if err := configurePlatform(appOptions); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	err := wails.Run(appOptions)

	if err != nil {
		println("Error:", err.Error())
	}
}

// Let WebKit accelerate compositing when available. Keep an explicit recovery
// switch for graphics drivers that cannot run the accelerated webview.
func webviewGpuPolicy() linux.WebviewGpuPolicy {
	if os.Getenv("ZMAPFLOW_DISABLE_GPU") == "1" {
		return linux.WebviewGpuPolicyNever
	}
	// Wails v2.15.0's Go and C enum order differ: native window.c maps 1
	// to ON_DEMAND, although the public Go constant at 1 is named Always.
	// Keep native ON_DEMAND rather than forcing acceleration (native 0).
	return linux.WebviewGpuPolicyAlways
}
