import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { usePalettePicker } from "./store/usePalettePicker";
import { beforeEach, afterEach } from "vitest";
beforeEach(() => usePalettePicker.setState({ target: null, collapsed: false }));
afterEach(cleanup);

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
