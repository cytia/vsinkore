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

// Read-only PoC: images are not persisted ([D0-6]). saveImage is a no-op so the
// core's imageUploadPlugin has a valid callback but nothing reaches disk.
const saveImage: SaveImage = async () => "";

// Stage two stub: relative srcs render as-is. Stage four bridges this through
// the extension's asWebviewUri so in-vault images actually resolve.
const toRenderUrl: ToRenderUrl = (_vaultRoot, relPath) => relPath;

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
 * without a remount (preserving plugins/Shiki/scroll).
 */
export function mountEditor(
  mount: HTMLElement,
  content: string,
  onChange: ChangeHandler,
): { view: EditorView; applyExternal: (text: string) => void } {
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
  function applyExternal(text: string): void {
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
