import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

import { FlowCanvas } from "@/components/canvas/FlowCanvas";

// Lightweight mount check. `/canvas/new` clears the graph store on load, so we
// do not preload nodes here.

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Polyfill ResizeObserver used by @xyflow/react in the jsdom test environment.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-expect-error test environment global
global.ResizeObserver = MockResizeObserver;

describe("FlowCanvas minimal workflow smoke test", () => {
  it("mounts for a new canvas route", () => {
    const { container } = render(<FlowCanvas graphId="new" />);
    expect(container).toBeTruthy();
  });
});



