import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Component tests render large React Aria trees and chain several user events; under the full
// parallel suite (and on a 2-core CI runner) that can pass 5s, so give jsdom files more headroom.
// Node-environment suites keep the default.
if (typeof window !== 'undefined') {
  vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });
}

// Component tests opt into jsdom with `// @vitest-environment jsdom`; most other
// suites run in node, where there is no DOM to patch.
if (typeof Element !== 'undefined' && !Element.prototype.getAnimations) {
  // React Aria's animated tab indicator and exit transitions call this; jsdom lacks it.
  Element.prototype.getAnimations = () => [];
}
