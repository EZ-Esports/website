/**
 * Makes the page behind the tour view only. `inert` takes an element out of the tab order,
 * the pointer's reach and the accessibility tree in one step, so while a tour step is showing
 * nothing underneath it can be clicked, focused or activated from the keyboard, and screen
 * readers stay on the tour card. (A dimming overlay alone only hides controls; it leaves them
 * reachable with Tab.)
 *
 * The tour card must be a direct child of `host` (it is portalled to `document.body`), so
 * locking every other child of `host` leaves exactly the card live. Script-like tags and custom
 * elements (framework dev overlays) are left alone, and an element that was already inert for
 * some other reason is neither touched nor released.
 */

type InertCandidate = Pick<Element, 'tagName' | 'contains' | 'hasAttribute' | 'setAttribute' | 'removeAttribute'>;

const NEVER_INERT = new Set(['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE']);

/** Returns a function that releases exactly what this call locked. */
export function inertAllExcept(host: { children: ArrayLike<InertCandidate> }, keep: Element): () => void {
  const locked: InertCandidate[] = [];
  for (const child of Array.from(host.children)) {
    if (child === (keep as unknown) || child.contains(keep)) continue;
    if (NEVER_INERT.has(child.tagName.toUpperCase()) || child.tagName.includes('-')) continue;
    if (child.hasAttribute('inert')) continue;
    child.setAttribute('inert', '');
    locked.push(child);
  }
  return () => {
    for (const child of locked) child.removeAttribute('inert');
  };
}
