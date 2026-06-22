// Webview entry (browser sandbox). Bundles the third-party editor CSS, tells the
// extension it is ready, renders the document it pushes back, and forwards local
// edits for write-back ([D3]).
import "katex/dist/katex.min.css";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-tables/style/tables.css";

import { mountEditor } from "./editorHost";
import type { ExtensionMessage, WebviewMessage } from "../shared/messages";

const vscode = acquireVsCodeApi();

function post(message: WebviewMessage): void {
  vscode.postMessage(message);
}

// Coalesce keystroke-rate edits so each one doesn't thrash a WorkspaceEdit on
// the extension side. Trailing-edge debounce that also defers serialization:
// only the edit that survives the debounce is serialized and posted.
const EDIT_DEBOUNCE_MS = 200;
let editTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSerialize: (() => string) | undefined;

function queueEdit(serialize: () => string): void {
  pendingSerialize = serialize;
  if (editTimer !== undefined) {
    clearTimeout(editTimer);
  }
  editTimer = setTimeout(() => {
    editTimer = undefined;
    if (pendingSerialize !== undefined) {
      post({ type: "edit", text: pendingSerialize() });
      pendingSerialize = undefined;
    }
  }, EDIT_DEBOUNCE_MS);
}

let editor: ReturnType<typeof mountEditor> | undefined;

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  const message = event.data;
  // Unknown message types are silently ignored (工作规范 §五).
  if (message?.type === "init") {
    const mount = document.getElementById("root");
    if (!mount) {
      return;
    }
    mount.textContent = "";
    try {
      editor = mountEditor(mount, message.text, message.imageBase, queueEdit);
    } catch (err) {
      // A render failure would otherwise leave a blank webview with no clue.
      mount.textContent = `Failed to render: ${String(err)}`;
      throw err;
    }
    return;
  }
  if (message?.type === "update" && editor) {
    editor.applyExternal(message.text, message.imageBase);
  }
});

// Open the in-webview find widget on Ctrl/Cmd+F. Capture phase so it preempts
// VSCode's native find (which can't reach inside the iframe anyway, [D5]).
window.addEventListener(
  "keydown",
  (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === "f") {
      if (editor) {
        e.preventDefault();
        editor.toggleSearch();
      }
    }
  },
  true,
);

// Ctrl/Cmd+click a link to open it (plain click stays in-editor for cursor
// placement / text editing, matching VSCode). The webview is sandboxed, so the
// extension opens the URL via vscode.env.openExternal; it re-validates the href.
// Must intercept on mousedown, not click: ProseMirror sets the selection on
// mousedown, where ctrlKey otherwise reads as add-cursor/extend-selection — a
// click-phase handler runs too late to stop it. stopPropagation keeps the event
// from reaching the editor's mousedown selection logic.
window.addEventListener(
  "mousedown",
  (e: MouseEvent) => {
    if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
    const anchor = (e.target as HTMLElement | null)?.closest("a");
    const href = anchor?.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    e.stopPropagation();
    post({ type: "openLink", href });
  },
  true,
);

post({ type: "ready" });

// Minimal VSCode webview API typing — only what this entry uses.
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};
