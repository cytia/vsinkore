import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const placeholderKey = new PluginKey('placeholder');

export function placeholderPlugin(text: string): Plugin {
  const el = document.createElement('span');
  el.className = 'pm-placeholder';
  el.textContent = text;

  return new Plugin({
    key: placeholderKey,
    props: {
      decorations(state) {
        const doc = state.doc;
        if (doc.childCount !== 1) return null;
        const firstChild = doc.firstChild;
        if (!firstChild || firstChild.content.size > 0) return null;
        return DecorationSet.create(doc, [
          Decoration.widget(1, el, { side: -1 }),
        ]);
      },
    },
  });
}
