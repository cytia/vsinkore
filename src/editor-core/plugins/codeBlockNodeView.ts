import type { Node } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';

const LANGUAGES = [
  'typescript', 'javascript', 'python', 'rust', 'go', 'java',
  'c', 'cpp', 'csharp', 'html', 'css', 'json', 'yaml', 'toml',
  'markdown', 'sql', 'bash', 'sh', 'dockerfile', 'graphql',
  'ruby', 'php', 'swift', 'kotlin', 'plaintext',
];

export class CodeBlockNodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;

  private view: EditorView;
  private getPos: () => number | undefined;

  private header: HTMLElement;
  private langTrigger: HTMLButtonElement;
  private langLabel: HTMLElement;
  private dropdown: HTMLElement;
  private copyBtn: HTMLButtonElement;
  private deleteBtn: HTMLButtonElement;

  private copyTimer: ReturnType<typeof setTimeout> | null = null;
  private dropdownOpen = false;
  private focusedIndex = -1;
  private outsideClickHandler: (e: MouseEvent) => void;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.view = view;
    this.getPos = getPos;

    // ── outer wrapper ────────────────────────────
    this.dom = document.createElement('div');
    this.dom.className = 'pm-code-block';

    // ── header bar (position:relative for dropdown anchor) ──
    this.header = document.createElement('div');
    this.header.className = 'pm-code-block-header';

    // language trigger button
    this.langTrigger = document.createElement('button');
    this.langTrigger.type = 'button';
    this.langTrigger.className = 'pm-code-lang-trigger';
    this.langTrigger.setAttribute('contenteditable', 'false');
    this.langTrigger.addEventListener('mousedown', (e) => e.preventDefault());
    this.langTrigger.addEventListener('click', () => this.toggleDropdown());

    this.langLabel = document.createElement('span');
    this.langLabel.className = 'pm-code-lang-label';

    const chevron = document.createElement('span');
    chevron.className = 'pm-code-lang-chevron';
    chevron.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="2 3.5 5 6.5 8 3.5"/></svg>`;

    this.langTrigger.appendChild(this.langLabel);
    this.langTrigger.appendChild(chevron);

    // dropdown (anchored to header)
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'pm-code-lang-dropdown';
    this.dropdown.setAttribute('contenteditable', 'false');

    // copy button
    this.copyBtn = document.createElement('button');
    this.copyBtn.type = 'button';
    this.copyBtn.className = 'pm-code-copy';
    this.copyBtn.setAttribute('contenteditable', 'false');
    this.copyBtn.setAttribute('data-tooltip', '复制');
    this.copyBtn.addEventListener('mousedown', (e) => e.preventDefault());
    this.copyBtn.addEventListener('click', () => this.handleCopy());

    // delete button
    this.deleteBtn = document.createElement('button');
    this.deleteBtn.type = 'button';
    this.deleteBtn.className = 'pm-code-delete';
    this.deleteBtn.setAttribute('contenteditable', 'false');
    this.deleteBtn.setAttribute('data-tooltip', '删除');
    this.deleteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="2 4 14 4"/><path d="M6 4V2h4v2"/><rect x="3" y="4" width="10" height="10" rx="1.5"/><line x1="6" y1="7" x2="6" y2="11"/><line x1="10" y1="7" x2="10" y2="11"/></svg>`;
    this.deleteBtn.addEventListener('mousedown', (e) => e.preventDefault());
    this.deleteBtn.addEventListener('click', () => this.handleDelete());

    const rightActions = document.createElement('div');
    rightActions.className = 'pm-code-actions';
    rightActions.setAttribute('contenteditable', 'false');
    rightActions.appendChild(this.copyBtn);
    rightActions.appendChild(this.deleteBtn);

    this.header.appendChild(this.langTrigger);
    this.header.appendChild(this.dropdown);
    this.header.appendChild(rightActions);
    this.dom.appendChild(this.header);

    // ── pre > code (contentDOM = <code>) ─────────
    const pre = document.createElement('pre');
    this.contentDOM = document.createElement('code');
    pre.appendChild(this.contentDOM);
    this.dom.appendChild(pre);

    // close dropdown on outside click
    this.outsideClickHandler = (e: MouseEvent) => {
      if (this.dropdownOpen && !this.header.contains(e.target as globalThis.Node)) {
        this.closeDropdown();
      }
    };
    document.addEventListener('mousedown', this.outsideClickHandler);

    this.update(node);
  }

  stopEvent(event: Event): boolean {
    return this.header.contains(event.target as globalThis.Node);
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: globalThis.Node }): boolean {
    return !this.contentDOM.contains(mutation.target);
  }

  update(node: Node): boolean {
    if (node.type.name !== 'code_block') return false;
    const lang = (node.attrs.language as string) || '';
    this.setLangLabel(lang);
    this.renderCopyIdle();
    return true;
  }

  destroy() {
    if (this.copyTimer) clearTimeout(this.copyTimer);
    document.removeEventListener('mousedown', this.outsideClickHandler);
  }

  // ── Language label ────────────────────────────

  private setLangLabel(lang: string) {
    if (lang) {
      this.langLabel.textContent = lang;
      this.langLabel.classList.remove('pm-code-lang-placeholder');
    } else {
      this.langLabel.textContent = '选择语言';
      this.langLabel.classList.add('pm-code-lang-placeholder');
    }
  }

  // ── Dropdown ──────────────────────────────────

  private toggleDropdown() {
    this.dropdownOpen ? this.closeDropdown() : this.openDropdown();
  }

  private openDropdown() {
    this.dropdownOpen = true;
    this.focusedIndex = -1;
    this.langTrigger.classList.add('pm-code-lang-trigger--open');

    const pos = this.getPos();
    const currentNode = pos !== undefined ? this.view.state.doc.nodeAt(pos) : null;
    const activeLang = (currentNode?.attrs.language as string) || '';

    this.dropdown.innerHTML = '';

    // search input
    const input = document.createElement('input');
    input.className = 'pm-code-lang-search';
    input.placeholder = '搜索语言…';
    input.autocomplete = 'off';
    this.dropdown.appendChild(input);

    // list container
    const list = document.createElement('div');
    list.className = 'pm-code-lang-list';
    this.dropdown.appendChild(list);

    const render = (query: string) => {
      list.innerHTML = '';
      this.focusedIndex = -1;
      const q = query.toLowerCase().trim();
      const filtered = q ? LANGUAGES.filter(l => l.includes(q)) : LANGUAGES;

      filtered.forEach(lang => {
        const item = document.createElement('div');
        item.className = 'pm-code-lang-item' + (lang === activeLang ? ' pm-code-lang-item--selected' : '');
        item.textContent = lang;
        item.addEventListener('mousedown', (e) => { e.preventDefault(); this.selectLang(lang); });
        list.appendChild(item);
      });

      // custom entry when query has no exact preset match
      if (q && !LANGUAGES.includes(q)) {
        const custom = document.createElement('div');
        custom.className = 'pm-code-lang-item pm-code-lang-item--custom';
        const label = document.createTextNode('使用 ');
        const strong = document.createElement('strong');
        strong.textContent = q;
        custom.appendChild(label);
        custom.appendChild(strong);
        custom.addEventListener('mousedown', (e) => { e.preventDefault(); this.selectLang(q); });
        list.appendChild(custom);
      }
    };

    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll<HTMLElement>('.pm-code-lang-item')];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.focusedIndex = Math.min(this.focusedIndex + 1, items.length - 1);
        items.forEach((it, i) => it.classList.toggle('pm-code-lang-item--focused', i === this.focusedIndex));
        items[this.focusedIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
        items.forEach((it, i) => it.classList.toggle('pm-code-lang-item--focused', i === this.focusedIndex));
        items[this.focusedIndex]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.focusedIndex >= 0 && items[this.focusedIndex]) {
          items[this.focusedIndex].dispatchEvent(new MouseEvent('mousedown'));
        } else if (input.value.trim()) {
          this.selectLang(input.value.trim());
        }
      } else if (e.key === 'Escape') {
        this.closeDropdown();
      }
    });

    render('');
    this.dropdown.classList.add('pm-code-lang-dropdown--open');
    requestAnimationFrame(() => input.focus());
  }

  private closeDropdown() {
    this.dropdownOpen = false;
    this.focusedIndex = -1;
    this.langTrigger.classList.remove('pm-code-lang-trigger--open');
    this.dropdown.classList.remove('pm-code-lang-dropdown--open');
    this.dropdown.innerHTML = '';
  }

  private selectLang(lang: string) {
    const pos = this.getPos();
    if (pos === undefined) return;
    const { state } = this.view;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: lang });
    this.view.dispatch(tr);
    this.closeDropdown();
  }

  // ── Delete ───────────────────────────────────

  private handleDelete() {
    const pos = this.getPos();
    if (pos === undefined) return;
    const { state } = this.view;
    const node = state.doc.nodeAt(pos);
    if (!node) return;
    this.view.dispatch(state.tr.delete(pos, pos + node.nodeSize));
  }

  // ── Copy ──────────────────────────────────────

  private handleCopy() {
    const text = this.contentDOM.textContent ?? '';
    navigator.clipboard.writeText(text).then(() => {
      this.renderCopied();
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.renderCopyIdle(), 1800);
    }).catch(() => {});
  }

  private renderCopyIdle() {
    this.copyBtn.classList.remove('pm-code-copy--done');
    this.copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/></svg>`;
  }

  private renderCopied() {
    this.copyBtn.classList.add('pm-code-copy--done');
    this.copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="2 8 6 12 14 4"/></svg>`;
  }
}
