package flash

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"z-mapflow/internal/models"
	"z-mapflow/internal/storage"
)

type SetupOption struct {
	VariantID string `json:"variantId"`
	Name      string `json:"name"`
	Dongle    bool   `json:"dongle"`
}
type SetupDevice struct {
	Controller string `json:"controller,omitempty"`
	ID         string `json:"id"`
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	Retired    bool   `json:"retired"`
	Family     uint32 `json:"family"`
}
type FlashPlan struct {
	Supported    bool                  `json:"supported"`
	NeedsSetup   bool                  `json:"needsSetup"`
	CanUndoSetup bool                  `json:"canUndoSetup,omitempty"`
	Required     bool                  `json:"required"`
	CanFlash     bool                  `json:"canFlash"`
	NeedsRebuild bool                  `json:"needsRebuild"`
	From         string                `json:"from"`
	To           string                `json:"to"`
	Options      []SetupOption         `json:"options"`
	ResetDevices []SetupDevice         `json:"resetDevices"`
	ResetDone    map[string]string     `json:"resetDone"`
	FirmwareDone map[string]string     `json:"firmwareDone"`
	Pending      *FlashAcknowledgement `json:"pending,omitempty"`
}
type FlashAcknowledgement struct {
	BuildID   string `json:"buildId"`
	ReceiptID string `json:"receiptId"`
	DeviceID  string `json:"deviceId"`
	Reset     bool   `json:"reset"`
	Status    string `json:"status"`
	Detail    string `json:"detail"`
}

// Setup is derived from a successful immutable build, never from the editor draft.
type Setup struct {
	Plugin         models.Plugin
	Variant        models.Variant
	BuildID        string
	ResetAvailable bool
	ResetTargets   map[string]bool // nil preserves compatibility with embedded callers.
}
type TopologyStore struct {
	Root string
	mu   sync.Mutex
}
type topologyState struct {
	Version        int              `json:"version"`
	Current        string           `json:"current"`
	CurrentVariant string           `json:"currentVariant"`
	Cycle          *flashCycle      `json:"cycle,omitempty"`
	BeforeSetup    *setupCheckpoint `json:"beforeSetup,omitempty"`
}

// Only app workflow state is restored. This checkpoint expires before USB writes.
type setupCheckpoint struct {
	Current        string      `json:"current"`
	CurrentVariant string      `json:"currentVariant"`
	Cycle          *flashCycle `json:"cycle,omitempty"`
}
type flashCycle struct {
	Signature       string            `json:"signature"`
	VariantID       string            `json:"variantId"`
	BuildID         string            `json:"buildId"`
	Required        bool              `json:"required"`
	Attempted       bool              `json:"attempted"`
	FirmwareStarted bool              `json:"firmwareStarted"`
	Completed       bool              `json:"completed"`
	Devices         []SetupDevice     `json:"devices"`
	ResetDone       map[string]string `json:"resetDone"`
	FirmwareDone    map[string]string `json:"firmwareDone"`
	Receipt         *transferReceipt  `json:"receipt,omitempty"`
}
type transferReceipt struct {
	ID       string `json:"id"`
	BuildID  string `json:"buildId"`
	DeviceID string `json:"deviceId"`
	Reset    bool   `json:"reset"`
	Status   string `json:"status"`
	Consumed bool   `json:"consumed"`
	Detail   string `json:"detail"`
}

