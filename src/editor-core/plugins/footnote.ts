import { Plugin, PluginKey } from 'prosemirror-state';
import type { Node } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import { schema } from '../schema';

export const footnotePluginKey = new PluginKey('footnote');

// ─── Popover singleton ────────────────────────────────────────────────────────

let popoverEl: HTMLElement | null = null;
let textareaEl: HTMLTextAreaElement | null = null;
let previewEl: HTMLElement | null = null;
let popoverMode: 'preview' | 'edit' = 'preview';
let popoverHideTimer: ReturnType<typeof setTimeout> | null = null;
let currentEditView: EditorView | null = null;
let currentEditId: string | null = null;

function getPopover(): HTMLElement {
  if (!popoverEl) {
    popoverEl = document.createElement('div');
    popoverEl.className = 'pm-fn-popover';

    previewEl = document.createElement('div');
    previewEl.className = 'pm-fn-popover__preview';
    popoverEl.appendChild(previewEl);

    textareaEl = document.createElement('textarea');
    textareaEl.className = 'pm-fn-popover__textarea';
    textareaEl.rows = 3;
    textareaEl.placeholder = '输入注脚内容…';
    popoverEl.appendChild(textareaEl);

    textareaEl.addEventListener('blur', commitEdit);
    textareaEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { commitEdit(); }
    });

    // keep popover alive when mouse is inside it
    popoverEl.addEventListener('mouseenter', cancelHidePopover);
    popoverEl.addEventListener('mouseleave', hidePopoverSoon);

    document.body.appendChild(popoverEl);
  }
  return popoverEl;
}

function positionPopover(anchor: HTMLElement) {
  const el = getPopover();
  el.style.top  = '-9999px';
  el.style.left = '-9999px';

  const rect = anchor.getBoundingClientRect();
  const pw   = 260;
  const ph   = el.offsetHeight;
  let top    = rect.top - ph - 8;
  if (top < 8) top = rect.bottom + 8;
  let left   = rect.left - 8;
  const maxLeft = window.innerWidth - pw - 8;
  if (left > maxLeft) left = maxLeft;
  el.style.top  = `${top}px`;
  el.style.left = `${left}px`;
}

function showPreview(anchor: HTMLElement, content: string) {
  if (popoverHideTimer) { clearTimeout(popoverHideTimer); popoverHideTimer = null; }
  // don't override an open edit popover
  if (popoverMode === 'edit' && popoverEl?.classList.contains('pm-fn-popover--visible')) return;

  popoverMode = 'preview';
  const el = getPopover();
  previewEl!.textContent = content || '（空注脚）';
  previewEl!.style.display = '';
  textareaEl!.style.display = 'none';
  el.style.pointerEvents = 'auto';
  el.classList.add('pm-fn-popover--visible');
  positionPopover(anchor);
}

function showEdit(anchor: HTMLElement, content: string, view: EditorView, id: string) {
  if (popoverHideTimer) { clearTimeout(popoverHideTimer); popoverHideTimer = null; }

  popoverMode = 'edit';
  currentEditView = view;
  currentEditId = id;

  const el = getPopover();
  previewEl!.style.display = 'none';
  textareaEl!.style.display = '';
  textareaEl!.value = content;
  el.style.pointerEvents = 'auto';
  el.classList.add('pm-fn-popover--visible');
  positionPopover(anchor);
  // focus after positioning so layout is stable
  requestAnimationFrame(() => {
    textareaEl!.focus();
    textareaEl!.selectionStart = textareaEl!.value.length;
    textareaEl!.selectionEnd   = textareaEl!.value.length;
  });
}

