import { EditorView } from "prosemirror-view";
import {
  createEditorState,
  parseMarkdown,
  serializeMarkdown,
  ImageNodeView,
  CodeBlockNodeView,
  MathInlineNodeView,
  MathBlockNodeView,
  TaskItemNodeView,
  TocNodeView,
  FootnoteRefNodeView,
  FootnoteDefNodeView,
  type SaveImage,
  type ToRenderUrl,
} from "../editor-core";
import { codeHighlightPlugin } from "./codeHighlightPlugin";

// Images are not persisted ([D0-6]): saveImage is a no-op so the core's
// imageUploadPlugin has a valid callback but pasted/dropped images reach nothing.
const saveImage: SaveImage = async () => "";

/**
 * Join an in-doc relative image path onto the webview base URI the extension
 * resolved (asWebviewUri of the document's folder, [D4-1]). Absolute http(s)/
 * data srcs are already handled by the core before reaching here; this only
 * sees relative paths, which resolve against base under vscode-webview://.
 */
function joinImageUrl(base: string, relPath: string): string {
  if (!base) return relPath;
  return new URL(relPath, base.endsWith("/") ? base : base + "/").toString();
}

/**
 * Notified after each doc-changing edit. Receives a thunk that serializes the
 * current doc on demand, so a keystroke-rate debounce can skip serialization
 * for every edit it coalesces away — only the surviving edit pays for it.
 */
export type ChangeHandler = (serialize: () => string) => void;

/**
 * Build a ProseMirror view for the given Markdown and wire two-way sync.
 *
 * The host owns the nodeViews wiring; the core only exports the classes (see
 * core example/main.ts). Shiki highlighting rides as a decoration plugin ([D0-8]).
 *
 * Write-back ([D3]): a doc-changing transaction serializes the new doc and calls
 * `onChange`; the entry forwards it to the extension. The returned view exposes
 * `applyExternal` so the entry can re-render an external document change in place
 * without a remount (preserving plugins/Shiki/scroll); it also refreshes the
 * image base in case the document moved.
 *
 * `imageBase` is the webview base URI relative image srcs resolve against ([D4-1]).
 */
export function mountEditor(
  mount: HTMLElement,
  content: string,
  imageBase: string,
  onChange: ChangeHandler,
): { view: EditorView; applyExternal: (text: string, imageBase: string) => void } {
  // Mutable so an external update can refresh it; toRenderUrl reads it live.
  let currentImageBase = imageBase;
  const toRenderUrl: ToRenderUrl = (_vaultRoot, relPath) =>
    joinImageUrl(currentImageBase, relPath);
  const baseState = createEditorState({
    content,
    saveImage,
    markdownInput: true,
  });
  // Append Shiki highlight decorations without touching the core's plugin set
  // or its code_block NodeView header ([D0-8]).
  const state = baseState.reconfigure({
    plugins: [...baseState.plugins, codeHighlightPlugin()],
  });

  // Set while applying an external document change, so its transaction is not
  // serialized and echoed back as a local edit (loop guard, [D3]).
  let applyingExternal = false;

  const view: EditorView = new EditorView(mount, {
    state,
    nodeViews: {
      image: (node, v, getPos) =>
        new ImageNodeView(node, v, getPos, "", toRenderUrl, () => {}),
      code_block: (node, v, getPos) => new CodeBlockNodeView(node, v, getPos),
      math_inline: (node, v, getPos) => new MathInlineNodeView(node, v, getPos),
      math_block: (node, v, getPos) => new MathBlockNodeView(node, v, getPos),
      task_item: (node, v, getPos) => new TaskItemNodeView(node, v, getPos),
      toc: (node, v, getPos) => new TocNodeView(node, v, getPos),
      footnote_ref: (node, v, getPos) =>
        new FootnoteRefNodeView(node, v, getPos),
      footnote_def: (node, v, getPos) =>
        new FootnoteDefNodeView(node, v, getPos),
    },
    dispatchTransaction(tr) {
      const next = view.state.apply(tr);
      view.updateState(next);
      // Only react when the doc actually changed; selection-only or
      // decoration-only transactions (e.g. Shiki) must not trigger write-back.
      // Serialization is deferred into the thunk so a debounced consumer pays
      // for it once, not per keystroke.
      if (tr.docChanged && !applyingExternal) {
        onChange(() => serializeMarkdown(next.doc));
      }
    },
  });

  // Replace the whole doc with an external change. Guarded so the resulting
  // transaction is not echoed back to the extension as a local edit.
  function applyExternal(text: string, imageBase: string): void {
    currentImageBase = imageBase;
    applyingExternal = true;
    try {
      const doc = parseMarkdown(text);
      const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
      tr.setMeta("addToHistory", false);
      view.dispatch(tr);
    } finally {
      applyingExternal = false;
    }
  }

  return { view, applyExternal };
}