func tracked(v models.Variant) bool {
	for _, f := range v.Features {
		if f == "pairing-migration" {
			return true
		}
	}
	return false
}
func topology(v models.Variant) string { return topologySignature(v, true) }
func topologySignature(v models.Variant, controllers bool) string {
	var roles []string
	for _, t := range v.Targets {
		if t.Kind != "settings-reset" {
			role := t.ID + ":" + t.Role + ":" + t.Kind
			if controllers && t.Controller != "" {
				role += ":" + t.Controller
			}
			roles = append(roles, role)
		}
	}
	sort.Strings(roles)
	return strings.Join(roles, ",")
}
func variant(p models.Plugin, id string) models.Variant {
	for _, v := range p.Variants {
		if v.ID == id {
			return v
		}
	}
	return models.Variant{}
}
func topologyName(v models.Variant) string {
	if v.ID == "" {
		return ""
	}
	for _, t := range v.Targets {
		if t.Kind == "dongle" {
			return "USB dongle central"
		}
	}
	return "Keyboard half central"
}
func controller(t models.Target) string {
	if t.Controller != "" {
		return t.Controller
	}
	return t.Board
}

// ResetTarget selects firmware for the device's controller, including a retired
// dongle. Never substitute a reset just because the UF2 family matches.
func ResetTarget(v models.Variant, device SetupDevice) (models.Target, error) {
	for _, t := range v.Targets {
		if t.Kind == "settings-reset" && controller(t) == device.Controller && device.Family == v.UF2Family {
			return t, nil
		}
	}
	return models.Target{}, fmt.Errorf("no matching reset firmware for %s; use a current hardware profile and rebuild", device.Name)
}
func resetTarget(ctx Setup, device SetupDevice) (models.Target, error) {
	target, err := ResetTarget(ctx.Variant, device)
	if err == nil && ctx.ResetTargets != nil && !ctx.ResetTargets[target.ID] {
		return models.Target{}, fmt.Errorf("this build has no reset firmware for %s; rebuild with a compatible current profile", device.Name)
	}
	return target, err
}
func (s *TopologyStore) ResetTarget(ctx Setup, deviceID string) (models.Target, error) {
	p, err := s.Plan(ctx)
	if err != nil {
		return models.Target{}, err
	}
	for _, device := range p.ResetDevices {
		if device.ID == deviceID {
			return resetTarget(ctx, device)
		}
	}
	return models.Target{}, fmt.Errorf("device does not belong to this reset step")
}
func devices(v models.Variant) []SetupDevice {
	var list []SetupDevice
	for _, t := range v.Targets {
		if t.Kind != "settings-reset" {
			list = append(list, SetupDevice{ID: t.ID, Name: t.Name, Kind: t.Kind, Family: v.UF2Family, Controller: controller(t)})
		}
	}
	return list
}
func mergeDevices(v models.Variant, sources ...[]SetupDevice) []SetupDevice {
	var list []SetupDevice
	for _, source := range append(sources, devices(v)) {
		for _, d := range source {
			found := false
			for i := range list {
				if list[i].ID == d.ID {
					list[i] = d
					found = true
					break
				}
			}
			if !found {
				list = append(list, d)
			}
		}
	}
	for i := range list {
		list[i].Retired = true
		for _, d := range devices(v) {
			if d.ID == list[i].ID {
				list[i].Retired = false
			}
		}
	}
	return list
}
func allDone(list []SetupDevice, done map[string]string) bool {
	if len(list) == 0 {
		return false
	}
	for _, d := range list {
		if done[d.ID] == "" {
			return false
		}
	}
	return true
}
func (s *TopologyStore) path(ctx Setup) (string, error) {
	name := ctx.Plugin.ID + ".json"
	if filepath.Base(name) != name || !storage.SafeRelative(name) {
		return "", fmt.Errorf("invalid keyboard identity")
	}
	return filepath.Join(s.Root, "flash", "topology", name), nil
}
func (s *TopologyStore) load(ctx Setup) (topologyState, error) {
	state := topologyState{Version: 1}
	path, err := s.path(ctx)
	if err != nil {
		return state, err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return state, nil
	}
	if err == nil {
		err = json.Unmarshal(data, &state)
	}
	if err != nil {
		return state, fmt.Errorf("could not read the saved flash workflow: %w", err)
	}
	if state.Version != 1 {
		return state, fmt.Errorf("unsupported flash workflow version")
	}
	installed := variant(ctx.Plugin, state.CurrentVariant)
	if state.Current != "" && state.Current == topologySignature(installed, false) {
		state.Current = topology(installed)
	}
	if state.Cycle != nil {
		previous := variant(ctx.Plugin, state.Cycle.VariantID)
		if state.Cycle.Signature == topologySignature(previous, false) {
			state.Cycle.Signature = topology(previous)
			for i := range state.Cycle.Devices {
				if state.Cycle.Devices[i].Controller != "" {
					continue
				}
				for _, v := range []models.Variant{installed, previous} {
					for _, d := range devices(v) {
						if d.ID == state.Cycle.Devices[i].ID {
							state.Cycle.Devices[i].Controller = d.Controller
						}
					}
				}
			}
		}
		if state.Cycle.ResetDone == nil {
			state.Cycle.ResetDone = map[string]string{}
		}
		if state.Cycle.FirmwareDone == nil {
			state.Cycle.FirmwareDone = map[string]string{}
		}
	}
	return state, nil
}
func (s *TopologyStore) save(ctx Setup, state topologyState) error {
	path, err := s.path(ctx)
	if err != nil {
		return err
	}
	return storage.AtomicJSON(path, state)
}

