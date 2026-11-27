import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { FlashGuidance } from "./FlashGuidance";
import { api } from "../services/api";
import { useAppPreferences } from "../i18n";
vi.mock("../services/api", () => ({
  api: { getFlashGuidance: vi.fn(), forgetFlashGuidance: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  useAppPreferences.setState({ locale: "en" });
});
it("shows per-device advice without hiding devices and supports invalidation", async () => {
  vi.mocked(api.getFlashGuidance).mockResolvedValue([
    { deviceId: "dongle", name: "USB dongle", update: true, reason: "Changed" },
    { deviceId: "left", name: "Left", update: false, reason: "Same" },
  ]);
  vi.mocked(api.forgetFlashGuidance).mockImplementation(async () => {
    vi.mocked(api.getFlashGuidance).mockResolvedValue([
      { deviceId: "left", name: "Left", update: true, reason: "Unknown" },
    ]);
  });
  render(<FlashGuidance buildId="immutable-build" />);
  expect(await screen.findByText("USB dongle — Update recommended")).toBeVisible();
  expect(screen.getByText("Left — No relevant changes")).toBeVisible();
  fireEvent.click(screen.getByText("How this advice works"));
  fireEvent.click(screen.getByRole("button", { name: "Forget recorded transfers" }));
  await screen.findByText("Left — Update recommended");
  expect(api.forgetFlashGuidance).toHaveBeenCalledWith("immutable-build");
});
it("falls back conservatively when comparison fails", async () => {
  vi.mocked(api.getFlashGuidance).mockRejectedValue(Error("unavailable"));
  render(<FlashGuidance buildId="old" />);
  expect(await screen.findByText(/Update advice is unavailable/)).toBeVisible();
});
