import type { EditorView } from "prosemirror-view";
import { setHeading, setParagraph, isBlockActive } from "../editor-core";

// Heading dropdown for the bubble toolbar: a small popup listing Paragraph and
// H1–H6, so the bar stays one row instead of six flat heading buttons.

export interface HeadingMenu {
  /** The trigger button to place in the bubble bar. */
  button: HTMLButtonElement;
  /** The popup element; the bubble appends it so offsets are bubble-relative. */
  popup: HTMLElement;
  /** Re-sync the trigger's active state and any open popup highlight. */
  refresh(): void;
  /** Hide the popup (e.g. when the bubble itself hides). */
  close(): void;
  destroy(): void;
}

interface Entry {
  label: string;
  level: number; // 0 = paragraph
}

const ENTRIES: Entry[] = [
  { label: "Paragraph", level: 0 },
  { label: "Heading 1", level: 1 },
  { label: "Heading 2", level: 2 },
  { label: "Heading 3", level: 3 },
  { label: "Heading 4", level: 4 },
  { label: "Heading 5", level: 5 },
  { label: "Heading 6", level: 6 },
];

export function mountHeadingMenu(
  view: EditorView,
  // Run a command keeping the doc selection (mirrors bubbleToolbar's runCmd).
  runCmd: (cmd: import("prosemirror-state").Command) => void,
): HeadingMenu {
  const button = document.createElement("button");
  button.className = "b-heading";
  button.textContent = "H▾";
  button.setAttribute("data-tooltip", "Heading");

  const popup = document.createElement("div");
  popup.className = "bubble-menu";
  popup.setAttribute("data-bubble-toolbar", ""); // share the core's blur guard
  popup.hidden = true;

  const items = ENTRIES.map((entry) => {
    const item = document.createElement("button");
    item.className = "bubble-menu-item";
    item.textContent = entry.label;
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      runCmd(entry.level === 0 ? setParagraph : setHeading(entry.level));
      close();
    });
    return { item, entry };
  });
  popup.append(...items.map((i) => i.item));

  function isActive(level: number): boolean {
    return level === 0
      ? !isBlockActive(view.state, "heading")
      : isBlockActive(view.state, "heading", { level });
  }

  function refresh(): void {
    // Trigger lights up whenever the block is any heading.
    button.classList.toggle("on", isBlockActive(view.state, "heading"));
    for (const { item, entry } of items) {
      item.classList.toggle("active", isActive(entry.level));
    }
  }

  function open(): void {
    refresh();
    popup.hidden = false;
    // Drop below the trigger, left-aligned to it, within the bubble's space.
    popup.style.top = `${button.offsetTop + button.offsetHeight + 4}px`;
    popup.style.left = `${button.offsetLeft}px`;
  }

  function close(): void {
    popup.hidden = true;
  }

  button.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (popup.hidden) open();
    else close();
  });

  return {
    button,
    popup,
    refresh,
    close,
    destroy() {
      popup.remove();
    },
  };
}
