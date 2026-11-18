package flash

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"z-mapflow/internal/devices/soflev2"
)

func setupFor(id, build string) Setup {
	p := soflev2.NewDevice().Descriptor()
	return Setup{Plugin: p, Variant: variant(p, id), BuildID: build, ResetAvailable: true}
}
func mustPlan(t *testing.T, s *TopologyStore, ctx Setup) FlashPlan {
	t.Helper()
	p, err := s.Plan(ctx)
	if err != nil {
		t.Fatal(err)
	}
	return p
}
func transfer(t *testing.T, s *TopologyStore, ctx Setup, id string, reset, ack bool, status string) string {
	t.Helper()
	token, err := s.Begin(ctx, id, reset)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Finish(ctx, token, Result{Status: status, Detail: "test final write"}, nil); err != nil {
		t.Fatal(err)
	}
	if ack {
		if _, err = s.Acknowledge(ctx, token); err != nil {
			t.Fatal(err)
		}
	}
	return token
}
func resetDevices(t *testing.T, s *TopologyStore, ctx Setup) {
	t.Helper()
	for _, d := range mustPlan(t, s, ctx).ResetDevices {
		transfer(t, s, ctx, d.ID, true, true, "sent")
	}
}

func TestMigrationRequiresEveryResetAndPersistsInBothDirections(t *testing.T) {
	root := t.TempDir()
	s := &TopologyStore{Root: root}
	dongle := setupFor("nice_nano_v2_dongle", "dongle-build")
	if p := mustPlan(t, s, dongle); !p.NeedsSetup || p.CanFlash {
		t.Fatal("unknown hardware was inferred from editor/build")
	}
	if _, err := s.Begin(dongle, "dongle", false); err == nil {
		t.Fatal("unknown setup bypass")
	}
	p, err := s.Declare(dongle, "nice_nano_v2")
	if err != nil {
		t.Fatal(err)
	}
	if !p.Required || p.CanFlash || len(p.ResetDevices) != 3 {
		t.Fatal("missing three-device migration", p)
	}
	if _, err = s.Begin(dongle, "left", false); err == nil {
		t.Fatal("firmware bypassed mandatory cleanup")
	}
	for i, d := range p.ResetDevices {
		token := transfer(t, s, dongle, d.ID, true, false, "sent")
		p = mustPlan(t, s, dongle)
		if p.CanFlash || p.ResetDone[d.ID] != "" || p.Pending == nil {
			t.Fatal("host copy silently acknowledged reset")
		}
		s = &TopologyStore{Root: root} // Reopening the app retains receipt/progress.
		if _, err = s.Acknowledge(dongle, token); err != nil {
			t.Fatal(err)
		}
		p = mustPlan(t, s, dongle)
		if p.CanFlash != (i == 2) {
			t.Fatal("gate opened before all three acknowledgements")
		}
	}
	for _, id := range []string{"dongle", "left", "right"} {
		if id == "dongle" {
			transfer(t, s, dongle, id, false, true, "unconfirmed")
		} else {
			transfer(t, s, dongle, id, false, false, "sent")
		}
	}
	if p = mustPlan(t, s, dongle); p.Required || !p.CanFlash {
		t.Fatal("completed migration not recorded")
	}
	daily := dongle
	daily.BuildID = "new-keymap"
	if p = mustPlan(t, s, daily); p.Required || !p.CanFlash || len(p.FirmwareDone) != 0 {
		t.Fatal("ordinary update required reset or reused old firmware progress")
	}
	transfer(t, s, daily, "dongle", false, false, "sent")
	normal := setupFor("nice_nano_v2", "normal-build")
	p = mustPlan(t, s, normal)
	if !p.Required || p.CanFlash || len(p.ResetDevices) != 3 {
		t.Fatal("return migration did not require all three resets")
	}
	retired := false
	for _, d := range p.ResetDevices {
		if d.ID == "dongle" {
			retired = d.Retired
		}
	}
	if !retired {
		t.Fatal("old dongle not marked reset-only")
	}
	resetDevices(t, s, normal)
	if _, err = s.Begin(normal, "dongle", false); err == nil {
		t.Fatal("normal firmware sent to retired dongle")
	}
	for _, id := range []string{"left", "right"} {
		transfer(t, s, normal, id, false, false, "sent")
	}
	legacy := setupFor("nice_nano_v2_legacy", "legacy-build")
	if p = mustPlan(t, s, legacy); p.Required || !p.CanFlash {
		t.Fatal("toolchain alias was mistaken for a central-role change")
	}
}