func canUndoSetup(state topologyState) bool {
	c := state.Cycle
	// Older versions saved a first known setup without a cycle. No tracked
	// operation has started in that case, so it can safely return to selection.
	if c == nil {
		return state.BeforeSetup != nil || state.Current != ""
	}
	return state.BeforeSetup != nil && !c.Attempted && !c.FirmwareStarted && !c.Completed && c.Receipt == nil && len(c.ResetDone) == 0 && len(c.FirmwareDone) == 0
}

func checkpointSetup(state *topologyState) {
	if state.BeforeSetup == nil {
		state.BeforeSetup = &setupCheckpoint{Current: state.Current, CurrentVariant: state.CurrentVariant, Cycle: state.Cycle}
	}
}

// UndoSetupSelection reverses a UI choice, never an attempted hardware write.
func (s *TopologyStore) UndoSetupSelection(ctx Setup) (FlashPlan, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load(ctx)
	if err != nil {
		return FlashPlan{}, err
	}
	if !tracked(ctx.Variant) || !canUndoSetup(state) {
		return FlashPlan{}, fmt.Errorf("The setup choice cannot be undone after a transfer starts. Close the guide to resume later.")
	}
	before := state.BeforeSetup
	if before == nil {
		before = &setupCheckpoint{}
	}
	state.Current, state.CurrentVariant, state.Cycle = before.Current, before.CurrentVariant, before.Cycle
	state.BeforeSetup = nil
	if err := s.save(ctx, state); err != nil {
		return FlashPlan{}, err
	}
	_, p := derive(ctx, state)
	return p, nil
}

