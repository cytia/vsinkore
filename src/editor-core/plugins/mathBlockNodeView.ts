import katex from 'katex';
import type { Node } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export class MathBlockNodeView {
  dom: HTMLElement;

  private textarea: HTMLTextAreaElement;
  private preview: HTMLElement;
  private deleteBtn!: HTMLButtonElement;
  private view: EditorView;
  private getPos: () => number | undefined;

  private _onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  private _onInput = () => { this.renderPreview(this.textarea.value); };

  private _onBlur = () => { this.commitTex(); };

  private _onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      this.textarea.blur();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const val = this.textarea.value;
      if (val.endsWith('\n') || val === '') {
        e.preventDefault();
        if (val.endsWith('\n')) {
          this.textarea.value = val.slice(0, -1);
        }
        this._exitBlock();
      }
    }
  };

  private _exitBlock() {
    const pos = this.getPos();
    if (pos == null) return;
    this.commitTex();
    const { state, dispatch } = this.view;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    const after = pos + node.nodeSize;
    const $after = state.doc.resolve(after);
    if ($after.nodeAfter) {
      dispatch(state.tr.setSelection(TextSelection.near($after)));
    } else {
      const { paragraph } = state.schema.nodes;
      const tr = state.tr.insert(after, paragraph.create());
      dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(after + 1))));
    }
    this.view.focus();
  }

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

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('div');
    this.dom.className = 'pm-math-block';

    // bar: label + delete button
    const bar = document.createElement('div');
    bar.className = 'pm-math-block-bar';

    const label = document.createElement('span');
    label.className = 'pm-math-block-label';
    label.textContent = '公式';

    this.deleteBtn = document.createElement('button');
    this.deleteBtn.className = 'pm-math-block-delete';
    this.deleteBtn.type = 'button';
    this.deleteBtn.setAttribute('data-tooltip', '删除');
    this.deleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="2 4 14 4"/><path d="M6 4V2h4v2"/><rect x="3" y="4" width="10" height="10" rx="1.5"/><line x1="6" y1="7" x2="6" y2="11"/><line x1="10" y1="7" x2="10" y2="11"/></svg>`;
    this.deleteBtn.addEventListener('mousedown', this._onDelete);

    bar.appendChild(label);
    bar.appendChild(this.deleteBtn);

    // textarea
    this.textarea = document.createElement('textarea');
    this.textarea.className = 'pm-math-block-input';
    this.textarea.rows = 1;
    this.textarea.spellcheck = false;
    this.textarea.placeholder = '输入 LaTeX 公式…';
    this.textarea.addEventListener('input', this._onInput);
    this.textarea.addEventListener('blur', this._onBlur);
    this.textarea.addEventListener('keydown', this._onKeyDown);

    // preview
    this.preview = document.createElement('div');
    this.preview.className = 'pm-math-block-preview';

    this.dom.appendChild(bar);
    this.dom.appendChild(this.textarea);
    this.dom.appendChild(this.preview);
    this.dom.addEventListener('contextmenu', this._onContextMenu);

    this.updateFromNode(node);
  }

  update(node: Node): boolean {
    if (node.type.name !== 'math_block') return false;
    // only sync if textarea is not focused (user is not actively editing)
    if (document.activeElement !== this.textarea) {
      this.updateFromNode(node);
    }
    return true;
  }

  destroy() {
    this.dom.removeEventListener('contextmenu', this._onContextMenu);
    this.textarea.removeEventListener('input', this._onInput);
    this.textarea.removeEventListener('blur', this._onBlur);
    this.textarea.removeEventListener('keydown', this._onKeyDown);
    this.deleteBtn.removeEventListener('mousedown', this._onDelete);
  }

  stopEvent() { return true; }
  ignoreMutation() { return true; }

  private updateFromNode(node: Node) {
    const tex = (node.attrs.tex as string) ?? '';
    this.textarea.value = tex;
    this.renderPreview(tex);
  }

  private renderPreview(tex: string) {
    if (tex.trim()) {
      this.preview.innerHTML = katex.renderToString(tex, { throwOnError: false, displayMode: true });
    } else {
      this.preview.textContent = '';
    }
  }

  private commitTex() {
    const pos = this.getPos();
    if (pos == null) return;
    const tex = this.textarea.value;
    const { state } = this.view;
    const node = state.doc.nodeAt(pos);
    if (!node || node.attrs.tex === tex) return;
    this.view.dispatch(state.tr.setNodeMarkup(pos, undefined, { tex }));
  }
}
