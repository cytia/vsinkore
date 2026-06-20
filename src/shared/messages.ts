// postMessage protocol shared by both runtimes (extension host + webview).
// One source of truth so neither side drifts (see 工作规范 §四). JSON-only:
// no functions, DOM refs, or EditorView cross the boundary (§五).

/** webview → extension */
export type WebviewMessage = {
  /** Webview script has loaded and is ready to receive the document. */
  type: "ready";
};

/** extension → webview */
export type ExtensionMessage = {
  /** Push the document's full text for initial render. */
  type: "init";
  text: string;
};
