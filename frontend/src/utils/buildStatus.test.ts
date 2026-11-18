import { expect, it } from "vitest";
import { sameBuild } from "./buildStatus";
import { dongleFixture } from "../test/dongleFixture";
it("ignores identical polled snapshots without hiding changes to logs, stages or artifact integrity", () => {
  const { build } = dongleFixture();
  expect(sameBuild(build, structuredClone(build))).toBe(true);
  expect(sameBuild(null, null)).toBe(true);
  expect(sameBuild(build, null)).toBe(false);
  for (const modify of [
    (b: typeof build) => {
      b.stage = "right";
    },
    (b: typeof build) => {
      b.logs = ["new output"];
    },
    (b: typeof build) => {
      b.artifacts[0].sha256 = "changed";
    },
  ]) {
    const next = structuredClone(build);
    modify(next);
    expect(sameBuild(build, next)).toBe(false);
  }
  const before = { ...build, logs: ["old", "same last"] };
  expect(sameBuild(before, { ...before, logs: ["new", "same last"] })).toBe(false);
});
