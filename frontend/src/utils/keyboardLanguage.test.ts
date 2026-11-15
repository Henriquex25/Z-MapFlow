import { expect, it } from "vitest";
import { fixture } from "../test/fixtures";
import {
  abnt2HeaderName,
  headerCharacter,
  keyboardLanguageHeaders,
  setKeyboardLanguage,
} from "./keyboardLanguage";
import { headerSymbols } from "./firmwareSettings";

it("retains language sources and existing assignments when selecting another language", () => {
  const p = fixture().project;
  const originalKeys = structuredClone(p.layout.layers);
  setKeyboardLanguage(p, "pt-br");
  expect(p.headers?.[abnt2HeaderName]).toContain("#define PT_C_CEDILLA");
  expect(headerSymbols(keyboardLanguageHeaders(p))).toContain("PT_C_CEDILLA");
  setKeyboardLanguage(p, "pt-br");
  expect(p.preamble?.match(/#include "keys_pt_abnt2.h"/g)).toHaveLength(1);
  setKeyboardLanguage(p, "us");
  expect(p.headers?.[abnt2HeaderName]).toContain("#define PT_C_CEDILLA");
  expect(p.preamble).toContain(`#include "${abnt2HeaderName}"`);
  expect(p.layout.layers).toEqual(originalKeys);
  expect(keyboardLanguageHeaders(p)).toEqual({});
});

it("includes only the selected language and its local dependencies, including relative and cyclic includes", () => {
  const p = fixture().project;
  p.headers = {
    "locale/keys_es.h": '#include "../common.h"\n#define ES_NTIL SEMI\n',
    "common.h":
      '#include "locale/keys_es.h"\n#include "toString"\n#include "../../other.h"\n#define ES_HELPER LS(N1)\n',
    "other.h": "#define FR_EACUTE N2\n",
  };
  setKeyboardLanguage(p, "header:locale/keys_es.h");
  expect(Object.keys(keyboardLanguageHeaders(p))).toEqual(["locale/keys_es.h", "common.h"]);
  expect(headerSymbols(keyboardLanguageHeaders(p))).toEqual(["ES_HELPER", "ES_NTIL"]);
});

it("uses explicit character annotations and their aliases without guessing unannotated HID codes", () => {
  const p = fixture().project;
  p.headers = {
    "keys_es.h":
      "/* ñ */\n#define ES_NTIL SEMI\n#define ES_ENYE (ES_NTIL)\n#define ES_UNANNOTATED A\n\n#define ES_OTHER Q\n#define ES_CYCLE ES_OTHER_CYCLE\n#define ES_OTHER_CYCLE ES_CYCLE\n",
  };
  expect(headerCharacter("&kp ES_NTIL", p)).toBe("ñ");
  expect(headerCharacter("&kp ES_ENYE", p)).toBe("ñ");
  expect(headerCharacter("&kp ES_UNANNOTATED", p)).toBeUndefined();
  expect(headerCharacter("&kp ES_OTHER", p)).toBeUndefined();
  expect(headerCharacter("&kp ES_CYCLE", p)).toBeUndefined();
  p.headers = { "keys_es.h": "/* é */\n#define ES_NTIL N2\n" };
  expect(headerCharacter("&kp ES_NTIL", p)).toBe("é");
});

it("keeps an imported ABNT2 header intact and exposes bundled characters for legacy projects", () => {
  const p = fixture().project;
  p.headers = { [abnt2HeaderName]: "/* ç */\n#define PT_C_CEDILLA SEMI\n" };
  setKeyboardLanguage(p, "pt-br");
  expect(p.headers[abnt2HeaderName]).toBe("/* ç */\n#define PT_C_CEDILLA SEMI\n");
  delete p.headers;
  expect(headerCharacter("&kp PT_DEGREE", p)).toBe("°");
  expect(headerCharacter("&kp PT_FEMININE_ORDINAL_INDICATOR", p)).toBe("ª");
});

it("retains the implicit ABNT2 source when leaving a legacy project's language", () => {
  const p = fixture().project;
  p.options.locale = "pt-br";
  p.layout.layers[0].keys[0].code = "&kp PT_C_CEDILLA";
  delete p.headers;
  setKeyboardLanguage(p, "us");
  expect(p.layout.layers[0].keys[0].code).toBe("&kp PT_C_CEDILLA");
  expect(p.headers?.[abnt2HeaderName]).toContain("#define PT_C_CEDILLA");
  expect(p.preamble).toContain('#include "keys_pt_abnt2.h"');
});