func TestResetReceiptsRequireActualFinishedWritesAndCannotBeReplayed(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("nice_nano_v2_dongle", "build")
	if _, err := s.Declare(ctx, ""); err != nil {
		t.Fatal(err)
	}
	token, err := s.Begin(ctx, "left", true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Acknowledge(ctx, token); err == nil {
		t.Fatal("pending write acknowledged")
	}
	if err = s.Finish(ctx, token, Result{}, errors.New("interrupted copy")); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Acknowledge(ctx, token); err == nil {
		t.Fatal("interrupted copy acknowledged")
	}
	token = transfer(t, s, ctx, "left", true, false, "unconfirmed")
	if p := mustPlan(t, s, ctx); p.ResetDone["left"] != "" || p.CanFlash {
		t.Fatal("uncertain write acknowledged automatically")
	}
	if _, err = s.Acknowledge(ctx, "invented"); err == nil {
		t.Fatal("invented receipt accepted")
	}
	other := ctx
	other.BuildID = "other-build"
	if _, err = s.Acknowledge(other, token); err == nil {
		t.Fatal("receipt acknowledged through another build")
	}
	if _, err = s.Begin(ctx, "right", true); err == nil {
		t.Fatal("previous acknowledgement was silently discarded")
	}
	if _, err = s.Acknowledge(ctx, token); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Acknowledge(ctx, token); err != nil {
		t.Fatal("idempotent acknowledgement failed", err)
	}
	transfer(t, s, ctx, "right", true, true, "sent")
	if _, err = s.Acknowledge(ctx, token); err == nil {
		t.Fatal("old receipt changed a newer operation")
	}
}

func TestPartialMigrationRebuildImportHistoryAndExternalChanges(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("nice_nano_v2_dongle", "first")
	if _, err := s.Declare(ctx, "nice_nano_v2"); err != nil {
		t.Fatal(err)
	}
	token := transfer(t, s, ctx, "dongle", true, false, "sent")
	newBuild := ctx
	newBuild.BuildID = "recompiled"
	if p := mustPlan(t, s, newBuild); p.Pending == nil || p.Pending.ReceiptID != token || p.Pending.BuildID != ctx.BuildID {
		t.Fatal("reset acknowledgement lost after recompile")
	}
	if _, err := s.Acknowledge(ctx, token); err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"left", "right"} {
		transfer(t, s, newBuild, id, true, true, "sent")
	}
	transfer(t, s, newBuild, "dongle", false, false, "sent")
	newer := ctx
	newer.BuildID = "newer"
	if p := mustPlan(t, s, newer); !p.CanFlash || len(p.ResetDone) != 3 || len(p.FirmwareDone) != 0 {
		t.Fatal("rebuild lost reset progress or retained stale firmware transfers")
	}
	if _, err := s.Declare(ctx, "nice_nano_v2_dongle"); err == nil {
		t.Fatal("import/current-setup claim bypassed active migration")
	}
	back := setupFor("nice_nano_v2", "old-history-build")
	back.ResetAvailable = false
	p := mustPlan(t, s, back)
	if !p.Required || !p.NeedsRebuild || p.CanFlash {
		t.Fatal("old history without reset artifact bypassed partial migration")
	}
	if _, err := s.Begin(back, "left", false); err == nil {
		t.Fatal("old firmware API bypassed cleanup")
	}
	back.ResetAvailable = true
	resetDevices(t, s, back)
	for _, id := range []string{"left", "right"} {
		transfer(t, s, back, id, false, false, "sent")
	}
	p, err := s.Forget(back)
	if err != nil {
		t.Fatal(err)
	}
	if !p.Required || p.CanFlash || len(p.ResetDevices) != 3 {
		t.Fatal("external changes did not invalidate physical-state assumptions")
	}
}

