import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { fixture } from "../test/fixtures";
import { LayerSidebar } from "./LayerSidebar";

it("selects, adds, removes and opens the context menu for the correct layer", () => {
  const first = fixture().project.layout.layers[0];
  const layers = [first, { ...structuredClone(first), id: "nav", name: "Navegação" }];
  const handlers = {
    onSelect: vi.fn(),
    onRemove: vi.fn(),
    onAdd: vi.fn(),
    onReorder: vi.fn(),
    onContextMenu: vi.fn(),
  };
  render(<LayerSidebar layers={layers} activeId={first.id} {...handlers} />);
  const nav = screen.getByRole("button", { name: "Navegação" });
  fireEvent.click(nav);
  expect(handlers.onSelect).toHaveBeenCalledWith("nav");
  fireEvent.click(within(nav.closest(".layer-tab") as HTMLElement).getByTitle("Remover Camada"));
  expect(handlers.onRemove).toHaveBeenCalledWith(1);
  fireEvent.contextMenu(nav);
  expect(handlers.onContextMenu.mock.calls[0][1]).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar camada" }));
  expect(handlers.onAdd).toHaveBeenCalledOnce();
});
it("keeps the active layer identified and disables addition at ZMK's layer limit", () => {
  const first = fixture().project.layout.layers[0];
  const layers = Array.from({ length: 32 }, (_, i) => ({
    ...structuredClone(first),
    id: `layer_${i}`,
    name: `Camada ${i}`,
  }));
  render(
    <LayerSidebar
      layers={layers}
      activeId="layer_31"
      onSelect={vi.fn()}
      onRemove={vi.fn()}
      onAdd={vi.fn()}
      onReorder={vi.fn()}
      onContextMenu={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Camada 31" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: "Adicionar camada" })).toBeDisabled();
});
