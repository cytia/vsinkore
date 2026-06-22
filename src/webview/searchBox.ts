import type { EditorView } from "prosemirror-view";
import type { SearchMatch, SearchOpts } from "../editor-core";
import { searchHighlightKey } from "../editor-core";
import { installTooltips } from "./tooltip";

// In-webview find widget. VSCode's native Ctrl+F find does not reach inside a
// webview iframe, so the find UI lives here and drives the core's
// searchHighlightPlugin via transaction meta ([D5] 查找高亮).

export interface SearchBox {
  /** Open the box (focusing the input) or close it, clearing the query. */
  toggle(): void;
  close(): void;
  /** Re-read the match list after the doc changed, keeping count in sync. */
  setMatches(matches: SearchMatch[]): void;
  destroy(): void;
}

const DEFAULT_OPTS: SearchOpts = {
  fuzzy: false,
  caseSensitive: false,
  regex: false,
  vaultScope: false,
};

/**
 * Mount a find widget into `container` (the scroll root) and wire it to `view`.
 * Query/option changes dispatch a searchHighlightKey meta so the core rescans
 * and re-decorates; navigation moves activeIndex and scrolls the match into
 * view. The core reports matches back through onMatchesChange (see editorHost),
 * which the host forwards here via setMatches.
 */
export function mountSearchBox(view: EditorView, container: HTMLElement): SearchBox {
  let opts: SearchOpts = { ...DEFAULT_OPTS };
  let matches: SearchMatch[] = [];
  let activeIndex = -1;

  const root = document.createElement("div");
  root.className = "pm-search-box";
  root.hidden = true;

  const input = document.createElement("input");
  input.className = "pm-search-input";
  input.type = "text";
  input.placeholder = "Find";

  const caseBtn = makeToggle("Aa", "Match Case");
  const regexBtn = makeToggle(".*", "Use Regular Expression");

  const count = document.createElement("span");
  count.className = "pm-search-count";

  const prevBtn = makeIconButton("↑", "Previous Match");
  const nextBtn = makeIconButton("↓", "Next Match");
  const closeBtn = makeIconButton("✕", "Close");

  root.append(input, caseBtn, regexBtn, count, prevBtn, nextBtn, closeBtn);
  container.appendChild(root);

  installTooltips(); // VSCode-style hover for the data-tooltip buttons ([D5])

  // ── core wiring ────────────────────────────────────────────────────────────

  // Push query/opts into the plugin; the plugin rescans and reports back via
  // onMatchesChange. activeIndex is reset because the match set changed.
  function pushQuery(): void {
    activeIndex = -1;
    const tr = view.state.tr.setMeta(searchHighlightKey, {
      query: input.value,
      opts,
      activeIndex,
    });
    view.dispatch(tr);
  }

  function setActive(index: number): void {
    activeIndex = index;
    const tr = view.state.tr.setMeta(searchHighlightKey, { activeIndex });
    view.dispatch(tr);
    const m = matches[index];
    if (m) {
      // Scroll the match's start into view without grabbing the doc selection
      // (which would move the caret out of the find box).
      const dom = view.domAtPos(m.from);
      const node = dom.node.nodeType === 1 ? (dom.node as Element) : dom.node.parentElement;
      node?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    renderCount();
  }

  function step(delta: number): void {
    if (!matches.length) return;
    const next = (activeIndex + delta + matches.length) % matches.length;
    setActive(next);
  }

  function renderCount(): void {
    if (!input.value) {
      count.textContent = "";
    } else if (!matches.length) {
      count.textContent = "No results";
    } else {
      const human = activeIndex >= 0 ? activeIndex + 1 : 1;
      count.textContent = `${human}/${matches.length}`;
    }
  }

  // ── events ─────────────────────────────────────────────────────────────────

  input.addEventListener("input", pushQuery);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  closeBtn.addEventListener("click", close);
  caseBtn.addEventListener("click", () => {
    opts = { ...opts, caseSensitive: !opts.caseSensitive };
    caseBtn.classList.toggle("active", opts.caseSensitive);
    pushQuery();
  });
  regexBtn.addEventListener("click", () => {
    opts = { ...opts, regex: !opts.regex };
    regexBtn.classList.toggle("active", opts.regex);
    pushQuery();
  });

  function open(): void {
    root.hidden = false;
    input.focus();
    input.select();
    if (input.value) pushQuery();
  }

  function close(): void {
    root.hidden = true;
    input.value = "";
    matches = [];
    activeIndex = -1;
    // Clear the highlight decorations.
    view.dispatch(
      view.state.tr.setMeta(searchHighlightKey, { query: "", opts, activeIndex: -1 }),
    );
    renderCount();
    view.focus();
  }

  return {
    toggle: () => (root.hidden ? open() : close()),
    close,
    setMatches(next: SearchMatch[]) {
      matches = next;
      // Keep the active match if still in range, else point at the first.
      if (activeIndex >= matches.length) activeIndex = matches.length ? 0 : -1;
      if (activeIndex < 0 && matches.length) {
        setActive(0);
      } else {
        renderCount();
      }
    },
    destroy() {
      root.remove();
    },
  };
}

function makeToggle(label: string, title: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "pm-search-toggle";
  b.type = "button";
  b.textContent = label;
  b.setAttribute("data-tooltip", title);
  return b;
}

function makeIconButton(label: string, title: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "pm-search-icon";
  b.type = "button";
  b.textContent = label;
  b.setAttribute("data-tooltip", title);
  return b;
}
