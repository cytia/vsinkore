import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as ProsemirrorNode } from 'prosemirror-model';
import type { SearchMatch, SearchOpts } from '../host';

export const searchHighlightKey = new PluginKey<SearchPluginState>('searchHighlight');

interface SearchPluginState {
  query: string;
  opts: SearchOpts;
  matches: SearchMatch[];
  activeIndex: number;
}

// ── match helpers ────────────────────────────────────────────────────────────

function parseQuery(raw: string): { query: string; regex: boolean } {
  const m = raw.match(/^\/(.+)\/([gi]*)$/);
  if (m) return { query: m[1], regex: true };
  return { query: raw, regex: false };
}

function findRanges(
  text: string,
  query: string,
  opts: SearchOpts,
): { start: number; end: number }[] {
  if (!query) return [];
  const { regex } = parseQuery(query);
  const effectiveRegex = regex || opts.regex;

  if (effectiveRegex) {
    try {
      const flags = opts.caseSensitive ? 'g' : 'gi';
      const re = new RegExp(query, flags);
      const out: { start: number; end: number }[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        out.push({ start: m.index, end: m.index + m[0].length });
        if (m[0].length === 0) re.lastIndex++;
      }
      return out;
    } catch {
      return [];
    }
  }

  if (opts.fuzzy) {
    const t = opts.caseSensitive ? text : text.toLowerCase();
    const q = opts.caseSensitive ? query : query.toLowerCase();
    const out: { start: number; end: number }[] = [];
    let qi = 0, start = -1;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) {
        if (qi === 0) start = i;
        qi++;
        if (qi === q.length) {
          out.push({ start, end: i + 1 });
          qi = 0; start = -1;
        }
      }
    }
    return out;
  }

  // exact
  const t = opts.caseSensitive ? text : text.toLowerCase();
  const q = opts.caseSensitive ? query : query.toLowerCase();
  const out: { start: number; end: number }[] = [];
  let idx = t.indexOf(q);
  while (idx !== -1) {
    out.push({ start: idx, end: idx + q.length });
    idx = t.indexOf(q, idx + q.length);
  }
  return out;
}

// ── scan doc and return matches with ProseMirror positions ──────────────────

export function collectMatches(
  doc: ProsemirrorNode,
  query: string,
  opts: SearchOpts,
): SearchMatch[] {
  const matches: SearchMatch[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const text = node.text ?? '';
    const ranges = findRanges(text, query, opts);
    if (!ranges.length) return false;

    matches.push({
      from: pos + ranges[0].start,
      to: pos + ranges[0].end,
      lineText: text,
      ranges,
    });
    return false;
  });

  return matches;
}

// ── plugin ───────────────────────────────────────────────────────────────────

export interface SearchHighlightMeta {
  query?: string;
  opts?: SearchOpts;
  activeIndex?: number;
}

export function searchHighlightPlugin(
  onMatchesChange: (matches: SearchMatch[]) => void,
): Plugin {
  return new Plugin<SearchPluginState>({
    key: searchHighlightKey,

    state: {
      init(): SearchPluginState {
        return {
          query: '',
          opts: { fuzzy: false, caseSensitive: false, regex: false, vaultScope: false },
          matches: [],
          activeIndex: -1,
        };
      },
      apply(tr, prev): SearchPluginState {
        const meta: SearchHighlightMeta | undefined = tr.getMeta(searchHighlightKey);
        const query    = meta?.query    !== undefined ? meta.query    : prev.query;
        const opts     = meta?.opts     !== undefined ? meta.opts     : prev.opts;
        const activeIndex = meta?.activeIndex !== undefined ? meta.activeIndex : prev.activeIndex;

        if (!tr.docChanged && !meta) return prev;

        // only rescan when query/opts actually changed, not for activeIndex-only updates
        const queryChanged = query !== prev.query || opts !== prev.opts;
        const matches = queryChanged || tr.docChanged
          ? (query ? collectMatches(tr.doc, query, opts) : [])
          : prev.matches;

        if (queryChanged || tr.docChanged) {
          queueMicrotask(() => onMatchesChange(matches));
        }

        return { query, opts, matches, activeIndex };
      },
    },

    props: {
      decorations(state) {
        const { query, matches, activeIndex } = searchHighlightKey.getState(state)!;
        if (!query || !matches.length) return DecorationSet.empty;

        const decos = matches.map((m, i) =>
          Decoration.inline(m.from, m.to, {
            class: i === activeIndex ? 'search-match-active' : 'search-match',
          }),
        );
        return DecorationSet.create(state.doc, decos);
      },
    },
  });
}