func TestWorkflowStorageFailurePreventsWrites(t *testing.T) {
	root := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(root, []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	s := &TopologyStore{Root: root}
	ctx := setupFor("nice_nano_v2_dongle", "build")
	if _, err := s.Begin(ctx, "left", false); err == nil {
		t.Fatal("storage failure allowed a write")
	}
}

func TestStartingManualResetMakesTheRemainingCleanupRequired(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("nice_nano_v2", "normal")
	if _, err := s.Declare(ctx, "nice_nano_v2"); err != nil {
		t.Fatal(err)
	}
	if p := mustPlan(t, s, ctx); p.Required || !p.CanFlash {
		t.Fatal("normal update required a reset")
	}
	transfer(t, s, ctx, "left", true, true, "sent")
	if p := mustPlan(t, s, ctx); !p.Required || p.CanFlash || len(p.ResetDevices) != 2 {
		t.Fatal("partial manual reset was optional")
	}
	if _, err := s.Begin(ctx, "left", false); err == nil {
		t.Fatal("manual reset bypassed the remaining device")
	}
	transfer(t, s, ctx, "right", true, true, "sent")
	if p := mustPlan(t, s, ctx); !p.CanFlash {
		t.Fatal("completed manual cleanup stayed locked")
	}
}

func TestResetCanRecoverAnUncertainFirmwareWithoutClaimingKeyboardOperation(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("nice_nano_v2_dongle", "recover")
	if _, err := s.Declare(ctx, ""); err != nil {
		t.Fatal(err)
	}
	resetDevices(t, s, ctx)
	old := transfer(t, s, ctx, "left", false, false, "unconfirmed")
	transfer(t, s, ctx, "right", true, true, "sent")
	p := mustPlan(t, s, ctx)
	if p.CanFlash || len(p.ResetDone) != 1 || len(p.FirmwareDone) != 0 {
		t.Fatal("recovery reset reused stale acknowledgements")
	}
	if _, err := s.Acknowledge(ctx, old); err == nil {
		t.Fatal("old uncertain firmware receipt was replayed during recovery")
	}
}

func TestMixedControllerResetRoutesAndReturn(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("xiao_ble_dongle", "mixed")
	p, err := s.Declare(ctx, "nice_nano_v2")
	if err != nil || !p.Required {
		t.Fatalf("missing migration: %+v %v", p, err)
	}
	for _, id := range []string{"dongle", "left", "right"} {
		target, err := s.ResetTarget(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		expected := "settings_reset"
		if id == "dongle" {
			expected = "settings_reset_xiao"
		}
		if target.ID != expected {
			t.Fatalf("%s received %s instead of %s", id, target.ID, expected)
		}
	}
	resetDevices(t, s, ctx)
	for _, id := range []string{"dongle", "left", "right"} {
		transfer(t, s, ctx, id, false, false, "sent")
	}
	back := setupFor("nice_nano_v2", "back")
	p = mustPlan(t, s, back)
	if !p.Required || p.CanFlash {
		t.Fatal("mixed-controller return bypassed cleanup")
	}
	target, err := s.ResetTarget(back, "dongle")
	if err != nil || target.ID != "settings_reset_xiao" {
		t.Fatalf("retired XIAO got wrong reset: %+v %v", target, err)
	}
	legacy := setupFor("nice_nano_v2_legacy", "legacy")
	if _, err := s.ResetTarget(legacy, "dongle"); err == nil {
		t.Fatal("legacy profile substituted nice!nano reset for retired XIAO")
	}
	resetDevices(t, s, back)
	if !mustPlan(t, s, back).CanFlash {
		t.Fatal("return did not unlock after correct resets")
	}
}
func TestChangingDongleControllerRequiresCleanupEvenWithSameRoles(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("nice_nano_v2_dongle", "nice")
	if _, err := s.Declare(ctx, "nice_nano_v2_dongle"); err != nil {
		t.Fatal(err)
	}
	mixed := setupFor("xiao_ble_dongle", "xiao")
	if p := mustPlan(t, s, mixed); !p.Required || p.CanFlash {
		t.Fatal("controller replacement did not invalidate installed identity")
	}
}
func TestUnknownRetiredDongleMustBeIdentifiedBeforeReset(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("nice_nano_v2", "normal")
	if _, err := s.Declare(ctx, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Begin(ctx, "dongle", true); err == nil {
		t.Fatal("unknown retired controller received guessed reset")
	}
	if _, err := s.SetResetController(ctx, "dongle", "unavailable"); err == nil {
		t.Fatal("unsupported reset identity accepted")
	}
	if _, err := s.SetResetController(ctx, "left", "xiao_ble"); err == nil {
		t.Fatal("operational controller changed without matching build")
	}
	if _, err := s.SetResetController(ctx, "dongle", "xiao_ble"); err != nil {
		t.Fatal(err)
	}
	selected, err := s.ResetTarget(ctx, "dongle")
	if err != nil || selected.ID != "settings_reset_xiao" {
		t.Fatal("selection not persisted", selected, err)
	}
	token := transfer(t, s, ctx, "dongle", true, false, "sent")
	if _, err := s.SetResetController(ctx, "dongle", "nice_nano_v2"); err == nil {
		t.Fatal("pending reset receipt changed controller")
	}
	if _, err := s.Acknowledge(ctx, token); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetResetController(ctx, "dongle", "nice_nano_v2"); err == nil {
		t.Fatal("acknowledged reset reassigned to another board")
	}
}
func TestExistingWorkflowSignatureUpgradeKeepsPairing(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("nice_nano_v2_dongle", "old")
	state := topologyState{Version: 1, Current: topologySignature(ctx.Variant, false), CurrentVariant: ctx.Variant.ID}
	if err := s.save(ctx, state); err != nil {
		t.Fatal(err)
	}
	if p := mustPlan(t, s, ctx); p.Required || !p.CanFlash {
		t.Fatal("adding controller metadata forced existing users to reset")
	}
	mixed := setupFor("xiao_ble_dongle", "new")
	if p := mustPlan(t, s, mixed); !p.Required {
		t.Fatal("legacy signature upgrade accepted different dongle controller")
	}
}
func TestHistoricalBuildRequiresItsControllerSpecificResetArtifact(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("xiao_ble_dongle", "old-build")
	ctx.ResetTargets = map[string]bool{"settings_reset": true}
	if _, err := s.Declare(ctx, "nice_nano_v2"); err != nil {
		t.Fatal(err)
	}
	if p := mustPlan(t, s, ctx); !p.NeedsRebuild {
		t.Fatal("incomplete historical artifacts accepted")
	}
	if _, err := s.ResetTarget(ctx, "dongle"); err == nil {
		t.Fatal("missing XIAO reset image substituted")
	}
	if _, err := s.Begin(ctx, "dongle", true); err == nil {
		t.Fatal("missing artifact entered reset workflow")
	}
}
func TestExistingPendingResetReceiptSurvivesControllerMetadataUpgrade(t *testing.T) {
	s := &TopologyStore{Root: t.TempDir()}
	ctx := setupFor("nice_nano_v2_dongle", "old")
	if _, err := s.Declare(ctx, "nice_nano_v2"); err != nil {
		t.Fatal(err)
	}
	token := transfer(t, s, ctx, "dongle", true, false, "sent")
	state, err := s.load(ctx)
	if err != nil {
		t.Fatal(err)
	}
	state.Current = topologySignature(variant(ctx.Plugin, state.CurrentVariant), false)
	state.Cycle.Signature = topologySignature(ctx.Variant, false)
	for i := range state.Cycle.Devices {
		state.Cycle.Devices[i].Controller = ""
	}
	if err := s.save(ctx, state); err != nil {
		t.Fatal(err)
	}
	p := mustPlan(t, s, ctx)
	if p.Pending == nil || p.Pending.ReceiptID != token || p.CanFlash || p.NeedsRebuild {
		t.Fatal("pending workflow lost on metadata upgrade", p)
	}
	if target, err := s.ResetTarget(ctx, "dongle"); err != nil || target.ID != "settings_reset" {
		t.Fatal("old reset controller not recovered", target, err)
	}
	if _, err := s.Acknowledge(ctx, token); err != nil {
		t.Fatal(err)
	}
	if p := mustPlan(t, s, ctx); p.ResetDone["dongle"] != "confirmed" {
		t.Fatal("old reset acknowledgement lost")
	}
}
