import type { Node } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { schema } from '../schema';

interface HeadingEntry {
  level: number;
  text: string;
}

function extractHeadings(doc: Node): HeadingEntry[] {
  const entries: HeadingEntry[] = [];
  doc.descendants((node) => {
    if (node.type === schema.nodes.heading) {
      entries.push({ level: node.attrs.level as number, text: node.textContent });
    }
  });
  return entries;
}

export class TocNodeView {
  dom: HTMLElement;

  private list: HTMLElement;
  private deleteBtn: HTMLButtonElement;
  private view: EditorView;
  private getPos: () => number | undefined;

  private _onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  private _onDelete = (e: MouseEvent) => {
    e.preventDefault();
    const pos = this.getPos();
    if (pos == null) return;
    const { state } = this.view;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    this.view.dispatch(state.tr.delete(pos, pos + node.nodeSize));
    this.view.focus();
  };

  constructor(_node: Node, view: EditorView, getPos: () => number | undefined) {
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.className = 'pm-toc';
    this.dom.contentEditable = 'false';

    const bar = document.createElement('div');
    bar.className = 'pm-toc-bar';

    const label = document.createElement('span');
    label.className = 'pm-toc-label';
    label.textContent = '目录';

    this.deleteBtn = document.createElement('button');
    this.deleteBtn.className = 'pm-toc-delete';
    this.deleteBtn.type = 'button';
    this.deleteBtn.setAttribute('data-tooltip', '删除');
    this.deleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="2 4 14 4"/><path d="M6 4V2h4v2"/><rect x="3" y="4" width="10" height="10" rx="1.5"/><line x1="6" y1="7" x2="6" y2="11"/><line x1="10" y1="7" x2="10" y2="11"/></svg>`;
    this.deleteBtn.addEventListener('mousedown', this._onDelete);

    bar.appendChild(label);
    bar.appendChild(this.deleteBtn);

    this.list = document.createElement('div');
    this.list.className = 'pm-toc-list';

    this.dom.appendChild(bar);
    this.dom.appendChild(this.list);
    this.dom.addEventListener('contextmenu', this._onContextMenu);

    this.renderList(view.state.doc);
  }

  update(node: Node): boolean {
    if (node.type.name !== 'toc') return false;
    this.renderList(this.view.state.doc);
    return true;
  }

  destroy() {
    this.dom.removeEventListener('contextmenu', this._onContextMenu);
    this.deleteBtn.removeEventListener('mousedown', this._onDelete);
  }

  stopEvent() { return true; }
  ignoreMutation() { return true; }

  private renderList(doc: Node) {
    const headings = extractHeadings(doc);
    this.list.innerHTML = '';

    if (headings.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'pm-toc-empty';
      empty.textContent = '暂无标题';
      this.list.appendChild(empty);
      return;
    }

    const minLevel = Math.min(...headings.map((h) => h.level));

    for (const h of headings) {
      const item = document.createElement('div');
      item.className = 'pm-toc-item';
      item.style.paddingLeft = `${(h.level - minLevel) * 16}px`;

      const dot = document.createElement('span');
      dot.className = 'pm-toc-dot';

      const text = document.createElement('span');
      text.textContent = h.text;

      item.appendChild(dot);
      item.appendChild(text);
      this.list.appendChild(item);
    }
  }
}
