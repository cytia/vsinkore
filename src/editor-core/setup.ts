import { EditorState } from 'prosemirror-state';
import { history } from 'prosemirror-history';
import { tableEditing, columnResizing } from 'prosemirror-tables';
import { schema } from './schema';
import { editorKeymap } from './keymap';
import { placeholderPlugin } from './plugins/placeholder';
import { bubbleToolbarPlugin, type SelectionCallback } from './plugins/bubbleToolbar';
import { imageUploadPlugin } from './plugins/imageUpload';
import { footnotePlugin } from './plugins/footnote';
import { searchHighlightPlugin } from './plugins/searchHighlight';
import { buildInputRules } from './plugins/inputRules';
import type { SearchMatch, SaveImage } from './host';
import { parseMarkdown } from './markdown';

export interface CreateEditorStateOptions {
  content?: string;
  placeholder?: string;
  onSelectionChange?: SelectionCallback;
  vaultRoot?: string;
  /** Host capability: persist a pasted/dropped image, returns its in-document src. */
  saveImage: SaveImage;
  onMatchesChange?: (matches: SearchMatch[]) => void;
  markdownInput?: boolean;
}

export function createEditorState(opts: CreateEditorStateOptions): EditorState {
  const {
    content = '',
    placeholder = 'Start writing...',
    onSelectionChange,
    vaultRoot = '',
    saveImage,
    onMatchesChange,
    markdownInput = false,
  } = opts;

  const plugins = [
    history(),
    columnResizing(),
    tableEditing(),
    editorKeymap,
    placeholderPlugin(placeholder),
    imageUploadPlugin(() => vaultRoot, saveImage),
    footnotePlugin(),
    searchHighlightPlugin(onMatchesChange ?? (() => {})),
  ];
  if (markdownInput) {
    plugins.push(buildInputRules(schema));
  }
  if (onSelectionChange) {
    plugins.push(bubbleToolbarPlugin(onSelectionChange));
  }
  return EditorState.create({
    schema,
    doc: content ? parseMarkdown(content) : undefined,
    plugins,
  });
}
