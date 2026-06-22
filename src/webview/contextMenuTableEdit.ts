import type { EditorView } from "prosemirror-view";
import type { Command } from "prosemirror-state";
import {
  addRowBefore,
  addRowAfter,
  deleteRow,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  mergeCells,
  splitCell,
  deleteTable,
} from "../editor-core";
import { renderMenuRows, type MenuRow } from "./menuRows";
import { placeAt } from "./popupPosition";

// Right-click menu shown when the cursor is inside a table (the format menu is
// shown otherwise). Single flat menu with 行 / 列 / 单元格 group captions, plus a
// trailing 删除表格. No icons (matches Inkore's table menu). Host-owned UI.

export interface TableEditMenu {
  /** Open at viewport coords (relative to the container), clamped on-screen. */
  openAt(clientX: number, clientY: number): void;
  close(): void;
  readonly hidden: boolean;
  destroy(): void;
}

export function mountTableEditMenu(
  view: EditorView,
  container: HTMLElement,
): TableEditMenu {
  const menu = document.createElement("div");
  menu.className = "ctxmenu ctxmenu--plain";
  menu.setAttribute("data-bubble-toolbar", ""); // share the core's blur guard
  menu.hidden = true;
  container.appendChild(menu);

  function close(): void {
    menu.hidden = true;
  }

  function run(cmd: Command): void {
    cmd(view.state, view.dispatch, view);
    view.focus();
    close();
  }

  const item = (label: string, cmd: Command): MenuRow => ({
    kind: "item",
    label,
    run: () => run(cmd),
  });

  renderMenuRows(menu, [
    { kind: "caption", label: "行" },
    item("在上方插入行", addRowBefore),
    item("在下方插入行", addRowAfter),
    item("删除行", deleteRow),
    { kind: "divider" },
    { kind: "caption", label: "列" },
    item("在左侧插入列", addColumnBefore),
    item("在右侧插入列", addColumnAfter),
    item("删除列", deleteColumn),
    { kind: "divider" },
    { kind: "caption", label: "单元格" },
    item("合并单元格", mergeCells),
    item("拆分单元格", splitCell),
    { kind: "divider" },
    item("删除表格", deleteTable),
  ]);

  function openAt(clientX: number, clientY: number): void {
    menu.hidden = false;
    placeAt(menu, container, clientX, clientY);
  }

  return {
    openAt,
    close,
    get hidden() {
      return menu.hidden;
    },
    destroy() {
      menu.remove();
    },
  };
}
