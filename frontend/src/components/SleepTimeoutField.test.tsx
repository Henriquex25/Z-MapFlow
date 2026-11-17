import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SleepTimeoutField } from "./SleepTimeoutField";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { useAppPreferences } from "../i18n";
import { api } from "../services/api";
import { fixture } from "../test/fixtures";

vi.mock("../services/api", () => ({ api: { sleepTimeoutMilliseconds: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  useAppPreferences.setState({ locale: "en" });
  useKeyboardStore.getState().initialize(fixture());
  vi.mocked(api.sleepTimeoutMilliseconds).mockResolvedValue(90000);
});

it("shows minutes and uses the validated backend result without changing the saved snapshot", async () => {
  render(<SleepTimeoutField />);
  const input = screen.getByRole("spinbutton", { name: "Sleep timeout (minutes)" });
  expect(input).toHaveValue(15);
  expect(api.sleepTimeoutMilliseconds).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "1.5" } });
  expect(api.sleepTimeoutMilliseconds).toHaveBeenCalledWith(1.5);
  await waitFor(() =>
    expect(useKeyboardStore.getState().project!.options.sleepTimeoutMs).toBe(90000),
  );
  expect(useKeyboardStore.getState().savedProject!.options.sleepTimeoutMs).toBe(900000);
  expect(input).toHaveValue(1.5);
});

it("preserves imported millisecond values until the user edits the field", () => {
  useKeyboardStore.getState().edit((p) => {
    p.options.sleepTimeoutMs = 123456;
  });
  render(<SleepTimeoutField />);
  expect(screen.getByRole("spinbutton")).toHaveValue(2.0576);
  expect(useKeyboardStore.getState().project!.options.sleepTimeoutMs).toBe(123456);
  expect(api.sleepTimeoutMilliseconds).not.toHaveBeenCalled();
});

it.each(["", "0", "-1", "1441"])(
  "rejects invalid minutes %j without changing the project",
  (value) => {
    render(<SleepTimeoutField />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value } });
    expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("between 1 second and 24 hours");
    expect(api.sleepTimeoutMilliseconds).not.toHaveBeenCalled();
    expect(useKeyboardStore.getState().project!.options.sleepTimeoutMs).toBe(900000);
  },
);

it("keeps saving blocked until backend validation finishes and ignores older responses", async () => {
  let first!: (value: number) => void, second!: (value: number) => void;
  vi.mocked(api.sleepTimeoutMilliseconds)
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          first = r;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          second = r;
        }),
    );
  render(<SleepTimeoutField />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
  expect(Object.values(useKeyboardStore.getState().draftErrors)).toContain(
    "Checking sleep timeout…",
  );
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "20" } });
  await act(async () => {
    second(1200000);
  });
  await act(async () => {
    first(600000);
  });
  expect(useKeyboardStore.getState().project!.options.sleepTimeoutMs).toBe(1200000);
  expect(screen.getByRole("spinbutton")).toHaveValue(20);
  expect(Object.values(useKeyboardStore.getState().draftErrors)).toHaveLength(0);
});

it("ignores a conversion result after importing another project", async () => {
  let finish!: (value: number) => void;
  vi.mocked(api.sleepTimeoutMilliseconds).mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  render(<SleepTimeoutField />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
  const imported = fixture();
  imported.project.options.sleepTimeoutMs = 123456;
  act(() => useKeyboardStore.getState().initialize(imported));
  await act(async () => {
    finish(600000);
  });
  expect(useKeyboardStore.getState().project!.options.sleepTimeoutMs).toBe(123456);
  expect(screen.getByRole("spinbutton")).toHaveValue(2.0576);
});

it("localizes the field and backend validation errors", async () => {
  useAppPreferences.setState({ locale: "pt-BR" });
  vi.mocked(api.sleepTimeoutMilliseconds).mockRejectedValue(
    new Error("Use a sleep timeout between 1 second and 24 hours."),
  );
  render(<SleepTimeoutField />);
  fireEvent.change(screen.getByRole("spinbutton", { name: "Inatividade para repouso (minutos)" }), {
    target: { value: "30" },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("entre 1 segundo e 24 horas");
  expect(useKeyboardStore.getState().project!.options.sleepTimeoutMs).toBe(900000);
});

it("finishes a validated edit after changing tabs and blocks saving until then", async () => {
  let finish!: (value: number) => void;
  vi.mocked(api.sleepTimeoutMilliseconds).mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const { unmount } = render(<SleepTimeoutField />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
  unmount();
  expect(Object.values(useKeyboardStore.getState().draftErrors)).toContain(
    "Checking sleep timeout…",
  );
  await act(async () => {
    finish(600000);
  });
  expect(useKeyboardStore.getState().project!.options.sleepTimeoutMs).toBe(600000);
  expect(Object.values(useKeyboardStore.getState().draftErrors)).toHaveLength(0);
});

it("does not reapply a pending timeout after discarding changes", async () => {
  let finish!: (value: number) => void;
  vi.mocked(api.sleepTimeoutMilliseconds).mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  render(<SleepTimeoutField />);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
  act(() => useKeyboardStore.getState().undoChanges());
  expect(screen.getByRole("spinbutton")).toHaveValue(15);
  await act(async () => {
    finish(600000);
  });
  expect(useKeyboardStore.getState().project!.options.sleepTimeoutMs).toBe(900000);
  expect(screen.getByRole("spinbutton")).toHaveValue(15);
  expect(Object.values(useKeyboardStore.getState().draftErrors)).toHaveLength(0);
});
