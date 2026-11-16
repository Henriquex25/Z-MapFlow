//go:build !windows

package main

import "github.com/wailsapp/wails/v2/pkg/options"

func configurePlatform(*options.App) error { return nil }
