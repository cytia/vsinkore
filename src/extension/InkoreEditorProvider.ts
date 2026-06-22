import * as vscode from "vscode";
import type { WebviewMessage } from "../shared/messages";

/**
 * Custom Text Editor for `.md` files (see [D0-1]).
 *
 * Two-way bridge ([D3]): pushes the document text on ready, writes webview edits
 * back via WorkspaceEdit (VSCode owns dirty/save/undo, 工作规范 §五), and pushes
 * external document changes back for re-render. Loop guard: a change whose text
 * matches what the plugin last wrote is its own echo and is not pushed back.
 */
export class InkoreEditorProvider implements vscode.CustomTextEditorProvider {
  // Must stay identical to contributes.customEditors[].viewType in package.json,
  // or the editor silently fails to bind.
  private static readonly viewType = "inkore.editor";

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new InkoreEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      InkoreEditorProvider.viewType,
      provider,
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): void {
    const { webview } = webviewPanel;
    // In-doc relative image paths resolve against the vault root, i.e. the
    // workspace folder containing the document — Inkore keeps a single .images/
    // at the vault root that notes in any subfolder reference ([D4-1]). Falls
    // back to the document's own folder when the file is opened outside any
    // workspace. That root must be a localResourceRoot or the webview can't
    // read its files (工作规范 §六).
    const imageRoot =
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri ??
      vscode.Uri.joinPath(document.uri, "..");
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
        imageRoot,
      ],
    };

    // Stable for this editor's lifetime: the webview base URI relative image
    // srcs are joined onto. Computed once, sent with every init/update ([D4-1]).
    const imageBase = webview.asWebviewUri(imageRoot).toString();

    // Text this provider last wrote to the document. An incoming change whose
    // text matches it is our own echo and must not be pushed back to the webview
    // (would jump the cursor / loop, [D3]). undefined = nothing written yet.
    let lastWrittenText: string | undefined;

    webviewPanel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      // Push the document text once the webview reports ready, so the init
      // message can't race the script load.
      if (message?.type === "ready") {
        webview.postMessage({ type: "init", text: document.getText(), imageBase });
        return;
      }
      if (message?.type === "edit") {
        void this.writeBack(document, message.text, (written) => {
          lastWrittenText = written;
        });
        return;
      }
      if (message?.type === "openLink") {
        // Only http(s) reaches openExternal; in-doc (#) / relative (/) hrefs and
        // any other scheme (javascript:, file:) are dropped.
        if (/^https?:\/\//i.test(message.href)) {
          void vscode.env.openExternal(vscode.Uri.parse(message.href));
        }
      }
    });

    // External changes (other editor / git checkout) re-render the webview;
    // our own write-backs are filtered out by the lastWrittenText guard.
    const changeSub = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() !== document.uri.toString()) {
        return;
      }
      const text = event.document.getText();
      if (text === lastWrittenText) {
        return; // our own echo
      }
      webview.postMessage({ type: "update", text, imageBase });
    });
    webviewPanel.onDidDispose(() => changeSub.dispose());

    webview.html = this.buildHtml(webview);
  }

  /**
   * Replace the whole document with `text` via a WorkspaceEdit. No-op when the
   * text is already identical, so a webview round-trip that serializes to the
   * same Markdown doesn't dirty the document. Records what was written so the
   * change observer can recognize its own echo ([D3]).
   */
  private async writeBack(
    document: vscode.TextDocument,
    text: string,
    onWritten: (written: string) => void,
  ): Promise<void> {
    const current = document.getText();
    if (current === text) {
      return;
    }
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(current.length),
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullRange, text);
    // Record before applying: the change event can fire synchronously.
    onWritten(text);
    await vscode.workspace.applyEdit(edit);
  }

  /** Build the webview HTML with a strict CSP and a per-load script nonce. */
  private buildHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const asset = (...parts: string[]): vscode.Uri =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, ...parts),
      );
    const scriptUri = asset("dist", "webview.js");
    // Third-party editor CSS (katex/prosemirror/tables) bundled by esbuild, plus
    // our own VSCode-themed typography. Both served locally, never via CDN ([D0-2]).
    const bundledCssUri = asset("dist", "webview.css");
    const editorCssUri = asset("media", "editor.css");
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      // nonce lets the webview fill #shiki-styles with Shiki token colors without
      // opening unsafe-inline (see [D0-8]); bundled CSS still loads via cspSource.
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
      // The nonce authorizes the entry module; cspSource lets its dynamically
      // imported chunks (Shiki languages, [D0-8]) load from the same origin.
      `script-src 'nonce-${nonce}' ${webview.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${bundledCssUri}" rel="stylesheet" />
  <link href="${editorCssUri}" rel="stylesheet" />
  <!-- Pre-authorized (nonce) sink the webview fills with Shiki token color rules. -->
  <style nonce="${nonce}" id="shiki-styles"></style>
  <title>Inkore Editor</title>
</head>
<body>
  <!-- Static loading placeholder shown until the webview script receives the
       init message and mounts the editor (which clears #root). Inline so it
       covers even the window before the script runs ([D5] 加载态). -->
  <div id="root"><div class="pm-loading">Loading…</div></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

/** Cryptographically arbitrary nonce; regenerated on every webview load. */
function makeNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
