import { toggleMark, setBlockType, wrapIn, lift } from 'prosemirror-commands';
import { wrapInList, liftListItem } from 'prosemirror-schema-list';
import type { Command, EditorState } from 'prosemirror-state';
import { schema } from './schema';

export const toggleBold = toggleMark(schema.marks.strong);
export const toggleItalic = toggleMark(schema.marks.em);
export const toggleCode = toggleMark(schema.marks.code);
export const toggleUnderline = toggleMark(schema.marks.underline);
export const toggleStrikethrough = toggleMark(schema.marks.strikethrough);

export function toggleTextColor(hex: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    const markType = schema.marks.textColor;
    // check if this exact color is already applied across the full selection
    let hasColor = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.marks.some((m) => m.type === markType && m.attrs.color === hex)) {
        hasColor = true;
      }
    });
    if (dispatch) {
      const tr = state.tr;
      // always remove existing textColor first to avoid layering
      tr.removeMark(from, to, markType);
      if (!hasColor) {
        tr.addMark(from, to, markType.create({ color: hex }));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export function setHeading(level: number): Command {
  return setBlockType(schema.nodes.heading, { level });
}

export const setParagraph: Command = setBlockType(schema.nodes.paragraph);

export const toggleBlockquote: Command = (state, dispatch) => {
  const { $from } = state.selection;
  // check if we're inside a blockquote
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === schema.nodes.blockquote) {
      return lift(state, dispatch);
    }
  }
  return wrapIn(schema.nodes.blockquote)(state, dispatch);
};

export const toggleCodeBlock: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if ($from.parent.type === schema.nodes.code_block) {
    return setBlockType(schema.nodes.paragraph)(state, dispatch);
  }
  return setBlockType(schema.nodes.code_block)(state, dispatch);
};

function toggleList(listType: typeof schema.nodes.bullet_list): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    // walk up to find if we're already inside this list type
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type === listType) {
        return liftListItem(schema.nodes.list_item)(state, dispatch);
      }
    }
    return wrapInList(listType)(state, dispatch);
  };
}

export const toggleBulletList: Command = toggleList(schema.nodes.bullet_list);
export const toggleOrderedList: Command = toggleList(schema.nodes.ordered_list);

export const toggleTaskList: Command = (state, dispatch) => {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === schema.nodes.task_list) {
      return liftListItem(schema.nodes.task_item)(state, dispatch);
    }
  }
  return wrapInList(schema.nodes.task_list)(state, dispatch);
};

export function toggleTaskItem(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type !== schema.nodes.task_item) return false;
    if (dispatch) {
      dispatch(state.tr.setNodeMarkup(pos, undefined, { checked: !node.attrs.checked }));
    }
    return true;
  };
}

export async function pasteAsPlainText(view: import('prosemirror-view').EditorView): Promise<void> {
  let text: string;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    return;
  }
  if (!text) return;
  const { state } = view;
  const pos = state.selection.to;
  view.dispatch(state.tr.insertText(text, pos).scrollIntoView());
}

export function copyAsPlainText(state: EditorState): void {
  const { from, to, empty } = state.selection;
  if (empty) return;
  let text = '';
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isText) text += node.text ?? '';
    else if (node.isBlock && text.length > 0) text += '\n';
  });
  navigator.clipboard.writeText(text.trim());
}

export const clearFormatting: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  if (dispatch) {
    let tr = state.tr;

    // remove all marks
    Object.values(schema.marks).forEach((markType) => {
      tr.removeMark(from, to, markType);
    });

    // collect wrapper nodes (blockquote, list containers) that need lifting,
    // in reverse order so deeper nodes are lifted first
    const wrappers: number[] = [];
    tr.doc.nodesBetween(tr.mapping.map(from), tr.mapping.map(to), (node, pos) => {
      if (
        node.type === schema.nodes.blockquote ||
        node.type === schema.nodes.bullet_list ||
        node.type === schema.nodes.ordered_list ||
        node.type === schema.nodes.task_list
      ) {
        wrappers.unshift(pos);
      }
    });

    // lift each wrapper by replacing it with its flattened paragraph content
    wrappers.forEach((pos) => {
      const mappedPos = tr.mapping.map(pos);
      const node = tr.doc.nodeAt(mappedPos);
      if (!node) return;
      const start = mappedPos;
      const end = mappedPos + node.nodeSize;
      // collect leaf block content (paragraph nodes inside list_items, or direct children)
      const paragraphs: import('prosemirror-model').Node[] = [];
      node.descendants((child) => {
        if (child.type === schema.nodes.list_item || child.type === schema.nodes.task_item) return true;
        if (child.isBlock && child.type !== schema.nodes.list_item && child.type !== schema.nodes.task_item) {
          paragraphs.push(
            child.type === schema.nodes.paragraph
              ? child
              : schema.nodes.paragraph.createAndFill({}, child.content) ?? schema.nodes.paragraph.create()
          );
          return false;
        }
        return true;
      });
      if (paragraphs.length > 0) {
        tr = tr.replaceWith(start, end, paragraphs);
      }
    });

    // reset remaining non-paragraph block nodes to paragraph
    tr.doc.nodesBetween(tr.mapping.map(from), tr.mapping.map(to), (node, pos) => {
      if (node.isBlock && node.type !== schema.nodes.paragraph && node.type !== schema.nodes.doc) {
        tr.setNodeMarkup(tr.mapping.map(pos), schema.nodes.paragraph, {});
      }
    });

    dispatch(tr.scrollIntoView());
  }
  return true;
};

