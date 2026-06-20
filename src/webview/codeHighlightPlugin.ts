// Syntax-highlight decorations for code_block nodes ([D0-8]).
//
// Coloring is applied as ProseMirror inline decorations over the editable
// <code> text, never by mutating contentDOM — so editing keeps working and the
// core's CodeBlockNodeView (language dropdown / copy / delete header) is left
// untouched. Shiki tokenizes; languages load on demand and trigger a re-decorate
// once ready.
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node } from "prosemirror-model";
import {
  ensureLanguage,
  tokenize,
  refreshThemeIfChanged,
} from "./shikiHighlighter";

export const codeHighlightKey = new PluginKey<DecorationSet>("codeHighlight");

// Meta flag: an async language/theme load finished, recompute decorations.
const RECHECK = "codeHighlightRecheck";

/** Build inline color decorations for every supported code_block in the doc. */
function buildDecorations(doc: Node, requestLang: (lang: string) => void): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "code_block") return true;
    const lang = (node.attrs.language as string) || "";
    if (!lang) return false;

    const code = node.textContent;
    const lines = tokenize(code, lang);
    if (!lines) {
      // Grammar not loaded yet (or unsupported); request load, leave plain.
      requestLang(lang);
      return false;
    }

    // contentDOM text starts at pos + 1 (after the node's opening token).
    let offset = pos + 1;
    for (const line of lines) {
      for (const tok of line) {
        const len = tok.content.length;
        if (tok.className && len > 0) {
          decorations.push(
            Decoration.inline(offset, offset + len, { class: tok.className }),
          );
        }
        offset += len;
      }
      offset += 1; // the newline between tokenized lines
    }
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

export function codeHighlightPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: codeHighlightKey,

    state: {
      init(_config, state) {
        // No view yet at init; languages get requested on first transaction.
        return buildDecorations(state.doc, () => {});
      },
      apply(tr, old, _oldState, newState) {
        const recheck = tr.getMeta(RECHECK) === true;
        if (!tr.docChanged && !recheck) return old.map(tr.mapping, tr.doc);
        // A view-bound recompute happens in the view() hook via requestLang;
        // here we rebuild against the current doc with whatever is loaded.
        return buildDecorations(newState.doc, () => {});
      },
    },

    props: {
      decorations(state) {
        return codeHighlightKey.getState(state);
      },
    },

    view(editorView) {
      // Kick off loads for languages present at mount, plus theme detection.
      const requestLang = makeLangRequester(editorView);
      const seed = () => {
        editorView.state.doc.descendants((node) => {
          if (node.type.name === "code_block") {
            const lang = (node.attrs.language as string) || "";
            if (lang) requestLang(lang);
            return false;
          }
          return true;
        });
      };
      // Detect light/dark, then seed language loads.
      refreshThemeIfChanged().then(seed).catch(seed);

      return {
        update(view) {
          // New/changed blocks may introduce languages not yet loaded.
          view.state.doc.descendants((node) => {
            if (node.type.name === "code_block") {
              const lang = (node.attrs.language as string) || "";
              if (lang) requestLang(lang);
              return false;
            }
            return true;
          });
        },
      };
    },
  });
}

/** Returns a debounced-ish requester that re-decorates once a grammar loads. */
function makeLangRequester(view: EditorView): (lang: string) => void {
  const requested = new Set<string>();
  return (lang: string) => {
    const key = lang.toLowerCase().trim();
    if (requested.has(key)) return;
    requested.add(key);
    ensureLanguage(key).then((ok) => {
      if (!ok || view.isDestroyed) return;
      view.dispatch(view.state.tr.setMeta(RECHECK, true));
    });
  };
}
