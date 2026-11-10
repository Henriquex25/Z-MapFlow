import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { AppVersion } from "./AppVersion";
import { api } from "../services/api";
import { useAppPreferences } from "../i18n";
vi.mock("../services/api", () => ({ api: { appInfo: vi.fn() } }));
beforeEach(() => {
  useAppPreferences.setState({ locale: "en" });
  vi.clearAllMocks();
});
it("shows the backend version even when no update check is available", async () => {
  vi.mocked(api.appInfo).mockResolvedValue({ version: "7.8.9", commit: "test" });
  render(<AppVersion />);
  expect(await screen.findByLabelText("Application version")).toHaveTextContent("v7.8.9");
});
it("keeps a version lookup failure from breaking the editor", async () => {
  vi.mocked(api.appInfo).mockRejectedValue(new Error("Unavailable"));
  const { container } = render(<AppVersion />);
  expect(container).toBeEmptyDOMElement();
});
