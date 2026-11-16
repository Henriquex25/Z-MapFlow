import { beforeEach, expect, it, vi } from "vitest";
import * as go from "../../wailsjs/go/main/App";
import { api } from "./api";
import { useAppPreferences } from "../i18n";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
vi.mock("../../wailsjs/runtime/runtime", () => ({ BrowserOpenURL: vi.fn() }));
vi.mock("../../wailsjs/go/main/App", async (original) => ({
  ...(await original<typeof import("../../wailsjs/go/main/App")>()),
  SetAppLanguage: vi.fn(),
  ExportFirmware: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  useAppPreferences.setState({ locale: "en" });
});
it("sets native dialog language before opening a file selector", async () => {
  useAppPreferences.getState().setLocale("pt-BR");
  let ready!: () => void;
  vi.mocked(go.SetAppLanguage).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        ready = resolve;
      }),
  );
  vi.mocked(go.ExportFirmware).mockResolvedValue("/tmp/firmware");
  const result = api.exportFirmware("build");
  expect(go.SetAppLanguage).toHaveBeenCalledWith("pt-BR");
  expect(go.ExportFirmware).not.toHaveBeenCalled();
  ready();
  expect(await result).toBe("/tmp/firmware");
  expect(go.ExportFirmware).toHaveBeenCalledWith("build");
});

it("opens only the fixed project and maintainer support pages", () => {
  api.openCommunityPage("star");
  api.openCommunityPage("donation");
  expect(vi.mocked(BrowserOpenURL).mock.calls).toEqual([
    ["https://github.com/Henriquex25/Z-MapFlow"],
    ["https://www.buymeacoffee.com/henriquemiranda"],
  ]);
});
