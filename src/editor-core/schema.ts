import { Schema } from 'prosemirror-model';
import type { NodeSpec, MarkSpec } from 'prosemirror-model';
import OrderedMap from 'orderedmap';
import { nodes as basicNodes, marks as basicMarks } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { tableNodes } from 'prosemirror-tables';

const SAFE_HREF = /^(https?:\/\/|#|\/)/i;

const safeLinkMark: MarkSpec = {
  ...basicMarks.link,
  toDOM(node) {
    const href: string = node.attrs.href ?? '';
    return ['a', { ...node.attrs, href: SAFE_HREF.test(href) ? href : '#' }, 0];
  },
};

const underlineMark: MarkSpec = {
  toDOM() { return ['u', 0]; },
  parseDOM: [
    { tag: 'u' },
    { style: 'text-decoration=underline' },
  ],
};

const strikethroughMark: MarkSpec = {
  toDOM() { return ['s', 0]; },
  parseDOM: [
    { tag: 's' },
    { tag: 'del' },
    { tag: 'strike' },
    { style: 'text-decoration=line-through' },
  ],
};

const textColorMark: MarkSpec = {
  attrs: { color: {} },
  toDOM(node) {
    return ['span', { style: `color: ${node.attrs.color}` }, 0];
  },
  parseDOM: [{
    tag: 'span[style]',
    getAttrs(dom) {
      const color = (dom as HTMLElement).style.color;
      return color ? { color } : false;
    },
  }],
};

const imageSpec: NodeSpec = {
  inline: true,
  group: 'inline',
  draggable: true,
  atom: true,
  attrs: {
    src:   { default: '' },
    title: { default: '' },
    width: { default: 'auto' },
  },
  toDOM(node) {
    const { src, title, width } = node.attrs as { src: string; title: string; width: string };
    const style = width && width !== 'auto' ? `max-width:${width}` : undefined;
    return ['img', { src, title: title || undefined, style }];
  },
  parseDOM: [{
    tag: 'img[src]',
    getAttrs(dom) {
      const el = dom as HTMLElement;
      const style = el.getAttribute('style') ?? '';
      const mw = style.match(/max-width:\s*([^;]+)/)?.[1]?.trim() ?? 'auto';
      return { src: el.getAttribute('src') ?? '', title: el.getAttribute('title') ?? '', width: mw };
    },
  }],
};

const taskItemSpec: NodeSpec = {
  attrs: { checked: { default: false } },
  content: 'paragraph block*',
  defining: true,
  toDOM(node) {
    return [
      'li',
      { 'data-type': 'task-item', 'data-checked': node.attrs.checked ? 'true' : 'false' },
      0,
    ];
  },
  parseDOM: [{
    tag: 'li[data-type="task-item"]',
    getAttrs(dom) {
      return { checked: (dom as HTMLElement).getAttribute('data-checked') === 'true' };
    },
  }],
};

const taskListSpec: NodeSpec = {
  group: 'block',
  content: 'task_item+',
  toDOM() { return ['ul', { 'data-type': 'task-list' }, 0]; },
  parseDOM: [{ tag: 'ul[data-type="task-list"]' }],
};

const codeBlockSpec: NodeSpec = {
  ...basicNodes.code_block,
  attrs: { language: { default: '' } },
  toDOM(node) {
    return ['pre', { 'data-language': node.attrs.language || undefined }, ['code', 0]];
  },
  parseDOM: [
    {
      tag: 'pre',
      preserveWhitespace: 'full' as const,
      getAttrs(dom) {
        const pre = dom as HTMLElement;
        const code = pre.querySelector('code');
        const cls = code?.className ?? '';
        const langClass = cls.match(/(?:language|lang)-(\S+)/)?.[1] ?? '';
        return { language: pre.getAttribute('data-language') ?? langClass };
      },
    },
  ],
};

const mathInlineSpec: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  attrs: { tex: { default: '' } },
  toDOM(node) {
    return ['math-inline', { 'data-tex': node.attrs.tex }];
  },
  parseDOM: [{
    tag: 'math-inline[data-tex]',
    getAttrs(dom) {
      return { tex: (dom as HTMLElement).getAttribute('data-tex') ?? '' };
    },
  }],
};

const mathBlockSpec: NodeSpec = {
  group: 'block',
  atom: true,
  attrs: { tex: { default: '' } },
  toDOM(node) {
    return ['math-block', { 'data-tex': node.attrs.tex }];
  },
  parseDOM: [{
    tag: 'math-block[data-tex]',
    getAttrs(dom) {
      return { tex: (dom as HTMLElement).getAttribute('data-tex') ?? '' };
    },
  }],
};

const tocSpec: NodeSpec = {
  group: 'block',
  atom: true,
  toDOM() { return ['toc', 0]; },
  parseDOM: [{ tag: 'toc' }],
};

const footnoteRefSpec: NodeSpec = {
  inline: true,
  group: 'inline',
  atom: true,
  attrs: { id: { default: '' } },
  toDOM(node) {
    return ['footnote-ref', { 'data-id': node.attrs.id }];
  },
  parseDOM: [{
    tag: 'footnote-ref[data-id]',
    getAttrs(dom) {
      return { id: (dom as HTMLElement).getAttribute('data-id') ?? '' };
    },
  }],
};

const footnoteDefSpec: NodeSpec = {
  group: 'block',
  content: 'text*',
  attrs: { id: { default: '' } },
  toDOM(node) {
    return ['footnote-def', { 'data-id': node.attrs.id }, 0];
  },
  parseDOM: [{
    tag: 'footnote-def[data-id]',
    getAttrs(dom) {
      return { id: (dom as HTMLElement).getAttribute('data-id') ?? '' };
    },
  }],
};

const nodes = addListNodes(
  OrderedMap.from<NodeSpec>(basicNodes)
    .update('code_block', codeBlockSpec)
    .update('image', imageSpec),
  'paragraph block*',
  'block',
).append({ task_list: taskListSpec, task_item: taskItemSpec })
  .append({ footnote_ref: footnoteRefSpec, footnote_def: footnoteDefSpec })
  .append({ math_inline: mathInlineSpec, math_block: mathBlockSpec })
  .append({ toc: tocSpec })
  .append(tableNodes({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: {
      alignment: {
        default: null,
        getFromDOM(dom) { return (dom as HTMLElement).getAttribute('data-align'); },
        setDOMAttr(value, attrs) { if (value) attrs['data-align'] = value; },
      },
    },
  }));

const marks = OrderedMap.from<MarkSpec>(basicMarks)
  .update('link', safeLinkMark)
  .addToStart('underline', underlineMark)
  .addToStart('strikethrough', strikethroughMark)
  .addToStart('textColor', textColorMark);

export const schema = new Schema({ nodes, marks });
