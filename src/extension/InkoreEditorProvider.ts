import * as vscode from "vscode";
import type { WebviewMessage } from "../shared/messages";

/**
 * Custom Text Editor for `.md` files (see [D0-1]).
 *
 * Stage two (read-only PoC): pushes the document text to the webview for
 * WYSIWYG rendering on demand. It does not yet observe document changes or
 * write back — the two-way bridge arrives in stage three.
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
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    };

    // Push the document text once the webview reports ready, so the init message
    // can't race the script load. Read-only: no change observer this stage.
    webviewPanel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      if (message?.type === "ready") {
        webview.postMessage({ type: "init", text: document.getText() });
      }
    });

    webview.html = this.buildHtml(webview);
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
  <div id="root"></div>
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
