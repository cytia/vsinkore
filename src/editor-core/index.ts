/**
 * @inkore/editor-core — framework-agnostic ProseMirror Markdown editing core.
 *
 * Zero React, zero Tauri. The host injects platform capabilities (see ./host).
 * A host builds an EditorView itself, wiring the exported NodeViews into its
 * `nodeViews` map — see example/ for a browser host.
 */

// Host injection surface
export type { SaveImage, ToRenderUrl, SearchMatch, SearchOpts } from './host';

// Schema
export { schema } from './schema';

// State factory
export { createEditorState } from './setup';
export type { CreateEditorStateOptions } from './setup';

// Markdown bridge
export { parseMarkdown, serializeMarkdown, customSerializer, mdIt } from './markdown';

// Outline
export { extractOutline } from './outline';
export type { OutlineItem } from './outline';

// Commands
export * from './commands';
export * from './tableCommands';

// Plugins & NodeViews
export { ImageNodeView } from './plugins/imageNodeView';
export type { ImageContextMenuHandler } from './plugins/imageNodeView';
export { imageUploadPlugin, imageUploadKey } from './plugins/imageUpload';
export { CodeBlockNodeView } from './plugins/codeBlockNodeView';
export { MathInlineNodeView } from './plugins/mathInlineNodeView';
export { MathBlockNodeView } from './plugins/mathBlockNodeView';
export { TaskItemNodeView } from './plugins/taskItemNodeView';
export { TocNodeView } from './plugins/tocNodeView';
export { FootnoteRefNodeView, FootnoteDefNodeView, footnotePlugin } from './plugins/footnote';
export {
  bubbleToolbarPlugin,
  calcBubblePosition,
  BUBBLE_HIDDEN,
} from './plugins/bubbleToolbar';
export type {
  SelectionCallback,
  BubbleSelectionInfo,
  BubbleToolbarPosition,
} from './plugins/bubbleToolbar';
export { searchHighlightPlugin, searchHighlightKey, collectMatches } from './plugins/searchHighlight';
export type { SearchHighlightMeta } from './plugins/searchHighlight';
export { placeholderPlugin } from './plugins/placeholder';
export { buildInputRules } from './plugins/inputRules';
export type { ContextMenuCoords } from './plugins/editorContextMenu';
