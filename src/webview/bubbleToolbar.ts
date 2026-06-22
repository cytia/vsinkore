import type { EditorView } from "prosemirror-view";
import type { Command, EditorState } from "prosemirror-state";
import {
  calcBubblePosition,
  isMarkActive,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrikethrough,
  toggleCode,
  toggleTextColor,
  toggleBlockquote,
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  copyAsPlainText,
  clearFormatting,
  type BubbleSelectionInfo,
} from "../editor-core";
import { installTooltips } from "./tooltip";
import { mountHeadingMenu } from "./bubbleHeadingMenu";
import type { LinkInput } from "./bubbleLinkInput";
import { markActive, blockActive, type ToggleButton } from "./bubbleButtons";

// Floating format toolbar over a selection. The core's bubbleToolbarPlugin
// reports selection geometry (BubbleSelectionInfo); this host owns the UI and
// positions it with the core's calcBubblePosition ([D5] Bubble Toolbar).
// One row, grouped by separators: marks (B I U S </>) | heading menu + block
// toggles (quote, bullet/numbered/task list) | text color + link | utilities
// (copy as plain text, clear formatting). All wired to existing core commands.

// Written into the document's textColor mark; must be a literal hex, not a CSS
// var (the value is serialized into the .md and must stay stable across themes
// and editors). The swatch only *displays* --vscode-charts-green.
const TEXT_COLOR = "#4ec9b0";

export interface BubbleToolbar {
  /** Show/position over a selection, or hide when info is null. */
  update(info: BubbleSelectionInfo | null): void;
  destroy(): void;
}

export interface BubbleToolbarOptions {
  // Compact bubble used inside tables: marks + color + link only, no block
  // toggles / heading / utilities ([D5-6]).
  compact?: boolean;
}

export function mountBubbleToolbar(
  view: EditorView,
  container: HTMLElement,
  // Shared with the right-click menu so both open the same link input ([D5]).
  linkInput: LinkInput,
  options: BubbleToolbarOptions = {},
): BubbleToolbar {
  const compact = options.compact ?? false;
  const root = document.createElement("div");
  root.className = "bubble";
  root.setAttribute("data-bubble-toolbar", ""); // core's blur guard looks for this
  root.hidden = true;

  // Running a command via mousedown keeps the editor selection (a click would
  // blur it first); preventDefault stops focus from leaving the doc.
  function runCmd(cmd: Command): void {
    cmd(view.state, view.dispatch, view);
    view.focus();
    refreshActive();
  }

  // A button that runs a command on mousedown. `isActive` (optional) drives the
  // pressed (.on) state on each refresh; action buttons (copy/clear) pass none.
  function cmdButton(
    cls: string, label: string, title: string,
    cmd: Command, isActive?: (state: EditorState) => boolean,
  ): ToggleButton {
    const el = document.createElement("button");
    el.className = cls;
    el.textContent = label;
    el.setAttribute("data-tooltip", title);
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      runCmd(cmd);
    });
    return { el, isActive: isActive ?? (() => false) };
  }

  const markBtns: ToggleButton[] = [
    cmdButton("b-bold", "B", "Bold", toggleBold, markActive("strong")),
    cmdButton("b-italic", "I", "Italic", toggleItalic, markActive("em")),
    cmdButton("b-under", "U", "Underline", toggleUnderline, markActive("underline")),
    cmdButton("b-strike", "S", "Strikethrough", toggleStrikethrough, markActive("strikethrough")),
    cmdButton("b-code", "</>", "Inline code", toggleCode, markActive("code")),
  ];

  const makeSep = () => Object.assign(document.createElement("span"), { className: "sep" });

  // Single text color (one swatch, no palette — per project scope). Active when
  // the exact color is applied; the command toggles it off on a second click.
  const colorBtn = document.createElement("button");
  colorBtn.setAttribute("data-tooltip", "Text color");
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  colorBtn.appendChild(swatch);
  const colorToggle: ToggleButton = {
    el: colorBtn,
    isActive: (state) => isMarkActive(state, "textColor"),
  };
  colorBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    runCmd(toggleTextColor(TEXT_COLOR));
  });

  const linkBtn = document.createElement("button");
  linkBtn.setAttribute("data-tooltip", "Link");
  linkBtn.textContent = "🔗";
  linkBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (linkInput.hidden) linkInput.open(linkBtn.getBoundingClientRect());
    else linkInput.close();
  });

  // Block-level controls (heading/list/quote/utilities) are full-toolbar only;
  // the compact in-table toolbar is marks + color + link ([D5-6]).
  let headingMenu: ReturnType<typeof mountHeadingMenu> | undefined;
  let activeBtns: ToggleButton[];

  if (compact) {
    // marks | color + link
    root.append(...markBtns.map((b) => b.el), makeSep(), colorBtn, linkBtn);
    activeBtns = [...markBtns, colorToggle];
  } else {
    headingMenu = mountHeadingMenu(view, runCmd);
    const blockBtns: ToggleButton[] = [
      cmdButton("b-quote", "❝", "Blockquote", toggleBlockquote, blockActive("blockquote")),
      cmdButton("b-ul", "•", "Bullet list", toggleBulletList, blockActive("bullet_list")),
      cmdButton("b-ol", "1.", "Numbered list", toggleOrderedList, blockActive("ordered_list")),
      cmdButton("b-task", "☑", "Task list", toggleTaskList, blockActive("task_list")),
    ];
    const copyBtn = cmdButton("b-copy", "⧉", "Copy as plain text", (state) => {
      copyAsPlainText(state);
      return true;
    });
    const clearBtn = cmdButton("b-clear", "⌫", "Clear formatting", clearFormatting);
    // marks | heading + block toggles | color + link | utilities
    root.append(
      ...markBtns.map((b) => b.el),
      makeSep(),
      headingMenu.button,
      ...blockBtns.map((b) => b.el),
      makeSep(),
      colorBtn,
      linkBtn,
      makeSep(),
      copyBtn.el,
      clearBtn.el,
      headingMenu.popup,
    );
    activeBtns = [...markBtns, ...blockBtns, colorToggle];
  }
  container.appendChild(root);

  installTooltips(); // VSCode-style hover for the data-tooltip buttons ([D5])

  function refreshActive(): void {
    for (const b of activeBtns) {
      b.el.classList.toggle("on", b.isActive(view.state));
    }
    headingMenu?.refresh();
  }

  function update(info: BubbleSelectionInfo | null): void {
    if (!info) {
      if (root.hidden) return; // skip redundant hide (runs on every selection change)
      root.hidden = true;
      headingMenu?.close();
      return;
    }
    refreshActive();
    // Measure after making it visible (offscreen) so calcBubblePosition gets
    // real dimensions; the core flips above/below and clamps to the card.
    root.hidden = false;
    root.style.visibility = "hidden";
    const pos = calcBubblePosition(info, root.offsetWidth, root.offsetHeight);
    // Coords are viewport-relative; the container is the positioned scroll root,
    // so subtract its box to get container-local offsets.
    const box = container.getBoundingClientRect();
    root.style.top = `${pos.top - box.top + container.scrollTop}px`;
    root.style.left = `${pos.left - box.left + container.scrollLeft}px`;
    root.style.visibility = "visible";
  }

  return {
    update,
    destroy() {
      headingMenu?.destroy();
      root.remove();
    },
  };
}
