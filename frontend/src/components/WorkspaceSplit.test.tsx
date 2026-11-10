import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WorkspaceSplit } from "./WorkspaceSplit";

it("adjusts the keyboard/palette division with the keyboard and resets it", () => {
  const { container } = render(
    <WorkspaceSplit palette={<div className="palette">Paleta</div>}>
      <main>Keyboard</main>
    </WorkspaceSplit>,
  );
  const workspace = container.querySelector(".workspace-content") as HTMLElement;
  Object.defineProperty(workspace, "clientHeight", { value: 700 });
  const palette = container.querySelector(".palette")!;
  vi.spyOn(palette, "getBoundingClientRect").mockReturnValue({ height: 260 } as DOMRect);
  const separator = screen.getByRole("separator", {
    name: "Adjust keyboard and palette space",
  });
  fireEvent.keyDown(separator, { key: "ArrowUp" });
  expect(workspace.style.getPropertyValue("--palette-height")).toBe("284px");
  fireEvent.keyDown(separator, { key: "Home" });
  expect(workspace.style.getPropertyValue("--palette-height")).toBe("");
  fireEvent.keyDown(separator, { key: "ArrowDown" });
  expect(workspace.style.getPropertyValue("--palette-height")).toBe("236px");
  fireEvent.doubleClick(separator);
  expect(workspace.style.getPropertyValue("--palette-height")).toBe("");
});
