import { beforeEach, expect, it, vi } from "vitest";
import * as go from "../../wailsjs/go/main/App";
import { api } from "./api";
import { useAppPreferences } from "../i18n";
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
