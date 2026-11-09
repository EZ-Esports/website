import { describe, it, expect } from 'vitest';
import { inertAllExcept } from '../inert';

/** A stand-in for a DOM element: just what the helper touches. */
function fakeEl(tagName: string, opts: { inert?: boolean; holds?: object } = {}) {
  const attrs = new Set<string>(opts.inert ? ['inert'] : []);
  return {
    tagName,
    contains: (other: unknown) => other === opts.holds,
    hasAttribute: (name: string) => attrs.has(name),
    setAttribute: (name: string) => void attrs.add(name),
    removeAttribute: (name: string) => void attrs.delete(name),
    isInert: () => attrs.has('inert'),
  };
}

type Fake = ReturnType<typeof fakeEl>;
const asHost = (children: Fake[]) => ({ children }) as unknown as Parameters<typeof inertAllExcept>[0];

describe('inertAllExcept', () => {
  it('locks every sibling of the tour layer and leaves the layer live', () => {
    const layer = fakeEl('DIV');
    const app = fakeEl('DIV');
    const toast = fakeEl('SECTION');
    inertAllExcept(asHost([app, layer, toast]), layer as unknown as Element);
    expect(app.isInert()).toBe(true);
    expect(toast.isInert()).toBe(true);
    expect(layer.isInert()).toBe(false);
  });

  it('skips an ancestor of the layer so the layer itself cannot be locked out', () => {
    const layer = fakeEl('DIV');
    const wrapper = fakeEl('DIV', { holds: layer });
    inertAllExcept(asHost([wrapper]), layer as unknown as Element);
    expect(wrapper.isInert()).toBe(false);
  });

  it('leaves scripts, styles and custom elements (dev overlays) alone', () => {
    const layer = fakeEl('DIV');
    const others = ['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'nextjs-portal'].map((tag) => fakeEl(tag));
    inertAllExcept(asHost(others), layer as unknown as Element);
    expect(others.some((el) => el.isInert())).toBe(false);
  });

  it('releases exactly what it locked, never something that was already inert', () => {
    const layer = fakeEl('DIV');
    const app = fakeEl('DIV');
    const alreadyInert = fakeEl('DIV', { inert: true });
    const release = inertAllExcept(asHost([app, alreadyInert, layer]), layer as unknown as Element);
    expect(app.isInert()).toBe(true);
    release();
    expect(app.isInert()).toBe(false);
    expect(alreadyInert.isInert()).toBe(true);
  });

  it('does nothing when the host has no other children', () => {
    const layer = fakeEl('DIV');
    const release = inertAllExcept(asHost([layer]), layer as unknown as Element);
    expect(layer.isInert()).toBe(false);
    expect(() => release()).not.toThrow();
  });
});
