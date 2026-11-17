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
	ID      string `json:"id"`
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	Retired bool   `json:"retired"`
	Family  uint32 `json:"family"`
}
type FlashPlan struct {
	Supported    bool                  `json:"supported"`
	NeedsSetup   bool                  `json:"needsSetup"`
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
}
type TopologyStore struct {
	Root string
	mu   sync.Mutex
}
type topologyState struct {
	Version        int         `json:"version"`
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
func topology(v models.Variant) string {
	var roles []string
	for _, t := range v.Targets {
		if t.Kind != "settings-reset" {
			roles = append(roles, t.ID+":"+t.Role+":"+t.Kind)
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
func devices(v models.Variant) []SetupDevice {
	var list []SetupDevice
	for _, t := range v.Targets {
		if t.Kind != "settings-reset" {
			list = append(list, SetupDevice{ID: t.ID, Name: t.Name, Kind: t.Kind, Family: v.UF2Family})
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
	if state.Cycle != nil {
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

func derive(ctx Setup, state topologyState) (*flashCycle, FlashPlan) {
	p := FlashPlan{Supported: tracked(ctx.Variant), CanFlash: true, To: topologyName(ctx.Variant), Options: []SetupOption{}, ResetDevices: []SetupDevice{}, ResetDone: map[string]string{}, FirmwareDone: map[string]string{}}
	if !p.Supported {
		return nil, p
	}
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
	var sources [][]SetupDevice
	for _, v := range ctx.Plugin.Variants {
		if tracked(v) {
			sources = append(sources, devices(v))
		}
	}
	state.Current, state.CurrentVariant = "", ""
	state.Cycle = &flashCycle{Signature: topology(ctx.Variant), VariantID: ctx.Variant.ID, BuildID: ctx.BuildID, Required: true, Devices: mergeDevices(ctx.Variant, sources...), ResetDone: map[string]string{}, FirmwareDone: map[string]string{}}
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
			if reset && d.Family != ctx.Variant.UF2Family {
				return "", fmt.Errorf("the retired device needs a compatible reset firmware")
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
