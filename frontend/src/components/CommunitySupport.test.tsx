import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CommunitySupport } from "./CommunitySupport";
import { api } from "../services/api";
import { useAppPreferences } from "../i18n";

vi.mock("../services/api", () => ({
  api: {
    communityStatus: vi.fn(),
    recordCommunityMinute: vi.fn(),
    dismissCommunityPrompt: vi.fn(),
    openCommunityPage: vi.fn(),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  useAppPreferences.setState({ locale: "en" });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.mocked(api.communityStatus).mockResolvedValue({ prompt: "star" });
  vi.mocked(api.recordCommunityMinute).mockResolvedValue({ prompt: "star" });
  vi.mocked(api.dismissCommunityPrompt).mockResolvedValue();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function advance(ms = 60_000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
async function respond(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

it("always exposes labelled support buttons but delays eligible invitations without stealing focus", async () => {
  render(
    <>
      <input aria-label="Editing" />
      <CommunitySupport />
    </>,
  );
  const input = screen.getByLabelText("Editing");
  input.focus();
  expect(screen.getByRole("button", { name: "Buy me a coffee" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Star on GitHub" })).toBeVisible();
  await advance(55_000);
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  await advance(5_000);
  expect(screen.getByRole("region", { name: "Enjoying Z-MapFlow?" })).toBeVisible();
  expect(input).toHaveFocus();
});

it.each(["No, thanks", "Dismiss invitation", "Star on GitHub"])(
  "persists '%s' and leaves manual actions available",
  async (label) => {
    render(<CommunitySupport />);
    await advance();
    const prompt = screen.getByRole("region");
    await respond(within(prompt).getByRole("button", { name: label }));
    expect(api.dismissCommunityPrompt).toHaveBeenCalledWith("star");
    expect(api.openCommunityPage).toHaveBeenCalledTimes(label === "Star on GitHub" ? 1 : 0);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "a" });
    await advance(120_000);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    await respond(screen.getByRole("button", { name: "Buy me a coffee" }));
    expect(api.openCommunityPage).toHaveBeenLastCalledWith("donation");
  },
);

it.each(["No, thanks", "Dismiss invitation", "Buy me a coffee"])(
  "dismisses the separate donation invitation with '%s'",
  async (label) => {
    vi.mocked(api.communityStatus).mockResolvedValue({ prompt: "donation" });
    vi.mocked(api.recordCommunityMinute).mockResolvedValue({ prompt: "donation" });
    render(<CommunitySupport />);
    await advance();
    const prompt = screen.getByRole("region", { name: "Support Z-MapFlow" });
    expect(screen.queryByText("Enjoying Z-MapFlow?")).not.toBeInTheDocument();
    await respond(within(prompt).getByRole("button", { name: label }));
    expect(api.dismissCommunityPrompt).toHaveBeenCalledWith("donation");
    expect(api.openCommunityPage).toHaveBeenCalledTimes(label === "Buy me a coffee" ? 1 : 0);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  },
);

it("suppresses invitations during firmware work and modal dialogs", async () => {
  const { rerender } = render(<CommunitySupport paused />);
  await advance();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  rerender(<CommunitySupport />);
  expect(screen.getByRole("region")).toBeVisible();
  rerender(
    <>
      <CommunitySupport />
      <div role="dialog" aria-modal="true">
        Flash
      </div>
    </>,
  );
  await act(async () => {});
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  rerender(<CommunitySupport />);
  await act(async () => {});
  expect(screen.getByRole("region")).toBeVisible();
});

it("does not count idle, unfocused or hidden time", async () => {
  render(<CommunitySupport />);
  await advance();
  expect(api.recordCommunityMinute).toHaveBeenCalledTimes(1);
  await advance(300_000);
  expect(api.recordCommunityMinute).toHaveBeenCalledTimes(1);
  vi.mocked(document.hasFocus).mockReturnValue(false);
  fireEvent.blur(window);
  fireEvent.keyDown(window, { key: "a" });
  await advance();
  expect(api.recordCommunityMinute).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  vi.mocked(document.hasFocus).mockReturnValue(true);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  fireEvent.keyDown(window, { key: "a" });
  await advance();
  expect(api.recordCommunityMinute).toHaveBeenCalledTimes(1);
});

it("keeps invitations dismissed despite an older pending status response", async () => {
  let finish!: (value: { prompt: string }) => void;
  vi.mocked(api.recordCommunityMinute).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<CommunitySupport />);
  await advance();
  await respond(within(screen.getByRole("region")).getByRole("button", { name: "No, thanks" }));
  await act(async () => {
    finish({ prompt: "donation" });
  });
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

it("retains the invitation when saving a dismissal fails", async () => {
  vi.mocked(api.dismissCommunityPrompt).mockRejectedValue(new Error("disk full"));
  render(<CommunitySupport />);
  await advance();
  await respond(within(screen.getByRole("region")).getByRole("button", { name: "No, thanks" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not save your choice");
  expect(screen.getByRole("region")).toBeVisible();
  expect(api.openCommunityPage).not.toHaveBeenCalled();
  // Explicit manual links still work when preferences are unavailable.
  await respond(
    within(screen.getByRole("navigation")).getByRole("button", { name: "Buy me a coffee" }),
  );
  expect(api.openCommunityPage).toHaveBeenCalledWith("donation");
});

it("keeps support accessible in Portuguese and when invitations are unavailable", async () => {
  useAppPreferences.setState({ locale: "pt-BR" });
  vi.mocked(api.communityStatus).mockRejectedValue(new Error("unavailable"));
  vi.mocked(api.recordCommunityMinute).mockRejectedValue(new Error("unavailable"));
  render(
    <StrictMode>
      <CommunitySupport />
    </StrictMode>,
  );
  await advance();
  expect(screen.getByRole("button", { name: "Pague um café" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Dar estrela no GitHub" })).toBeVisible();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("does not show an invitation when the backend says it is too early or already dismissed", async () => {
  vi.mocked(api.communityStatus).mockResolvedValue({ prompt: "" });
  vi.mocked(api.recordCommunityMinute).mockResolvedValue({ prompt: "" });
  render(<CommunitySupport />);
  await advance();
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
});

it("translates the invitation and its permanent dismissal explanation", async () => {
  useAppPreferences.setState({ locale: "pt-BR" });
  render(<CommunitySupport />);
  await advance();
  const prompt = screen.getByRole("region", { name: "Gostando do Z-MapFlow?" });
  expect(
    within(prompt).getByText(/Qualquer escolha dispensa este convite permanentemente/),
  ).toBeVisible();
  await respond(within(prompt).getByRole("button", { name: "Não, obrigado" }));
  expect(api.dismissCommunityPrompt).toHaveBeenCalledWith("star");
});
