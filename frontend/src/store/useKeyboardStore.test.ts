import { beforeEach, describe, expect, it } from "vitest";
import { fixture } from "../test/fixtures";
import { action } from "../types/keyboard";
import {
  content,
  displayCode,
  isDirty,
  layerReference,
  useKeyboardStore,
} from "./useKeyboardStore";
const state = () => useKeyboardStore.getState();
beforeEach(() => state().initialize(fixture()));
describe("keyboard snapshots", () => {
  it("restores an unsaved project's opening state without marking it as saved", () => {
    const session = fixture();
    session.hasSaved = false;
    session.project.revision = "";
    session.project.savedAt = "";
    state().initialize(session);
    expect(isDirty(state().project, state().initialProject)).toBe(false);
    state().updateKeyCode(0, "&kp Z");
    state().addLayer();
    state().edit((p) => {
      p.options.tappingTermMs = 450;
      p.layout.macros.push({
        id: "zm_test",
        name: "Test",
        tapMs: 20,
        waitMs: 20,
        steps: [{ kind: "tap", binding: "&kp C", durationMs: 0 }],
      });
    });
    state().selectAction(action("&zm_test"));
    expect(isDirty(state().project, state().initialProject)).toBe(true);
    state().undoChanges();
    expect(state().project).toEqual(session.project);
    expect(state().savedProject).toBeNull();
    expect(state().selectedAction).toBeNull();
    expect(state().activeLayerId).toBe("base");
    expect(isDirty(state().project, state().initialProject)).toBe(false);
  });
  it("discards edits in an imported unsaved project back to its own contents instead of the plugin template", () => {
    const session = fixture();
    session.hasSaved = false;
    session.project.layout.layers[0].name = "Imported";
    session.project.layout.layers[0].keys[0].code = "&kp X";
    state().initialize(session);
    useKeyboardStore.setState({ template: fixture().project });
    state().updateKeyCode(0, "&kp Y");
    state().undoChanges();
    expect(state().project!.layout.layers[0].keys[0].code).toBe("&kp X");
    expect(state().project!.layout.layers[0].name).toBe("Imported");
    expect(state().savedProject).toBeNull();
  });
  it("keeps saved data immutable through key edits and discards", () => {
    state().updateKeyCode(0, "&kp C");
    expect(state().savedProject!.layout.layers[0].keys[0].code).toBe("&kp A");
    expect(isDirty(state().project, state().savedProject)).toBe(true);
    state().undoChanges();
    expect(state().project!.layout.layers[0].keys[0].code).toBe("&kp A");
    expect(isDirty(state().project, state().savedProject)).toBe(false);
  });
  it("preserves edits made while a save is in flight", () => {
    state().updateKeyCode(0, "&kp C");
    const saving = structuredClone(state().project!);
    state().updateKeyCode(1, "&kp D");
    state().markSaved({ ...saving, revision: "saved2" });
    expect(state().project!.layout.layers[0].keys[1].code).toBe("&kp D");
    expect(state().savedProject!.layout.layers[0].keys[1].code).toBe("&kp B");
    expect(isDirty(state().project, state().savedProject)).toBe(true);
  });
  it("clamps active layer when discarding a newly added layer", () => {
    state().addLayer();
    expect(state().activeLayerId).not.toBe("base");
    state().undoChanges();
    expect(state().activeLayerId).toBe("base");
  });
  it("synchronizes encoder click in both directions without changing saved state", () => {
    const s = fixture();
    s.project.layout.layers[0].sensors = [
      {
        id: "encoder",
        label: "Encoder",
        codeCW: "&kp C",
        codeCCW: "&kp D",
        codeClick: "&kp A",
        clickKeymapIndex: 0,
      },
    ];
    state().initialize(s);
    state().updateSensorCode("encoder", "click", "&kp E");
    expect(state().project!.layout.layers[0].keys[0].code).toBe("&kp E");
    state().updateKeyCode(0, "&kp F");
    expect(state().project!.layout.layers[0].sensors[0].codeClick).toBe("&kp F");
    expect(state().savedProject!.layout.layers[0].sensors[0].codeClick).toBe("&kp A");
  });
});
describe("stable references", () => {
  it("clears a selected resource when it is deleted before assignment", () => {
    state().edit((p) => {
      p.layout.macros.push({
        id: "zm_unassigned",
        name: "Temporary",
        tapMs: 20,
        waitMs: 20,
        steps: [{ kind: "tap", binding: "&kp A", durationMs: 0 }],
      });
    });
    state().selectAction(action("&zm_unassigned"));
    state().removeResource("macros", "zm_unassigned");
    expect(state().selectedAction).toBeNull();
    expect(state().project!.layout.macros).toHaveLength(0);
  });
  it("keeps the layer target when reordered and blocks deleting it while referenced", () => {
    state().addLayer();
    const id = state().activeLayerId;
    state().setActiveLayer("base");
    state().updateKeyCode(0, `&mo ${layerReference(id)}`);
    state().reorderLayers(1, 0);
    expect(displayCode(state().project!.layout.layers[1].keys[0].code, state().project)).toBe(
      "&mo 0",
    );
    state().removeLayer(0);
    expect(state().project!.layout.layers).toHaveLength(2);
    expect(state().error).toContain("is used");
  });
  it("blocks deleting referenced resources and allows deleting unused ones", () => {
    state().edit((p) => {
      p.layout.macros.push({
        id: "zm_macro",
        name: "Macro",
        tapMs: 0,
        waitMs: 0,
        steps: [{ kind: "tap", binding: "&kp A", durationMs: 0 }],
      });
    });
    state().updateKeyCode(0, "&zm_macro");
    state().removeResource("macros", "zm_macro");
    expect(state().project!.layout.macros).toHaveLength(1);
    state().updateKeyCode(0, "&kp A");
    state().removeResource("macros", "zm_macro");
    expect(state().project!.layout.macros).toHaveLength(0);
  });
  it("distinguishes restoring the template from clearing bindings", () => {
    useKeyboardStore.setState({ template: fixture().project });
    state().updateKeyCode(0, "&kp Z");
    state().resetLayer(0);
    expect(state().project!.layout.layers[0].keys[0].code).toBe("&kp A");
    state().clearLayer(0);
    expect(state().project!.layout.layers[0].keys[0].code).toBe("&trans");
  });
  it("ignores persistence metadata when detecting edits", () => {
    const p = state().project!;
    expect(content({ ...p, revision: "new", savedAt: "now" })).toBe(content(p));
  });
});

