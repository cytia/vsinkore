import { EditorView } from "prosemirror-view";
import {
  createEditorState,
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
 * Build a read-only ProseMirror view for the given Markdown.
 *
 * The host owns the nodeViews wiring; the core only exports the classes (see
 * core example/main.ts). The code_block uses the core's own NodeView this stage;
 * Shiki highlighting lands in a later pass ([D0-8]).
 *
 * No write-back: dispatchTransaction updates the view only. The two-way bridge
 * to the document arrives in stage three.
 */
export function mountEditor(mount: HTMLElement, content: string): EditorView {
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
      view.updateState(view.state.apply(tr));
    },
  });

  return view;
}
