// Webview entry (browser sandbox). Bundles the third-party editor CSS, tells the
// extension it is ready, then renders the document the extension pushes back.
// Read-only this stage: edits stay in the view and never write to disk.
import "katex/dist/katex.min.css";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-tables/style/tables.css";

import { mountEditor } from "./editorHost";
import type { ExtensionMessage, WebviewMessage } from "../shared/messages";

const vscode = acquireVsCodeApi();

function post(message: WebviewMessage): void {
  vscode.postMessage(message);
}

window.addEventListener("message", (event: MessageEvent<ExtensionMessage>) => {
  const message = event.data;
  // Unknown message types are silently ignored (工作规范 §五).
  if (message?.type !== "init") {
    return;
  }
  const mount = document.getElementById("root");
  if (!mount) {
    return;
  }
  mount.textContent = "";
  try {
    mountEditor(mount, message.text);
  } catch (err) {
    // A render failure would otherwise leave a blank webview with no clue.
    mount.textContent = `Failed to render: ${String(err)}`;
    throw err;
  }
});

post({ type: "ready" });

// Minimal VSCode webview API typing — only what this entry uses.
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};
