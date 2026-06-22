// Shared positioning for host popups (menus, link/table flyouts). They all live
// inside the same positioned scroll container and convert a viewport coordinate
// into container-local offsets; the menus also clamp into the visible area.

const PAD = 4;

function toLocal(
  container: HTMLElement,
  viewportX: number,
  viewportY: number,
): { left: number; top: number } {
  const box = container.getBoundingClientRect();
  return {
    left: viewportX - box.left + container.scrollLeft,
    top: viewportY - box.top + container.scrollTop,
  };
}

/** Place `el`'s top-left at a viewport point, then clamp it on-screen. */
export function placeAt(
  el: HTMLElement,
  container: HTMLElement,
  clientX: number,
  clientY: number,
): void {
  let { left, top } = toLocal(container, clientX, clientY);
  const maxLeft = container.scrollLeft + container.clientWidth - el.offsetWidth - PAD;
  const maxTop = container.scrollTop + container.clientHeight - el.offsetHeight - PAD;
  if (left > maxLeft) left = Math.max(0, maxLeft);
  if (top > maxTop) top = Math.max(0, maxTop);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

/** Place `el` just below an anchor rect, left edges aligned. */
export function placeBelow(
  el: HTMLElement,
  container: HTMLElement,
  anchor: DOMRect,
  gap = PAD,
): void {
  const { left, top } = toLocal(container, anchor.left, anchor.bottom + gap);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

/**
 * Place `el` to the right of an anchor rect, top edges aligned. Flips to the
 * anchor's left if it would overflow the container's right edge (standard
 * submenu behavior), and clamps the top so it stays on-screen.
 */
export function placeRightOf(
  el: HTMLElement,
  container: HTMLElement,
  anchor: DOMRect,
  gap = 2,
): void {
  let { left, top } = toLocal(container, anchor.right + gap, anchor.top);
  const rightEdge = container.scrollLeft + container.clientWidth - PAD;
  if (left + el.offsetWidth > rightEdge) {
    // Not enough room on the right — open to the left of the anchor instead.
    const flipped = toLocal(container, anchor.left, anchor.top);
    left = Math.max(0, flipped.left - el.offsetWidth - gap);
  }
  const maxTop = container.scrollTop + container.clientHeight - el.offsetHeight - PAD;
  if (top > maxTop) top = Math.max(0, maxTop);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}
