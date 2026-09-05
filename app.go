package main

import (
	"context"
	"z-mapflow/internal/devices/soflev2"
	"z-mapflow/internal/models"
)

type App struct {
	ctx           context.Context
	savedLayout   *models.KeyboardLayout
	currentLayout *models.KeyboardLayout
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetInitialLayout() models.KeyboardLayout {
	device := soflev2.NewDevice()
	return device.GetDefaultLayout()
}