function commitEdit() {
  if (popoverMode !== 'edit' || !currentEditView || !currentEditId) return;
  const newText = textareaEl!.value;
  const view    = currentEditView;
  const id      = currentEditId;

  // find the footnote_def with this id and replace its content
  view.state.doc.forEach((node, offset) => {
    if (node.type === schema.nodes.footnote_def && node.attrs.id === id) {
      const from = offset + 1;               // inside the node
      const to   = offset + node.nodeSize - 1;
      const content = newText.length > 0
        ? schema.text(newText)
        : undefined;
      const newTr = view.state.tr.replaceWith(from, to, content ? [content] : []);
      view.dispatch(newTr);
    }
  });

  closePopover();
}

function closePopover() {
  popoverMode = 'preview';
  currentEditView = null;
  currentEditId = null;
  if (popoverEl) {
    popoverEl.classList.remove('pm-fn-popover--visible');
    popoverEl.style.pointerEvents = 'none';
  }
}

function hidePopoverSoon() {
  if (popoverMode === 'edit') return; // don't auto-hide while editing
  popoverHideTimer = setTimeout(() => {
    if (popoverEl) {
      popoverEl.classList.remove('pm-fn-popover--visible');
      popoverEl.style.pointerEvents = 'none';
    }
  }, 120);
}

function cancelHidePopover() {
  if (popoverHideTimer) { clearTimeout(popoverHideTimer); popoverHideTimer = null; }
}

// ─── Helper: get text content of a footnote_def node by id ───────────────────

function getDefText(doc: Node, id: string): string {
  let text = '';
  doc.forEach((node) => {
    if (node.type === schema.nodes.footnote_def && node.attrs.id === id) {
      text = node.textContent;
    }
  });
  return text;
}

// ─── Helper: get position of a footnote_ref node by id ───────────────────────

