import type { Node } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import type { ToRenderUrl } from '../host';

const URL_RE = /^https?:\/\//i;

function resolveImageSrc(src: string, vaultRoot: string, toRenderUrl: ToRenderUrl): string {
  if (!src) return '';
  if (URL_RE.test(src)) return src;
  return toRenderUrl(vaultRoot, src);
}

export type ImageContextMenuHandler = (pos: number, src: string, width: string, x: number, y: number, cardRect: DOMRect) => void;

export class ImageNodeView {
  dom: HTMLElement;

  private img: HTMLImageElement;
  private errorEl: HTMLElement;
  private vaultRoot: string;
  private toRenderUrl: ToRenderUrl;
  private view: EditorView;
  private getPos: () => number | undefined;
  private onContextMenu: ImageContextMenuHandler;

  private _onError = () => {
    this.img.style.display = 'none';
    this.errorEl.style.display = '';
  };
  private _onLoad = () => {
    this.img.style.display = '';
    this.errorEl.style.display = 'none';
  };
  private _onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = this.getPos();
    if (pos == null) return;
    const n = this.view.state.doc.nodeAt(pos);
    if (!n) return;
    const cardEl = this.view.dom.closest('[data-editor-card]') ?? this.view.dom.parentElement ?? this.view.dom;
    const cardRect = cardEl.getBoundingClientRect();
    this.onContextMenu(pos, n.attrs.src as string, n.attrs.width as string, e.clientX, e.clientY, cardRect);
  };

  constructor(
    node: Node,
    view: EditorView,
    getPos: () => number | undefined,
    vaultRoot: string,
    toRenderUrl: ToRenderUrl,
    onContextMenu: ImageContextMenuHandler,
  ) {
    this.vaultRoot = vaultRoot;
    this.toRenderUrl = toRenderUrl;
    this.view = view;
    this.getPos = getPos;
    this.onContextMenu = onContextMenu;

    this.dom = document.createElement('span');
    this.dom.className = 'pm-image-wrapper';

    this.img = document.createElement('img');
    this.img.className = 'pm-image';
    this.img.draggable = true;

    this.errorEl = document.createElement('span');
    this.errorEl.className = 'pm-image-error';
    this.errorEl.textContent = '图片加载失败';
    this.errorEl.style.display = 'none';

    this.img.addEventListener('error', this._onError);
    this.img.addEventListener('load', this._onLoad);
    this.dom.addEventListener('contextmenu', this._onContextMenu);

    this.dom.appendChild(this.img);
    this.dom.appendChild(this.errorEl);

    this.updateAttrs(node);
  }

  update(node: Node): boolean {
    if (node.type.name !== 'image') return false;
    this.updateAttrs(node);
    return true;
  }

  private updateAttrs(node: Node) {
    const src = (node.attrs.src as string) || '';
    const width = (node.attrs.width as string) || 'auto';
    this.img.src = resolveImageSrc(src, this.vaultRoot, this.toRenderUrl);
    this.img.title = (node.attrs.title as string) || '';
    this.img.style.maxWidth = width !== 'auto' ? width : '';
    this.img.style.display = '';
    this.errorEl.style.display = 'none';
  }

  destroy() {
    this.img.removeEventListener('error', this._onError);
    this.img.removeEventListener('load', this._onLoad);
    this.dom.removeEventListener('contextmenu', this._onContextMenu);
  }

  stopEvent() { return false; }
  ignoreMutation() { return true; }
}
