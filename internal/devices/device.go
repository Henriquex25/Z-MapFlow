package devices

import "z-mapflow/internal/models"

type KeyboardDevice interface {
	GetIdentifier() string
	GetName() string
	GetDefaultLayout() models.KeyboardLayout
}
