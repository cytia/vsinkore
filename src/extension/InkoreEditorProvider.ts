import * as vscode from "vscode";

/**
 * Minimal Custom Text Editor for `.md` files (see [D0-1]).
 *
 * Skeleton stage: it only renders an empty webview to prove the CSP + nonce +
 * asWebviewUri wiring works. Reading the document, the editor core, and the
 * two-way bridge all arrive in later stages.
 */
export class InkoreEditorProvider implements vscode.CustomTextEditorProvider {
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
    _document: vscode.TextDocument,
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
    webview.html = this.buildHtml(webview);
  }

  /** Build the webview HTML with a strict CSP and a per-load script nonce. */
  private buildHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
    );
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} https: data:`,
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inkore Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
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
