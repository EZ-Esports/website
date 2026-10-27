import '@testing-library/jest-dom/vitest';

// Component tests opt into jsdom with `// @vitest-environment jsdom`; most other
// suites run in node, where there is no DOM to patch.
if (typeof Element !== 'undefined' && !Element.prototype.getAnimations) {
  // React Aria's animated tab indicator and exit transitions call this; jsdom lacks it.
  Element.prototype.getAnimations = () => [];
}
