import type { Node } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import { toggleTaskItem } from '../commands';

function makeCheckboxSvg(checked: boolean): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  const rect = document.createElementNS(ns, 'rect');
  if (checked) {
    rect.setAttribute('x', '1'); rect.setAttribute('y', '1');
    rect.setAttribute('width', '14'); rect.setAttribute('height', '14');
    rect.setAttribute('rx', '3');
    rect.setAttribute('fill', 'var(--accent)');
    rect.setAttribute('stroke', 'var(--accent)');
    rect.setAttribute('stroke-width', '1');
    const poly = document.createElementNS(ns, 'polyline');
    poly.setAttribute('points', '4.5 8 7 10.5 11.5 5.5');
    poly.setAttribute('stroke', 'var(--card)');
    poly.setAttribute('stroke-width', '1.8');
    poly.setAttribute('stroke-linecap', 'round');
    poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(rect);
    svg.appendChild(poly);
  } else {
    rect.setAttribute('x', '1.5'); rect.setAttribute('y', '1.5');
    rect.setAttribute('width', '13'); rect.setAttribute('height', '13');
    rect.setAttribute('rx', '2.5');
    rect.setAttribute('stroke', 'currentColor');
    rect.setAttribute('stroke-width', '1.5');
    svg.appendChild(rect);
  }
  return svg;
}

export class TaskItemNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private checkbox: HTMLSpanElement;
  private view: EditorView;
  private getPos: () => number | undefined;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('li');
    this.dom.setAttribute('data-type', 'task-item');

    this.checkbox = document.createElement('span');
    this.checkbox.className = 'task-checkbox';
    this.checkbox.setAttribute('contenteditable', 'false');
    this.checkbox.appendChild(makeCheckboxSvg(node.attrs.checked as boolean));
    this.checkbox.addEventListener('mousedown', this.handleClick);

    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'task-content';

    this.dom.appendChild(this.checkbox);
    this.dom.appendChild(this.contentDOM);
    this.setChecked(node.attrs.checked as boolean);
  }

  private handleClick = (e: MouseEvent) => {
    e.preventDefault();
    const pos = this.getPos();
    if (pos === undefined) return;
    toggleTaskItem(pos)(this.view.state, this.view.dispatch);
    this.view.focus();
  };

  update(node: Node): boolean {
    if (node.type !== this.view.state.schema.nodes.task_item) return false;
    this.setChecked(node.attrs.checked as boolean);
    return true;
  }

  private setChecked(checked: boolean) {
    this.dom.setAttribute('data-checked', checked ? 'true' : 'false');
    this.checkbox.innerHTML = '';
    this.checkbox.appendChild(makeCheckboxSvg(checked));
  }

  destroy() {
    this.checkbox.removeEventListener('mousedown', this.handleClick);
  }

  stopEvent(event: Event): boolean {
    return event.target === this.checkbox || this.checkbox.contains(event.target as unknown as globalThis.Node);
  }
}
