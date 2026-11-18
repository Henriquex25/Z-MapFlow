import { fireEvent, screen } from "@testing-library/react";
// Use the same explicit search-and-confirm interaction as the desktop picker.
export function selectOption(label: string, value: string) {
  const input = screen.getByRole("combobox", { name: label });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}
