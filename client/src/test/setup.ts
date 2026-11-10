import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// Polyfill matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Polyfill ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver as any;

// Polyfill getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  width: 400,
  height: 300,
  top: 100,
  left: 100,
  bottom: 400,
  right: 500,
  x: 100,
  y: 100,
  toJSON: () => {},
}));

// Polyfill document.execCommand for caret formatting
document.execCommand = vi.fn().mockReturnValue(false);

// In-memory localStorage polyfill to silence Zustand persist middleware warnings
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: storageMock });
Object.defineProperty(window, "sessionStorage", { value: storageMock });
