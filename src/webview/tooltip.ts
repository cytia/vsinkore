// VSCode-style custom tooltip for toolbar buttons. The native `title` tooltip
// is gray, slow, and unstyleable; VSCode draws its own themed hover. Elements
// opt in with a `data-tooltip` attribute (used instead of `title` so the native
// one doesn't also appear). One shared widget, shown via event delegation so
// buttons added later are covered automatically ([D5]).

// VSCode's hover appears after a short dwell; ~500ms matches its feel.
const SHOW_DELAY_MS = 500;

let tip: HTMLDivElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let installed = false;

function ensureTip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "pm-tooltip";
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  return tip;
}

function hide(): void {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = undefined;
  }
  if (tip) tip.hidden = true;
}

function show(target: HTMLElement, text: string): void {
  const el = ensureTip();
  el.textContent = text;
  el.hidden = false;
  // Center above the target; clamp into the viewport so edge buttons don't
  // push the tip offscreen.
  const r = target.getBoundingClientRect();
  const tw = el.offsetWidth;
  const th = el.offsetHeight;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(4, Math.min(left, window.innerWidth - tw - 4));
  let top = r.top - th - 6;
  if (top < 4) top = r.bottom + 6; // flip below when no room above
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

/**
 * Install a single delegated tooltip handler on the document. Idempotent — safe
 * to call from each mounting site (bubble, search box); only the first installs.
 */
export function installTooltips(): void {
  if (installed) return;
  installed = true;

  const targetOf = (e: Event): HTMLElement | null => {
    const el = (e.target as Element | null)?.closest("[data-tooltip]");
    return el instanceof HTMLElement ? el : null;
  };

  document.addEventListener("mouseover", (e) => {
    const target = targetOf(e);
    if (!target) return;
    const text = target.getAttribute("data-tooltip");
    if (!text) return;
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(() => show(target, text), SHOW_DELAY_MS);
  });

  // Hide on leaving a tooltip target, on any press, and on scroll (the anchor
  // moves out from under a positioned tip).
  document.addEventListener("mouseout", (e) => {
    if (targetOf(e)) hide();
  });
  document.addEventListener("mousedown", hide, true);
  document.addEventListener("scroll", hide, true);
}