function getRefPos(doc: Node, id: string): number | null {
  let found: number | null = null;
  doc.nodesBetween(0, doc.content.size, (node, pos) => {
    if (found !== null) return false;
    if (node.type === schema.nodes.footnote_ref && node.attrs.id === id) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

// ─── FootnoteRefNodeView ──────────────────────────────────────────────────────

export class FootnoteRefNodeView implements NodeView {
  dom: HTMLElement;
  private view: EditorView;
  private _id: string;

  private _onMouseEnter = () => {
    const text = getDefText(this.view.state.doc, this._id);
    showPreview(this.dom, text);
  };
  private _onClick = (e: MouseEvent) => {
    e.preventDefault();
    const text = getDefText(this.view.state.doc, this._id);
    showEdit(this.dom, text, this.view, this._id);
  };

  constructor(node: Node, view: EditorView, _getPos: () => number | undefined) {
    this.view = view;
    this._id = node.attrs.id as string;

    this.dom = document.createElement('span');
    this.dom.className = 'pm-fn-ref';
    this.dom.setAttribute('data-id', this._id);
    this.dom.textContent = this._id;
    this.dom.contentEditable = 'false';

    this.dom.addEventListener('mouseenter', this._onMouseEnter);
    this.dom.addEventListener('mouseleave', hidePopoverSoon);
    this.dom.addEventListener('click', this._onClick);
  }

  update(node: Node) {
    if (node.type !== schema.nodes.footnote_ref) return false;
    this._id = node.attrs.id as string;
    this.dom.textContent = this._id;
    this.dom.setAttribute('data-id', this._id);
    return true;
  }

  destroy() {
    this.dom.removeEventListener('mouseenter', this._onMouseEnter);
    this.dom.removeEventListener('mouseleave', hidePopoverSoon);
    this.dom.removeEventListener('click', this._onClick);
    this.dom.remove();
  }
}

// ─── FootnoteDefNodeView ──────────────────────────────────────────────────────

export class FootnoteDefNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private numEl: HTMLElement;
  private view: EditorView;
  private _id: string;

  private _onNumClick = () => {
    const pos = getRefPos(this.view.state.doc, this._id);
    if (pos === null) return;
    const domNode = this.view.nodeDOM(pos);
    if (domNode instanceof HTMLElement) {
      domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      domNode.classList.add('pm-fn-ref--active');
      setTimeout(() => domNode.classList.remove('pm-fn-ref--active'), 1200);
    }
  };

  constructor(node: Node, view: EditorView, _getPos: () => number | undefined) {
    this.view = view;
    this._id = node.attrs.id as string;

    this.dom = document.createElement('div');
    this.dom.className = 'pm-fn-def';
    this.dom.setAttribute('data-id', this._id);

    this.numEl = document.createElement('span');
    this.numEl.className = 'pm-fn-def__num';
    this.numEl.textContent = this._id;
    this.numEl.contentEditable = 'false';
    this.numEl.addEventListener('click', this._onNumClick);

    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'pm-fn-def__body';

    this.dom.appendChild(this.numEl);
    this.dom.appendChild(this.contentDOM);
  }

  update(node: Node) {
    if (node.type !== schema.nodes.footnote_def) return false;
    this._id = node.attrs.id as string;
    this.numEl.textContent = this._id;
    this.dom.setAttribute('data-id', this._id);
    return true;
  }

  destroy() {
    this.numEl.removeEventListener('click', this._onNumClick);
    this.dom.remove();
  }
}

// ─── Sync plugin: keep footnote_def nodes in sync with footnote_ref nodes ────

export function footnotePlugin(
  onViewReady?: (view: EditorView) => void,
): Plugin {
  return new Plugin({
    key: footnotePluginKey,

    view(editorView) {
      onViewReady?.(editorView);
      return {};
    },

    appendTransaction(_trs, oldState, newState) {
      if (newState.doc.eq(oldState.doc)) return null;

      const refIds: string[] = [];
      newState.doc.nodesBetween(0, newState.doc.content.size, (node) => {
        if (node.type === schema.nodes.footnote_ref) {
          refIds.push(node.attrs.id as string);
          return false;
        }
        return true;
      });

      const defIds: string[] = [];
      newState.doc.forEach((node) => {
        if (node.type === schema.nodes.footnote_def) {
          defIds.push(node.attrs.id as string);
        }
      });

      const needsSync =
        refIds.length !== defIds.length ||
        refIds.some((id, i) => id !== defIds[i]);

      if (!needsSync) return null;

      const newIds = refIds.map((_, i) => String(i + 1));
      const idMap  = new Map<string, string>();
      refIds.forEach((oldId, i) => idMap.set(oldId, newIds[i]));

      // preserve existing def text content by old id
      const defText = new Map<string, string>();
      newState.doc.forEach((node) => {
        if (node.type === schema.nodes.footnote_def) {
          defText.set(node.attrs.id as string, node.textContent);
        }
      });

      const tr = newState.tr;

      // renumber all footnote_ref nodes
      newState.doc.nodesBetween(0, newState.doc.content.size, (node, pos) => {
        if (node.type === schema.nodes.footnote_ref) {
          const newId = idMap.get(node.attrs.id as string);
          if (newId && newId !== node.attrs.id) {
            tr.setNodeMarkup(tr.mapping.map(pos), undefined, { id: newId });
          }
          return false;
        }
        return true;
      });

      // remove all existing footnote_def nodes
      const toDelete: Array<{ from: number; to: number }> = [];
      tr.doc.forEach((node, offset) => {
        if (node.type === schema.nodes.footnote_def) {
          toDelete.push({ from: offset, to: offset + node.nodeSize });
        }
      });
      for (let i = toDelete.length - 1; i >= 0; i--) {
        const { from, to } = toDelete[i];
        tr.delete(tr.mapping.map(from), tr.mapping.map(to));
      }

      // append footnote_def nodes in new order
      const newDefs = newIds.map((newId, i) => {
        const oldId = refIds[i];
        const text  = defText.get(oldId) ?? '';
        return schema.nodes.footnote_def.create(
          { id: newId },
          text.length > 0 ? [schema.text(text)] : [],
        );
      });

      tr.insert(tr.doc.content.size, newDefs);
      tr.setMeta('footnoteSync', true);
      return tr;
    },
  });
}