func derive(ctx Setup, state topologyState) (*flashCycle, FlashPlan) {
	p := FlashPlan{Supported: tracked(ctx.Variant), CanFlash: true, To: topologyName(ctx.Variant), Options: []SetupOption{}, ResetDevices: []SetupDevice{}, ResetDone: map[string]string{}, FirmwareDone: map[string]string{}}
	if !p.Supported {
		return nil, p
	}
	p.CanUndoSetup = canUndoSetup(state)
	seen := map[string]bool{}
	for _, v := range ctx.Plugin.Variants {
		if tracked(v) && !seen[topology(v)] {
			dongle := false
			for _, t := range v.Targets {
				dongle = dongle || t.Kind == "dongle"
			}
			p.Options = append(p.Options, SetupOption{VariantID: v.ID, Name: v.Name, Dongle: dongle})
			seen[topology(v)] = true
		}
	}
	p.From = topologyName(variant(ctx.Plugin, state.CurrentVariant))
	if state.Current == "" && state.Cycle == nil {
		p.NeedsSetup, p.CanFlash = true, false
		return nil, p
	}
	sig := topology(ctx.Variant)
	c := state.Cycle
	if c == nil || c.Signature != sig || (c.Completed && c.BuildID != ctx.BuildID) {
		sources := [][]SetupDevice{devices(variant(ctx.Plugin, state.CurrentVariant))}
		required := state.Current != sig
		if c != nil && !c.Completed && (c.Attempted || state.Current == "") {
			required = true
			sources = append(sources, c.Devices)
		}
		c = &flashCycle{Signature: sig, VariantID: ctx.Variant.ID, BuildID: ctx.BuildID, Required: required, Devices: mergeDevices(ctx.Variant, sources...), ResetDone: map[string]string{}, FirmwareDone: map[string]string{}}
	}
	if c.BuildID != ctx.BuildID {
		c.BuildID = ctx.BuildID
		c.FirmwareDone = map[string]string{}
		if c.Receipt != nil && (!c.Receipt.Reset || c.Receipt.Consumed) {
			c.Receipt = nil
		}
	}
	p.Required = c.Required && !c.Completed
	p.ResetDevices = c.Devices
	if !p.Required {
		p.ResetDevices = devices(ctx.Variant)
	}
	p.FirmwareDone = c.FirmwareDone
	if p.Required {
		p.ResetDone = c.ResetDone
	}
	p.CanFlash = !p.Required || allDone(c.Devices, c.ResetDone)
	p.NeedsRebuild = p.Required && !p.CanFlash && !ctx.ResetAvailable
	if p.Required && !p.CanFlash {
		for _, d := range p.ResetDevices {
			if d.Controller != "" {
				if _, err := resetTarget(ctx, d); err != nil {
					p.NeedsRebuild = true
				}
			} else if ctx.ResetTargets != nil {
				for _, target := range ctx.Variant.Targets {
					if target.Kind == "settings-reset" && !ctx.ResetTargets[target.ID] {
						p.NeedsRebuild = true
					}
				}
			}
		}
	}
	if r := c.Receipt; r != nil && !r.Consumed && (r.Status == "sent" || r.Status == "unconfirmed") {
		p.Pending = &FlashAcknowledgement{BuildID: r.BuildID, ReceiptID: r.ID, DeviceID: r.DeviceID, Reset: r.Reset, Status: r.Status, Detail: r.Detail}
	}
	return c, p
}

func (s *TopologyStore) Plan(ctx Setup) (FlashPlan, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load(ctx)
	if err != nil {
		return FlashPlan{}, err
	}
	_, p := derive(ctx, state)
	return p, nil
}

// Declare is only available before any tracked device operation. A project
// import/build cannot declare that hardware has actually been reconfigured.
func (s *TopologyStore) Declare(ctx Setup, installedVariant string) (FlashPlan, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load(ctx)
	if err != nil {
		return FlashPlan{}, err
	}
	if !tracked(ctx.Variant) || state.Current != "" || state.Cycle != nil {
		return FlashPlan{}, fmt.Errorf("the installed setup has already been recorded")
	}
	checkpointSetup(&state)
	if installedVariant != "" {
		v := variant(ctx.Plugin, installedVariant)
		if !tracked(v) {
			return FlashPlan{}, fmt.Errorf("invalid installed setup")
		}
		state.Current, state.CurrentVariant = topology(v), v.ID
	} else {
		var sources [][]SetupDevice
		for _, v := range ctx.Plugin.Variants {
			if tracked(v) {
				sources = append(sources, devices(v))
			}
		}
		state.Cycle = &flashCycle{Signature: topology(ctx.Variant), VariantID: ctx.Variant.ID, BuildID: ctx.BuildID, Required: true, Devices: mergeDevices(ctx.Variant, sources...), ResetDone: map[string]string{}, FirmwareDone: map[string]string{}}
		// Multiple boards may have occupied a retired device's role. Ask which
		// physical controller is connected before selecting reset firmware.
		for i, device := range state.Cycle.Devices {
			controllers := map[string]bool{}
			for _, source := range sources {
				for _, d := range source {
					if d.ID == device.ID {
						controllers[d.Controller] = true
					}
				}
			}
			if device.Retired && len(controllers) > 1 {
				state.Cycle.Devices[i].Controller = ""
			}
		}
	}
	if err = s.save(ctx, state); err != nil {
		return FlashPlan{}, err
	}
	_, p := derive(ctx, state)
	return p, nil
}