export function isBlockActive(state: EditorState, blockName: string, attrs?: Record<string, unknown>): boolean {
  const { $from } = state.selection;
  const nodeType = schema.nodes[blockName];
  if (!nodeType) return false;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    if (node.type === nodeType) {
      if (!attrs) return true;
      return Object.entries(attrs).every(([k, v]) => node.attrs[k] === v);
    }
  }
  return false;
}

export function getLinkUrl(state: EditorState): string | null {
  const markType = schema.marks.link;
  const { from, $from, to, empty } = state.selection;
  if (empty) {
    const mark = markType.isInSet($from.marks());
    return mark ? (mark.attrs.href as string) : null;
  }
  let url: string | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    const mark = node.marks.find((m) => m.type === markType);
    if (mark) url = mark.attrs.href as string;
  });
  return url;
}

export function setLink(url: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    const markType = schema.marks.link;
    if (dispatch) {
      const tr = state.tr.removeMark(from, to, markType);
      if (url) tr.addMark(from, to, markType.create({ href: url, title: null }));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

// Handles both cases: selection → add mark; no selection → insert URL text with link mark.
export function upsertLink(url: string): Command {
  return (state, dispatch) => {
    if (!url) return false;
    const { from, to, empty } = state.selection;
    const markType = schema.marks.link;
    const mark = markType.create({ href: url, title: null });
    if (dispatch) {
      if (empty) {
        const textNode = schema.text(url, [mark]);
        dispatch(state.tr.replaceSelectionWith(textNode, false).scrollIntoView());
      } else {
        const tr = state.tr.removeMark(from, to, markType);
        tr.addMark(from, to, mark);
        dispatch(tr.scrollIntoView());
      }
    }
    return true;
  };
}

export function insertImage(src: string): Command {
  return (state, dispatch) => {
    const node = schema.nodes.image.create({ src });
    if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
    return true;
  };
}

export function replaceImageSrc(pos: number, src: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type !== schema.nodes.image) return false;
    if (dispatch) dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src }));
    return true;
  };
}

export function setImageWidth(pos: number, width: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type !== schema.nodes.image) return false;
    if (dispatch) dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, width }));
    return true;
  };
}

export function deleteImageNode(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (!node || node.type !== schema.nodes.image) return false;
    if (dispatch) dispatch(state.tr.delete(pos, pos + node.nodeSize));
    return true;
  };
}

export const insertToc: Command = (state, dispatch) => {
  let exists = false;
  state.doc.descendants((node) => {
    if (node.type === schema.nodes.toc) exists = true;
  });
  if (exists) return false;
  const node = schema.nodes.toc.create();
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
  return true;
};

export const insertMathInline: Command = (state, dispatch) => {
  const node = schema.nodes.math_inline.create({ tex: '' });
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
  return true;
};

export const insertMathBlock: Command = (state, dispatch) => {
  const { $from } = state.selection;
  // not allowed inside table cells
  for (let d = $from.depth; d > 0; d--) {
    const t = $from.node(d).type;
    if (t === schema.nodes.table_cell || t === schema.nodes.table_header) return false;
  }
  const node = schema.nodes.math_block.create({ tex: '' });
  if (dispatch) dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
  return true;
};

export const insertHorizontalRule: Command = (state, dispatch) => {
  const hrType = schema.nodes.horizontal_rule;
  if (dispatch) {
    const tr = state.tr;
    tr.replaceSelectionWith(hrType.create());
    dispatch(tr.scrollIntoView());
  }
  return true;
};

export const insertFootnote: Command = (state, dispatch) => {
  // count existing refs to determine next id
  let maxId = 0;
  state.doc.nodesBetween(0, state.doc.content.size, (node) => {
    if (node.type === schema.nodes.footnote_ref) {
      const n = parseInt(node.attrs.id as string, 10);
      if (!isNaN(n) && n > maxId) maxId = n;
      return false;
    }
    return true;
  });
  const id = String(maxId + 1);
  const ref = schema.nodes.footnote_ref.create({ id });
  // the sync plugin in appendTransaction will automatically create the def node
  if (dispatch) dispatch(state.tr.replaceSelectionWith(ref).scrollIntoView());
  return true;
};

export function isMarkActive(state: EditorState, markName: string): boolean {
  const markType = schema.marks[markName];
  if (!markType) return false;
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!markType.isInSet($from.marks());
  let active = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (node.isLeaf && markType.isInSet(node.marks)) active = true;
  });
  return active;
}
