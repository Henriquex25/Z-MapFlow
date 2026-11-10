import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EditorBoundary } from "./EditorBoundary";

it("shows recovery actions instead of an empty window after a rendering error", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  let fail = true;
  function Editor() {
    if (fail) throw new Error("Falha na renderização");
    return <p>Editor recuperado</p>;
  }
  try {
    render(
      <EditorBoundary>
        <Editor />
      </EditorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível exibir o editor");
    expect(screen.getByRole("button", { name: "Exportar edição atual (JSON)" })).toBeVisible();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reabrir editor" }));
    expect(screen.getByText("Editor recuperado")).toBeVisible();
  } finally {
    log.mockRestore();
  }
});
