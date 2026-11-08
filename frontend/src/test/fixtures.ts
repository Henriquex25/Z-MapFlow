import type { Project, Plugin, Session } from "../types/keyboard";
export function fixture(): Session {
  const plugin: Plugin = {
    contractVersion: 1,
    files: {},
    modules: [],
    bindingArities: {},
    actions: [],
    id: "test",
    version: "1",
    name: "Test keyboard",
    keymapName: "test",
    keyCount: 2,
    width: 3,
    height: 2,
    positions: [
      {
        id: "a",
        keymapIndex: 0,
        x: 0,
        y: 0,
        rotation: 0,
        width: 1,
        height: 1,
        sensorId: "",
      },
      {
        id: "b",
        keymapIndex: 1,
        x: 1,
        y: 0,
        rotation: 0,
        width: 1,
        height: 1,
        sensorId: "",
      },
    ],
    sensors: [],
    variants: [
      {
        id: "test",
        name: "Test board",
        zmkRevision: "",
        buildImage: "",
        targets: [
          {
            id: "left",
            name: "Esquerda",
            board: "test",
            shield: "test_left",
            artifact: "left.uf2",
          },
        ],
        bootloaderBoards: ["test"],
        uf2Family: 0,
        instructions: "Test instructions",
      },
    ],
    zmkRevision: "v0.3.0",
    buildImage: "test",
    config: "",
    overlay: "",
    capabilities: [],
  };
  const project: Project = {
    schemaVersion: 1,
    pluginId: "test",
    pluginVersion: "1",
    variantId: "test",
    revision: "saved1",
    savedAt: "2026-10-28",
    layout: {
      name: "Test keyboard",
      layers: [
        {
          id: "base",
          name: "Base",
          keys: [
            { keymapIndex: 0, row: 0, col: 0, code: "&kp A", label: "A" },
            { keymapIndex: 1, row: 0, col: 1, code: "&kp B", label: "B" },
          ],
          sensors: [],
        },
      ],
      macros: [],
      combos: [],
      behaviors: [],
    },
    options: {
      locale: "us",
      display: false,
      pointing: true,
      tappingTermMs: 200,
      quickTapMs: 0,
      flavor: "balanced",
      bluetoothProfiles: 5,
      sleep: true,
      sleepTimeoutMs: 900000,
    },
  };
  return { project, plugin, hasSaved: true };
}