// Forget handles external/manual flashing: unknown hardware requires a full
// reset, rather than an editable claim that can bypass an active migration.
func (s *TopologyStore) Forget(ctx Setup) (FlashPlan, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load(ctx)
	if err != nil {
		return FlashPlan{}, err
	}
	if !tracked(ctx.Variant) {
		return FlashPlan{}, fmt.Errorf("this profile does not track topology changes")
	}
	checkpointSetup(&state)
	var sources [][]SetupDevice
	for _, v := range ctx.Plugin.Variants {
		if tracked(v) {
			sources = append(sources, devices(v))
		}
	}
	state.Current, state.CurrentVariant = "", ""
	state.Cycle = &flashCycle{Signature: topology(ctx.Variant), VariantID: ctx.Variant.ID, BuildID: ctx.BuildID, Required: true, Devices: mergeDevices(ctx.Variant, sources...), ResetDone: map[string]string{}, FirmwareDone: map[string]string{}}
	// Multiple boards may have occupied a retired device's role. Ask which
	// physical controller is connected before selecting reset firmware.
	for i, device := range state.Cycle.Devices {
		controllers := map[string]bool{}
		for _, source := range sources {
			for _, d := range source {
				if d.ID == device.ID {
					controllers[d.Controller] = true
				}
			}
		}
		if device.Retired && len(controllers) > 1 {
			state.Cycle.Devices[i].Controller = ""
		}
	}
	if err = s.save(ctx, state); err != nil {
		return FlashPlan{}, err
	}
	_, p := derive(ctx, state)
	return p, nil
}

// Begin persists the possible hardware change BEFORE any USB write. Required
// cleanup is enforced here as well as in the UI, including history builds.
func (s *TopologyStore) Begin(ctx Setup, deviceID string, reset bool) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load(ctx)
	if err != nil {
		return "", err
	}
	c, p := derive(ctx, state)
	if !p.Supported {
		return "", nil
	}
	if p.NeedsSetup {
		return "", fmt.Errorf("select the installed keyboard setup before flashing")
	}
	if p.Pending != nil && (p.Pending.DeviceID != deviceID || p.Pending.Reset != reset) && !(reset && !p.Pending.Reset) {
		return "", fmt.Errorf("acknowledge the previous transfer before starting another device")
	}
	if !reset && !p.CanFlash {
		return "", fmt.Errorf("changing the central requires resetting and acknowledging every device before keyboard firmware")
	}
	list := devices(ctx.Variant)
	if reset {
		if !ctx.ResetAvailable {
			return "", fmt.Errorf("this build has no reset firmware; rebuild before migrating")
		}
		if !c.Required || c.Completed {
			c.Devices = devices(ctx.Variant)
		}
		list = c.Devices
	}
	found := false
	for _, d := range list {
		if d.ID == deviceID {
			found = true
			if reset {
				if _, err := resetTarget(ctx, d); err != nil {
					return "", err
				}
			}
		}
	}
	if !found {
		return "", fmt.Errorf("device does not belong to this flash step")
	}
	if reset {
		if !c.Required || c.Completed || c.FirmwareStarted {
			c.ResetDone, c.FirmwareDone = map[string]string{}, map[string]string{}
			c.FirmwareStarted = false
		}
		c.Required, c.Completed = true, false
		delete(c.ResetDone, deviceID)
	} else {
		c.FirmwareStarted = true
		delete(c.FirmwareDone, deviceID)
	}
	c.Attempted = true
	state.BeforeSetup = nil
	token := rand.Text()
	c.Receipt = &transferReceipt{ID: token, BuildID: ctx.BuildID, DeviceID: deviceID, Reset: reset, Status: "pending"}
	state.Cycle = c
	if err = s.save(ctx, state); err != nil {
		return "", err
	}
	return token, nil
}

