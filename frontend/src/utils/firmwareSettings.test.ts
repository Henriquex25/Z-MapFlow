import { expect, it } from "vitest";
import { fixture } from "../test/fixtures";
import { enableStudioUSB, headerSymbols, setConfig } from "./firmwareSettings";

it("moves imported Studio enablement to the central target and preserves unrelated flags", () => {
  const p = fixture().project;
  p.extraConfig = "# Personal settings\nCONFIG_ZMK_STUDIO=y\nCONFIG_ZMK_WIDGET_LAYER_STATUS=y";
  p.buildTargets = [
    { targetId: "central", snippets: ["usb-logging"], cmakeArgs: ["-DCONFIG_TEST=42"] },
  ];
  enableStudioUSB(p, "central");
  enableStudioUSB(p, "central");
  expect(p.extraConfig).toBe("# Personal settings\nCONFIG_ZMK_WIDGET_LAYER_STATUS=y");
  expect(p.buildTargets).toEqual([
    {
      targetId: "central",
      snippets: ["usb-logging", "studio-rpc-usb-uart"],
      cmakeArgs: ["-DCONFIG_TEST=42", "-DCONFIG_ZMK_STUDIO=y", "-DCONFIG_ZMK_USB=y"],
    },
  ]);
});
it("updates flags without destroying comments or keeping duplicate assignments", () => {
  const source = "# Keep this\nCONFIG_ZMK_USB=n\nCONFIG_ZMK_USB=y\nCONFIG_TEST=42";
  expect(setConfig(source, "CONFIG_ZMK_USB", "n")).toBe(
    "# Keep this\nCONFIG_TEST=42\nCONFIG_ZMK_USB=n",
  );
});
it("lists object key aliases from multiple language headers", () => {
  expect(
    headerSymbols({
      "keys_es.h":
        "#pragma once\n#define KEYS_ES_H\n#define ES_NTIL SEMI\n#define ES_EXCL LS(N1)\n#define HELPER(x) LS(x)\n",
      "keys_fr.h": "#define FR_EACUTE N2\n#define ES_NTIL SEMI\n",
    }),
  ).toEqual(["ES_EXCL", "ES_NTIL", "FR_EACUTE"]);
});
