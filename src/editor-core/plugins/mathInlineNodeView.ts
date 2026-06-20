import katex from 'katex';
import type { Node } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

export class MathInlineNodeView {
  dom: HTMLElement;

  private render: HTMLElement;
  private input: HTMLInputElement;
  private view: EditorView;
  private getPos: () => number | undefined;

  private _onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  private _onClick = (e: MouseEvent) => {
    e.stopPropagation();
    this.openEdit();
  };

  private _onInputKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); this.commitEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
    // prevent ProseMirror from handling any key while input is open
    e.stopPropagation();
  };

  private _onInputBlur = () => { this.commitEdit(); };

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('span');
    this.dom.className = 'pm-math-inline';

    this.render = document.createElement('span');
    this.render.className = 'pm-math-inline-render';

    this.input = document.createElement('input');
    this.input.className = 'pm-math-inline-input';
    this.input.type = 'text';
    this.input.style.display = 'none';
    this.input.placeholder = '输入 LaTeX…';

    this.dom.appendChild(this.render);
    this.dom.appendChild(this.input);

    this.dom.addEventListener('contextmenu', this._onContextMenu);
    this.dom.addEventListener('click', this._onClick);
    this.input.addEventListener('keydown', this._onInputKeyDown);
    this.input.addEventListener('blur', this._onInputBlur);

    this.renderTex(node.attrs.tex as string);
    this.dom.classList.toggle('pm-math-inline--editing', !(node.attrs.tex as string));
  }

  update(node: Node): boolean {
    if (node.type.name !== 'math_inline') return false;
    this.renderTex(node.attrs.tex as string);
    return true;
  }

  destroy() {
    this.dom.removeEventListener('contextmenu', this._onContextMenu);
    this.dom.removeEventListener('click', this._onClick);
    this.input.removeEventListener('keydown', this._onInputKeyDown);
    this.input.removeEventListener('blur', this._onInputBlur);
  }

  stopEvent(e: Event): boolean {
    // let input's own events through, block everything else
    return this.input.style.display !== 'none' && e.target === this.input;
  }

  ignoreMutation() { return true; }

  private renderTex(tex: string) {
    if (tex) {
      this.render.innerHTML = katex.renderToString(tex, { throwOnError: false, displayMode: false });
      this.render.className = 'pm-math-inline-render';
    } else {
      this.render.innerHTML = '';
      this.render.className = 'pm-math-inline-placeholder';
      this.render.textContent = '公式';
    }
  }

  private openEdit() {
    const pos = this.getPos();
    if (pos == null) return;
    const tex = (this.view.state.doc.nodeAt(pos)?.attrs.tex as string) ?? '';
    this.input.value = tex;
    this.input.style.display = '';
    this.render.style.display = 'none';
    this.dom.classList.add('pm-math-inline--editing');
    this.input.focus();
    this.input.select();
  }

  private commitEdit() {
    const pos = this.getPos();
    if (pos == null) { this.closeEdit(); return; }
    const tex = this.input.value;
    this.closeEdit();
    const { state } = this.view;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    this.view.dispatch(state.tr.setNodeMarkup(pos, undefined, { tex }));
  }

  private cancelEdit() { this.closeEdit(); }

  private closeEdit() {
    this.input.style.display = 'none';
    this.render.style.display = '';
    this.dom.classList.remove('pm-math-inline--editing');
  }
}