func complete(ctx Setup, state *topologyState) {
	c := state.Cycle
	if allDone(devices(ctx.Variant), c.FirmwareDone) {
		c.Completed = true
		state.Current, state.CurrentVariant = c.Signature, ctx.Variant.ID
	}
}
func (s *TopologyStore) Finish(ctx Setup, token string, result Result, copyError error) error {
	if token == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load(ctx)
	if err != nil {
		return err
	}
	if state.Cycle == nil || state.Cycle.Receipt == nil || state.Cycle.Receipt.ID != token {
		return fmt.Errorf("flash workflow changed during the transfer")
	}
	r := state.Cycle.Receipt
	r.Status = result.Status
	r.Detail = result.Detail
	if copyError != nil || (r.Status != "sent" && r.Status != "unconfirmed") {
		r.Status = "failed"
	}
	if !r.Reset && r.Status == "sent" {
		state.Cycle.FirmwareDone[r.DeviceID] = "sent"
		r.Consumed = true
		complete(ctx, &state)
	}
	return s.save(ctx, state)
}
func (s *TopologyStore) Acknowledge(ctx Setup, token string) (FlashPlan, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load(ctx)
	if err != nil {
		return FlashPlan{}, err
	}
	if state.Cycle == nil || state.Cycle.Receipt == nil {
		return FlashPlan{}, fmt.Errorf("no transfer is available for acknowledgement")
	}
	r := state.Cycle.Receipt
	if token == "" || r.ID != token || r.BuildID != ctx.BuildID || (r.Status != "sent" && r.Status != "unconfirmed") {
		return FlashPlan{}, fmt.Errorf("only a completed or uncertain final write can be acknowledged")
	}
	if !r.Consumed {
		if r.Reset {
			state.Cycle.ResetDone[r.DeviceID] = "confirmed"
		} else {
			state.Cycle.FirmwareDone[r.DeviceID] = "confirmed"
			complete(ctx, &state)
		}
		r.Consumed = true
		if err = s.save(ctx, state); err != nil {
			return FlashPlan{}, err
		}
	}
	_, p := derive(ctx, state)
	return p, nil
}

// SetResetController identifies a retired device whose controller cannot be
// inferred after an external flash. It never acknowledges a transfer.
func (s *TopologyStore) SetResetController(ctx Setup, deviceID, controllerID string) (FlashPlan, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load(ctx)
	if err != nil {
		return FlashPlan{}, err
	}
	c, p := derive(ctx, state)
	if c == nil || p.NeedsSetup || !p.Required || c.FirmwareStarted {
		return FlashPlan{}, fmt.Errorf("controller selection is only available during required cleanup")
	}
	for i, d := range c.Devices {
		if d.ID != deviceID {
			continue
		}
		if !d.Retired || c.ResetDone[d.ID] != "" || (c.Receipt != nil && c.Receipt.DeviceID == d.ID) {
			return FlashPlan{}, fmt.Errorf("this controller cannot be changed during its transfer")
		}
		d.Controller = controllerID
		if _, err := resetTarget(ctx, d); err != nil {
			return FlashPlan{}, err
		}
		c.Devices[i] = d
		state.Cycle = c
		if err := s.save(ctx, state); err != nil {
			return FlashPlan{}, err
		}
		_, p = derive(ctx, state)
		return p, nil
	}
	return FlashPlan{}, fmt.Errorf("device does not belong to this reset step")
}