it("migrates legacy projects without conflating their historical settings with new defaults", () => {
  const session = fixture();
  session.project.schemaVersion = 1;
  delete session.project.options.modTap;
  delete session.project.options.layerTap;
  session.project.options.flavor = "balanced";
  session.project.options.tappingTermMs = 310;
  state().initialize(session);
  expect(state().project!.schemaVersion).toBe(2);
  expect(state().project!.options.modTap).toEqual({
    tappingTermMs: 310,
    quickTapMs: 0,
    flavor: "balanced",
  });
  expect(state().project!.options.layerTap).toEqual(state().project!.options.modTap);
  expect(session.project.schemaVersion).toBe(1);
});

it("normalizes numeric layer arguments routed through macros and blocks deletion of used layers", () => {
  state().edit((p) => {
    p.layout.layers.push({ ...structuredClone(p.layout.layers[0]), id: "nav", name: "Nav" });
    p.layout.macros.push({
      id: "zm_param_layer",
      name: "Layer",
      parameterCount: 1,
      tapMs: 0,
      waitMs: 0,
      steps: [
        { kind: "control", binding: "&macro_param_1to1", durationMs: 0 },
        { kind: "press", binding: "&mo MACRO_PLACEHOLDER", durationMs: 0 },
      ],
    });
  });
  state().updateKeyCode(0, "&zm_param_layer 1");
  expect(state().project!.layout.layers[0].keys[0].code).toBe("&zm_param_layer @{nav}");
  state().reorderLayers(1, 0);
  expect(displayCode(state().project!.layout.layers[1].keys[0].code, state().project)).toBe(
    "&zm_param_layer 0",
  );
  state().removeLayer(0);
  expect(state().error).toContain("is used");
  expect(state().project!.layout.layers).toHaveLength(2);
});

it("assigning an encoder rotation replaces its inherited binding", () => {
  const session = fixture();
  session.project.layout.layers[0].sensors = [
    {
      id: "encoder",
      label: "Encoder",
      codeCW: "&trans",
      codeCCW: "&trans",
      codeClick: "&kp A",
      clickKeymapIndex: 0,
      inherited: true,
    },
  ];
  useKeyboardStore.getState().initialize(session);
  useKeyboardStore.getState().updateSensorCode("encoder", "cw", "&kp C_VOL_UP");
  const sensor = useKeyboardStore.getState().project!.layout.layers[0].sensors[0];
  expect(sensor.inherited).toBe(false);
  expect(sensor.codeCW).toBe("&kp C_VOL_UP");
  expect(useKeyboardStore.getState().initialProject!.layout.layers[0].sensors[0].inherited).toBe(
    true,
  );
});

it("does not mark saved firmware settings dirty when Go omits empty values", () => {
  const current = fixture().project;
  current.extraConfig = "";
  current.headers = {};
  current.buildTargets = [{ targetId: "left", snippets: [], cmakeArgs: [] }];
  current.options.softOff = false;
  current.layout.layers[0].sensors = [
    {
      id: "encoder",
      label: "Encoder",
      codeCW: "&kp A",
      codeCCW: "&kp B",
      codeClick: "&kp A",
      clickKeymapIndex: 0,
      inherited: false,
    },
  ];
  const saved = structuredClone(current);
  delete saved.extraConfig;
  delete saved.headers;
  delete saved.options.softOff;
  delete saved.buildTargets![0].snippets;
  delete saved.buildTargets![0].cmakeArgs;
  delete saved.layout.layers[0].sensors[0].inherited;
  expect(isDirty(current, saved)).toBe(false);
  current.buildTargets[0].snippets = ["studio-rpc-usb-uart"];
  expect(isDirty(current, saved)).toBe(true);
});

it("rejects invalid assignment before touching the current or saved layout", () => {
  const before = structuredClone(state().project);
  state().updateKeyCode(0, "fdsfsd");
  expect(state().project).toEqual(before);
  expect(state().error).toContain("ZMK action");
  state().updateKeyCode(0, "&kp UNKNOWN_KEY");
  expect(state().project).toEqual(before);
  expect(state().error).toContain("Unknown code");
});
