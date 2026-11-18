import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SearchableSelect } from "./SearchableSelect";
import { ResourceVisibility } from "../utils/resourceVisibility";
import { useAppPreferences } from "../i18n";
const options = Array.from({ length: 1000 }, (_, i) => ({
  value: `code_${i}`,
  label: `Action ${i}`,
}));
it("searches the complete catalog while mounting only a small window and committing explicit choices", () => {
  useAppPreferences.setState({ locale: "en" });
  const change = vi.fn();
  render(<SearchableSelect label="Action" value="code_900" options={options} onChange={change} />);
  const input = screen.getByRole("combobox", { name: "Action" });
  expect(input).toHaveValue("Action 900");
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  fireEvent.focus(input);
  expect(screen.getAllByRole("option").length).toBeLessThan(20);
  fireEvent.change(input, { target: { value: "code_570" } });
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole("option", { name: "Action 570" })).toBeVisible();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).toHaveBeenCalledWith("code_570");
  expect(input).toHaveAttribute("aria-expanded", "false");
});
it("matches accented names, key codes and group names, skips disabled results and cancels searches", () => {
  const change = vi.fn();
  render(
    <SearchableSelect
      label="Key"
      value="A"
      onChange={change}
      options={[
        { value: "A", label: "Letter A" },
        { value: "PT_C_CEDILLA", label: "Ç", group: "Português" },
        { value: "forbidden", label: "Disabled", disabled: true },
        { value: "allowed", label: "Enabled" },
      ]}
    />,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "portugues" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).toHaveBeenLastCalledWith("PT_C_CEDILLA");
  fireEvent.click(input);
  fireEvent.change(input, { target: { value: "nothing matches" } });
  expect(screen.getByRole("status")).toHaveTextContent("No matching options");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input).toHaveValue("Letter A");
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).toHaveBeenLastCalledWith("allowed");
});
it("closes portal content when the owning card closes and supports keyboard focus and localization", () => {
  const view = render(
    <ResourceVisibility.Provider value={true}>
      <SearchableSelect label="Ação" value="" options={options} onChange={() => {}} />
    </ResourceVisibility.Provider>,
  );
  act(() => useAppPreferences.setState({ locale: "pt-BR" }));
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  expect(input).toHaveAttribute("placeholder", "Buscar opções…");
  view.rerender(
    <ResourceVisibility.Provider value={false}>
      <SearchableSelect label="Ação" value="" options={options} onChange={() => {}} />
    </ResourceVisibility.Provider>,
  );
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  act(() => useAppPreferences.setState({ locale: "en" }));
});
it("does not apply a disabled result and closes on blur without changing its value", () => {
  const change = vi.fn();
  render(
    <SearchableSelect
      label="Action"
      value="a"
      options={[
        { value: "a", label: "Original" },
        { value: "b", label: "Unavailable", disabled: true, description: "Enable this feature" },
      ]}
      onChange={change}
    />,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.click(screen.getByRole("option", { name: "Unavailable" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(input).toHaveValue("Original");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

it("defers preparing a large key catalog until the selector is opened", () => {
  const load = vi.fn(() => options);
  render(
    <SearchableSelect
      label="Key"
      value="code_900"
      selectedLabel="Action 900"
      options={load}
      onChange={() => {}}
    />,
  );
  expect(screen.getByRole("combobox")).toHaveValue("Action 900");
  expect(load).not.toHaveBeenCalled();
  fireEvent.focus(screen.getByRole("combobox"));
  expect(screen.getByRole("option", { name: "Action 900" })).toBeVisible();
  expect(screen.getAllByRole("option").length).toBeLessThan(20);
});
