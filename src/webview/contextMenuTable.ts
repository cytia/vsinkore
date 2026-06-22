import type { EditorView } from "prosemirror-view";
import { insertTable } from "../editor-core";
import { placeRightOf } from "./popupPosition";

// Table size sub-popup for the right-click menu: rows/cols inputs (default 3×3)
// and an insert button wired to the core's insertTable command.

export interface TablePopup {
  /** Open to the right of `anchor` (viewport rect), relative to the container. */
  open(anchor: DOMRect): void;
  close(): void;
  readonly hidden: boolean;
  destroy(): void;
}

function numberField(label: string): { row: HTMLElement; input: HTMLInputElement } {
  const row = document.createElement("div");
  row.className = "ctx-table-row";
  const name = document.createElement("span");
  name.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.value = "3";
  row.append(name, input);
  return { row, input };
}

export function mountTablePopup(
  view: EditorView,
  container: HTMLElement,
  // Called after a successful insert so the parent menu can close itself.
  onInserted: () => void,
): TablePopup {
  const popup = document.createElement("div");
  popup.className = "ctx-table";
  popup.setAttribute("data-bubble-toolbar", ""); // share the core's blur guard
  popup.hidden = true;
  container.appendChild(popup);

  const rows = numberField("行数");
  const cols = numberField("列数");

  const insertBtn = document.createElement("button");
  insertBtn.className = "ctx-table-insert";
  insertBtn.textContent = "插入表格";

  popup.append(rows.row, cols.row, insertBtn);

  function clamp(v: string): number {
    const n = parseInt(v, 10);
    return isNaN(n) || n < 1 ? 1 : n;
  }

  function submit(): void {
    insertTable(clamp(rows.input.value), clamp(cols.input.value))(
      view.state,
      view.dispatch,
      view,
    );
    view.focus();
    close();
    onInserted();
  }

  function close(): void {
    popup.hidden = true;
  }

  function open(anchor: DOMRect): void {
    rows.input.value = "3";
    cols.input.value = "3";
    popup.hidden = false;
    placeRightOf(popup, container, anchor);
  }

  popup.addEventListener("mousedown", (e) => {
    // Keep the doc selection unless interacting with an input.
    if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
    e.stopPropagation();
  });
  insertBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    submit();
  });

  return {
    open,
    close,
    get hidden() {
      return popup.hidden;
    },
    destroy() {
      popup.remove();
    },
  };
}
