import MarkdownIt from 'markdown-it';
import { katex } from '@mdit/plugin-katex';
import { defaultMarkdownParser, defaultMarkdownSerializer, MarkdownSerializer, MarkdownParser } from 'prosemirror-markdown';
import { schema } from './schema';
import type { Node } from 'prosemirror-model';

// ─── Serializer ───────────────────────────────────────────────────────────────

export const customSerializer = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    image(state, node) {
      const src   = (node.attrs.src   as string) || '';
      const title = (node.attrs.title as string) || '';
      const width = (node.attrs.width as string) || 'auto';
      if (width && width !== 'auto') {
        const styleAttr = ` style="max-width:${width}"`;
        const titleAttr = title ? ` title="${title}"` : '';
        state.write(`<img src="${src}"${titleAttr}${styleAttr} />`);
      } else {
        state.write(`![](${src}${title ? ` "${title}"` : ''})`);
      }
    },
    code_block(state, node) {
      const lang = (node.attrs.language as string) || '';
      const content = node.textContent;
      const maxFence = Math.max(2, ...([...content.matchAll(/`+/g)].map(m => m[0].length)));
      const fence = '`'.repeat(maxFence + 1);
      state.write(fence + lang + '\n');
      state.text(content, false);
      state.ensureNewLine();
      state.write(fence);
      state.closeBlock(node);
    },
    task_list(state, node) {
      state.renderList(node, '  ', () => '- ');
    },
    task_item(state, node) {
      const checked = node.attrs.checked as boolean;
      state.write(checked ? '[x] ' : '[ ] ');
      state.renderContent(node);
    },
    table(state, node) {
      state.ensureNewLine();
      node.forEach((row, _, rowIdx) => {
        state.write('|');
        row.forEach((cell) => {
          state.write(' ');
          // cell is a block node; render its inline content via its first child paragraph
          const para = cell.firstChild;
          if (para) state.renderInline(para);
          state.write(' |');
        });
        state.write('\n');
        // separator row after header
        if (rowIdx === 0) {
          state.write('|');
          row.forEach((cell) => {
            const align = cell.attrs.alignment as string | null;
            if (align === 'center') state.write(' :---: |');
            else if (align === 'right') state.write(' ---: |');
            else state.write(' --- |');
          });
          state.write('\n');
        }
      });
      state.closeBlock(node);
    },
    table_row() {},
    table_header() {},
    table_cell() {},
    footnote_ref(state, node) {
      state.write(`[^${node.attrs.id}]`);
    },
    math_inline(state, node) {
      state.write(`$${node.attrs.tex as string}$`);
    },
    math_block(state, node) {
      state.write(`$$\n${node.attrs.tex as string}\n$$`);
      state.closeBlock(node);
    },
    footnote_def(state, node) {
      // Serialize as an HTML block so markdown-it's reference rule cannot
      // consume it. The htmlInlinePlugin core rule converts it back on parse.
      state.write(`<fn-def data-id="${node.attrs.id}">\n`);
      state.write(node.textContent);
      state.write(`\n</fn-def>`);
      state.closeBlock(node);
    },
    toc(state, node) {
      // Must span multiple lines so markdown-it treats it as html_block, not html_inline.
      state.write('<toc>\n</toc>');
      state.closeBlock(node);
    },
  },
  {
    ...defaultMarkdownSerializer.marks,
    underline: {
      open: '<u>',
      close: '</u>',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    strikethrough: {
      open: '~~',
      close: '~~',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
    textColor: {
      open(_state, mark) {
        return `<span style="color: ${mark.attrs.color}">`;
      },
      close: '</span>',
      mixable: true,
      expelEnclosingWhitespace: true,
    },
  },
);

// ─── Parser ───────────────────────────────────────────────────────────────────

// markdown-it with html + strikethrough + table so <u>, <span>, ~~, GFM tables are tokenized
const mdIt = new MarkdownIt({ html: true }).enable('strikethrough').enable('table');
mdIt.use(katex, { throwOnError: false });
mdIt.use(taskListPlugin);
mdIt.use(htmlInlinePlugin);
mdIt.use(tableCellWrapPlugin);
mdIt.use(footnotePlugin);

// tokenHandlers() auto-generates `${key}_open` and `${key}_close` handlers for mark specs.
// So keys must be the base name without _open/_close suffix.
// Plugin below produces tokens named `u_open`/`u_close`, `color_open`/`color_close`, `s_open`/`s_close`.
const tokenMap = {
  ...defaultMarkdownParser.tokens,
  image: {
    node: 'image',
    getAttrs: (tok: { attrGet: (n: string) => string | null; children?: Array<{ content: string }> }) => ({
      src:   tok.attrGet('src')   ?? '',
      title: tok.attrGet('title') ?? '',
      width: tok.attrGet('data-width') ?? 'auto',
    }),
  },
  fence: {
    block: 'code_block',
    getAttrs: (tok: { info: string }) => ({ language: tok.info.trim() }),
  },
  code_block: {
    block: 'code_block',
    getAttrs: () => ({ language: '' }),
  },
  s: { mark: 'strikethrough' },
  u: { mark: 'underline' },
  color: {
    mark: 'textColor',
    getAttrs: (tok: { attrGet: (name: string) => string | null }) => ({
      color: tok.attrGet('data-color') ?? '',
    }),
  },
  task_list: { block: 'task_list' },
  task_item: {
    block: 'task_item',
    getAttrs: (tok: { attrGet: (name: string) => string | null }) => ({
      checked: tok.attrGet('data-checked') === 'true',
    }),
  },
  math_inline: {
    node: 'math_inline',
    getAttrs: (tok: { content: string }) => ({ tex: tok.content }),
  },
  math_block: {
    node: 'math_block',
    getAttrs: (tok: { content: string }) => ({ tex: tok.content.trim() }),
  },
  footnote_ref: {
    node: 'footnote_ref',
    getAttrs: (tok: { attrGet: (n: string) => string | null }) => ({
      id: tok.attrGet('data-id') ?? '',
    }),
  },
  footnote_def: {
    block: 'footnote_def',
    getAttrs: (tok: { attrGet: (n: string) => string | null }) => ({
      id: tok.attrGet('data-id') ?? '',
    }),
  },
  toc: { node: 'toc' },
  table: { block: 'table' },
  thead: { ignore: true },
  tbody: { ignore: true },
  tr: { block: 'table_row' },
  th: {
    block: 'table_header',
    getAttrs: (tok: { attrGet: (name: string) => string | null }) => ({
      alignment: tok.attrGet('style')?.match(/text-align:\s*(\w+)/)?.[1] ?? null,
    }),
  },
  td: {
    block: 'table_cell',
    getAttrs: (tok: { attrGet: (name: string) => string | null }) => ({
      alignment: tok.attrGet('style')?.match(/text-align:\s*(\w+)/)?.[1] ?? null,
    }),
  },
};

// Wraps th/td inline content in paragraph_open/close so MarkdownParser can
// satisfy the cellContent: 'block+' constraint of prosemirror-tables nodes.
// Without this, the parser opens a table_header/table_cell node but finds no
// block children to put into it, discarding the cell's text silently.
function tableCellWrapPlugin(mdi: MarkdownIt) {
  mdi.core.ruler.push('table_cell_wrap', (state) => {
    const Token = state.Token;
    const out: typeof state.tokens = [];
    for (const tok of state.tokens) {
      if (tok.type === 'th_open' || tok.type === 'td_open') {
        out.push(tok);
        out.push(new Token('paragraph_open', 'p', 1));
      } else if (tok.type === 'th_close' || tok.type === 'td_close') {
        out.push(new Token('paragraph_close', 'p', -1));
        out.push(tok);
      } else {
        out.push(tok);
      }
    }
    state.tokens = out;
    return false;
  });
}

// Matches <img src="..." title="..." style="max-width:..." />
const IMG_RE = /<img\s[^>]*>/i;
const IMG_SRC_RE = /\bsrc="([^"]*)"/i;
const IMG_TITLE_RE = /\btitle="([^"]*)"/i;
const IMG_STYLE_MW_RE = /\bstyle="[^"]*max-width:\s*([^";]+)/i;

function parseImgTag(html: string): { src: string; title: string; width: string } | null {
  if (!IMG_RE.test(html)) return null;
  const src   = IMG_SRC_RE.exec(html)?.[1]   ?? '';
  const title = IMG_TITLE_RE.exec(html)?.[1]  ?? '';
  const width = IMG_STYLE_MW_RE.exec(html)?.[1]?.trim() ?? 'auto';
  return { src, title, width };
}

// Custom markdown-it plugin: turns <u>/</u>, <span style="color:..."></span> html_inline
// tokens into mark open/close pairs, and converts <img> html_block/html_inline tokens
// into image tokens that MarkdownParser can handle.
function htmlInlinePlugin(mdi: MarkdownIt) {
  const COLOR_RE = /^<span\s+style="color:\s*([^"]+)"\s*>/i;

  mdi.core.ruler.push('html_inline_marks', (state) => {
    const Token = state.Token;
    const out: typeof state.tokens = [];

    let i = 0;
    while (i < state.tokens.length) {
      const token = state.tokens[i];

      // html_block at top level: <fn-def>, <img>, or other
      if (token.type === 'html_block') {
        const raw = token.content.trim();

        // <fn-def data-id="1"> ... </fn-def>
        const fnFullRE = /^<fn-def\s+data-id="([^"]+)">([\s\S]*?)<\/fn-def>/i;
        const fnM = raw.match(fnFullRE);
        if (fnM) {
          const id      = fnM[1];
          const content = fnM[2].trim();

          const defOpen = new Token('footnote_def_open', '', 1);
          defOpen.attrSet('data-id', id);
          // footnote_def content is text* — emit an inline token directly,
          // no paragraph wrapper needed
          const inl    = new Token('inline', '', 0);
          inl.content  = content;
          inl.children = state.md.parseInline(content, state.env)[0]?.children ?? [];
          const defClose = new Token('footnote_def_close', '', -1);
          out.push(defOpen, inl, defClose);
          i++;
          continue;
        }

        // <toc>\n</toc>
        if (/^<toc>\s*<\/toc>$/i.test(raw)) {
          out.push(new Token('toc', '', 0));
          i++;
          continue;
        }

        // standalone <img ...>
        const imgAttrs = parseImgTag(raw);
        if (imgAttrs) {
          const pOpen  = new Token('paragraph_open',  'p', 1);
          const inline = new Token('inline', '', 0);
          const img    = new Token('image', 'img', 0);
          img.attrSet('src',   imgAttrs.src);
          img.attrSet('title', imgAttrs.title);
          img.attrSet('data-width', imgAttrs.width);
          img.children = [];
          inline.children = [img];
          const pClose = new Token('paragraph_close', 'p', -1);
          out.push(pOpen, inline, pClose);
          i++;
          continue;
        }
        // unrecognised html_block: drop
        i++;
        continue;
      }

      // inline tokens: handle html_inline children
      if (token.type === 'inline' && token.children) {
        const next: typeof token.children = [];
        for (const tok of token.children) {
          if (tok.type === 'html_inline') {
            const c = tok.content.trim();
            if (c === '<u>') {
              next.push(new Token('u_open', 'u', 1));
            } else if (c === '</u>') {
              next.push(new Token('u_close', 'u', -1));
            } else if (c === '</span>') {
              next.push(new Token('color_close', 'span', -1));
            } else {
              const colorM = c.match(COLOR_RE);
              if (colorM) {
                const t = new Token('color_open', 'span', 1);
                t.attrSet('data-color', colorM[1].trim());
                next.push(t);
              } else {
                // inline <img>
                const imgAttrs = parseImgTag(c);
                if (imgAttrs) {
                  const img = new Token('image', 'img', 0);
                  img.attrSet('src',   imgAttrs.src);
                  img.attrSet('title', imgAttrs.title);
                  img.attrSet('data-width', imgAttrs.width);
                  img.children = [];
                  next.push(img);
                }
                // other unknown html_inline: silently drop
              }
            }
          } else {
            next.push(tok);
          }
        }
        token.children = next;
      }

      out.push(token);
      i++;
    }

    state.tokens = out;
    return false;
  });
}

