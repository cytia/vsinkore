import type { EditorView } from "prosemirror-view";
import type { Command } from "prosemirror-state";
import { getLinkUrl, upsertLink } from "../editor-core";
import { placeBelow } from "./popupPosition";

// Inline link-input popup for the bubble toolbar. Replaces window.prompt, which
// VSCode webviews disable (it returns null, so the link was never applied).

export interface LinkInput {
  /** Whether the popup is currently hidden (callers toggle on it). */
  readonly hidden: boolean;
  /** Open below `anchor` (viewport rect), prefilled with the current link. */
  open(anchor: DOMRect): void;
  /** Hide without changing the document. */
  close(): void;
  destroy(): void;
}

export function mountLinkInput(
  view: EditorView,
  // The popup is appended here; open() positions relative to it. Shared between
  // the bubble toolbar and the right-click menu ([D5]).
  container: HTMLElement,
): LinkInput {
  const popup = document.createElement("div");
  popup.className = "bubble-link-input";
  popup.setAttribute("data-bubble-toolbar", ""); // share the core's blur guard
  popup.hidden = true;
  container.appendChild(popup);

  function runCmd(cmd: Command): void {
    cmd(view.state, view.dispatch, view);
    view.focus();
  }

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Link URL";

  const okBtn = document.createElement("button");
  okBtn.textContent = "✓";
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "✕";

  popup.append(input, okBtn, cancelBtn);

  function confirm(): void {
    const url = input.value.trim();
    close();
    if (url) runCmd(upsertLink(url));
  }

  function close(): void {
    popup.hidden = true;
  }

  // Open below `anchor` (a viewport rect, e.g. the link button or a menu item),
  // positioned relative to the container the popup lives in.
  function open(anchor: DOMRect): void {
    input.value = getLinkUrl(view.state) ?? "";
    popup.hidden = false;
    placeBelow(popup, container, anchor);
    input.focus();
    input.select();
  }

  // Keep the doc selection: a click inside would otherwise blur it. The core's
  // blur guard already allows [data-bubble-toolbar], but stop the events from
  // reaching the bubble's own mousedown handlers.
  popup.addEventListener("mousedown", (e) => {
    if (e.target !== input) e.preventDefault();
    e.stopPropagation();
  });
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      confirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      view.focus();
    }
  });
  okBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    confirm();
  });
  cancelBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    close();
    view.focus();
  });

  return {
    get hidden() {
      return popup.hidden;
    },
    open,
    close,
    destroy() {
      popup.remove();
    },
  };
}
