import { fixture } from "./fixtures";
import type { Build } from "../types/keyboard";
export function dongleFixture() {
  const session = fixture();
  const original = session.plugin.variants[0];
  original.targets[0].role = "central";
  original.targets.push({
    ...original.targets[0],
    id: "right",
    name: "Right",
    role: "peripheral",
    shield: "right",
    artifact: "right.uf2",
  });
  session.plugin.variants.push({
    ...structuredClone(original),
    id: "dongle",
    name: "USB dongle central",
    features: ["peripheral-status-sync"],
    targets: [
      {
        ...original.targets[0],
        id: "dongle",
        name: "USB dongle",
        kind: "dongle",
        role: "central",
        shield: "test_dongle",
        artifact: "dongle.uf2",
        config: { CONFIG_ZMK_SPLIT_ROLE_CENTRAL: "y" },
      },
      ...original.targets.map((t) => ({
        ...t,
        role: "peripheral",
        config: { CONFIG_ZMK_SPLIT_ROLE_CENTRAL: "n" },
      })),
      {
        ...original.targets[0],
        id: "settings_reset",
        kind: "settings-reset",
        role: "",
        name: "Reset pairing",
        shield: "settings_reset",
        artifact: "reset.uf2",
      },
    ],
  });
  const build: Build = {
    id: "build",
    revision: "saved",
    pluginId: session.plugin.id,
    variantId: "dongle",
    status: "success",
    stage: "finished",
    startedAt: "",
    finishedAt: "",
    error: "",
    logs: [],
    artifacts: session.plugin.variants[1].targets.map((t) => ({
      targetId: t.id,
      name: t.artifact,
      size: 512,
      sha256: "",
    })),
  };
  return { ...session, build };
}
