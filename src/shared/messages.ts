// postMessage protocol shared by both runtimes (extension host + webview).
// One source of truth so neither side drifts (see 工作规范 §四). JSON-only:
// no functions, DOM refs, or EditorView cross the boundary (§五).

/** webview → extension */
export type WebviewMessage =
  | {
      /** Webview script has loaded and is ready to receive the document. */
      type: "ready";
    }
  | {
      /** Serialized Markdown after a doc-changing edit, for write-back. */
      type: "edit";
      text: string;
    };

/** extension → webview */
export type ExtensionMessage =
  | {
      /** Push the document's full text for initial render. */
      type: "init";
      text: string;
      /** webview base URI (asWebviewUri of the document's folder) that in-doc
       *  relative image paths resolve against ([D4-1]). */
      imageBase: string;
    }
  | {
      /** Push an external document change for in-place re-render. */
      type: "update";
      text: string;
      imageBase: string;
    };
