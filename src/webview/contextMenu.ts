import type { EditorView } from "prosemirror-view";
import type { Command } from "prosemirror-state";
import {
  toggleBlockquote,
  toggleCodeBlock,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  insertHorizontalRule,
  insertFootnote,
  insertMathInline,
  insertMathBlock,
  insertToc,
  pasteAsPlainText,
  isInTable,
} from "../editor-core";
import type { LinkInput } from "./bubbleLinkInput";
import { mountTablePopup, type TablePopup } from "./contextMenuTable";
import { mountTableEditMenu, type TableEditMenu } from "./contextMenuTableEdit";
import { renderMenuRows, type MenuRow } from "./menuRows";
import { placeAt } from "./popupPosition";

// Right-click menu (host-owned, like the bubble toolbar). Single flat menu with
// group captions, matching Inkore's native menu; the only nested level is the
// table size popup. UI uses VSCode menu tokens. Wires existing core commands.

export interface ContextMenu {
  destroy(): void;
}

export function mountContextMenu(
  view: EditorView,
  container: HTMLElement,
  linkInput: LinkInput,
): ContextMenu {
  const menu = document.createElement("div");
  menu.className = "ctxmenu";
  menu.setAttribute("data-bubble-toolbar", ""); // share the core's blur guard
  menu.hidden = true;
  container.appendChild(menu);

  const table: TablePopup = mountTablePopup(view, container, close);
  // Shown instead of this menu when the cursor is inside a table ([D5-5]).
  const tableEdit: TableEditMenu = mountTableEditMenu(view, container);

  function dispatch(cmd: Command): void {
    cmd(view.state, view.dispatch, view);
    view.focus();
    close();
  }

  // The table item keeps the menu open and toggles its sub-popup to the menu's
  // right (matching Inkore's flyout placement).
  function toggleTable(): void {
    if (table.hidden) table.open(menu.getBoundingClientRect());
    else table.close();
  }

  const item = (icon: string, label: string, cmd: Command): MenuRow => ({
    kind: "item",
    icon,
    label,
    run: () => dispatch(cmd),
  });

  renderMenuRows(menu, [
    { kind: "caption", label: "格式" },
    item("❝", "引用块", toggleBlockquote),
    item("</>", "代码块", toggleCodeBlock),
    item("☰", "无序列表", toggleBulletList),
    item("☷", "有序列表", toggleOrderedList),
    item("☑", "任务列表", toggleTaskList),
    { kind: "divider" },
    { kind: "caption", label: "插入" },
    {
      kind: "item",
      icon: "🔗",
      label: "链接",
      run: () => {
        const rect = menu.getBoundingClientRect();
        close();
        linkInput.open(rect);
      },
    },
    { kind: "item", icon: "▦", label: "表格", arrow: true, run: toggleTable },
    item("—", "分割线", insertHorizontalRule),
    item("⑆", "脚注", insertFootnote),
    item("%", "行内公式", insertMathInline),
    item("%", "块级公式", insertMathBlock),
    item("☰", "目录", insertToc),
    { kind: "divider" },
    { kind: "caption", label: "编辑" },
    {
      kind: "item",
      icon: "⧉",
      label: "粘贴为纯文本",
      run: () => {
        close();
        void pasteAsPlainText(view);
      },
    },
  ]);

  function close(): void {
    menu.hidden = true;
    table.close();
  }

  function openAt(clientX: number, clientY: number): void {
    menu.hidden = false;
    table.close();
    placeAt(menu, container, clientX, clientY);
  }

  function closeAll(): void {
    close();
    tableEdit.close();
  }

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    closeAll();
    // Inside a table: show the table-edit menu; elsewhere: the format menu.
    if (isInTable(view.state)) tableEdit.openAt(e.clientX, e.clientY);
    else openAt(e.clientX, e.clientY);
  };
  // Any plain click outside the open menu / sub-popup dismisses it.
  const onPointerDown = (e: MouseEvent) => {
    if (menu.hidden && tableEdit.hidden) return;
    const el = e.target as HTMLElement;
    if (!el.closest(".ctxmenu") && !el.closest(".ctx-table")) closeAll();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !(menu.hidden && tableEdit.hidden)) {
      e.preventDefault();
      closeAll();
      view.focus();
    }
  };

  view.dom.addEventListener("contextmenu", onContextMenu);
  window.addEventListener("mousedown", onPointerDown, true);
  window.addEventListener("keydown", onKeyDown, true);

  return {
    destroy() {
      view.dom.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousedown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      table.destroy();
      tableEdit.destroy();
      menu.remove();
    },
  };
}