// Converts [^id] inline references into footnote_ref tokens.
// footnote_def block parsing is handled inside htmlInlinePlugin's core rule,
// which recognises the <fn-def data-id="..."> HTML blocks emitted by the serializer.
function footnotePlugin(mdi: MarkdownIt) {
  mdi.inline.ruler.before('link', 'footnote_ref', (state, silent) => {
    const src = state.src;
    const pos = state.pos;
    if (src.charCodeAt(pos) !== 0x5B /* [ */) return false;
    if (src.charCodeAt(pos + 1) !== 0x5E /* ^ */) return false;
    const end = src.indexOf(']', pos + 2);
    if (end < 0) return false;
    const id = src.slice(pos + 2, end).trim();
    if (!id) return false;
    if (!silent) {
      const token = state.push('footnote_ref', '', 0);
      token.attrSet('data-id', id);
    }
    state.pos = end + 1;
    return true;
  });
}

// Converts bullet_list blocks whose every list_item starts with "[ ] " or "[x] "
// into task_list_open/close + task_item_open/close tokens.
function taskListPlugin(mdi: MarkdownIt) {
  mdi.core.ruler.push('task_list', (state) => {
    const tokens = state.tokens;
    let i = 0;
    while (i < tokens.length) {
      if (tokens[i].type !== 'bullet_list_open') { i++; continue; }

      // Collect indices of list_item tokens within this bullet_list block
      let depth = 0;
      let allTask = true;
      const range: number[] = [i];
      for (let j = i; j < tokens.length; j++) {
        if (tokens[j].type === 'bullet_list_open') depth++;
        if (tokens[j].type === 'bullet_list_close') { depth--; range.push(j); if (depth === 0) break; }
      }

      // Check each top-level list_item for task prefix
      for (let j = i + 1; j < range[range.length - 1]; j++) {
        if (tokens[j].type !== 'list_item_open') continue;
        // find the first inline token inside this item
        const inlineIdx = j + 2; // list_item_open > paragraph_open > inline
        if (inlineIdx >= tokens.length || tokens[inlineIdx].type !== 'inline') { allTask = false; break; }
        const first = tokens[inlineIdx].children?.[0];
        if (!first || first.type !== 'text' || !/^\[[ xX]\] /.test(first.content)) { allTask = false; break; }
      }

      if (!allTask) { i++; continue; }

      // Rewrite tokens in-place
      tokens[i].type = 'task_list_open';
      tokens[i].tag = 'ul';
      tokens[range[range.length - 1]].type = 'task_list_close';
      tokens[range[range.length - 1]].tag = 'ul';

      for (let j = i + 1; j < range[range.length - 1]; j++) {
        if (tokens[j].type === 'list_item_open') {
          tokens[j].type = 'task_item_open';
          tokens[j].tag = 'li';
          // find inline and strip prefix, record checked
          const inlineIdx = j + 2;
          if (inlineIdx < tokens.length && tokens[inlineIdx].type === 'inline' && tokens[inlineIdx].children) {
            const first = tokens[inlineIdx].children![0];
            const checked = /^\[[ xX]\] /.test(first.content) && first.content[1].toLowerCase() === 'x';
            tokens[j].attrSet('data-checked', checked ? 'true' : 'false');
            first.content = first.content.slice(4);
          }
        }
        if (tokens[j].type === 'list_item_close') {
          tokens[j].type = 'task_item_close';
          tokens[j].tag = 'li';
        }
      }
      i++;
    }
    return false;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const customParser = new MarkdownParser(schema, mdIt, tokenMap as any);

export function parseMarkdown(content: string): Node {
  return (customParser.parse(content) as Node | null) ?? schema.topNodeType.createAndFill()!;
}

export function serializeMarkdown(doc: Node): string {
  return customSerializer.serialize(doc);
}
