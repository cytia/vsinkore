import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { EditorView } from 'prosemirror-view';
import { schema } from '../schema';
import type { SaveImage } from '../host';

export const imageUploadKey = new PluginKey<DecorationSet>('imageUpload');

const IMAGE_MIME = /^image\//;

function insertImageNode(view: EditorView, pos: number, src: string) {
  const node = schema.nodes.image.create({ src });
  view.dispatch(view.state.tr.insert(pos, node));
}


function findPlaceholder(set: DecorationSet, id: symbol): number {
  const found = set.find(undefined, undefined, (spec) => (spec as Record<string, unknown>).id === id);
  return found.length ? found[0].from : -1;
}

async function handleFiles(
  view: EditorView,
  files: FileList,
  insertPos: number,
  vaultRoot: string,
  saveImage: SaveImage,
) {
  const imageFiles = Array.from(files).filter((f) => IMAGE_MIME.test(f.type));
  if (!imageFiles.length) return false;

  for (const file of imageFiles) {
    const id = Symbol();

    // place placeholder
    const deco = Decoration.widget(insertPos, (() => {
      const el = document.createElement('span');
      el.className = 'pm-image-uploading';
      return el;
    })(), { id } as Record<string, unknown>);

    view.dispatch(
      view.state.tr.setMeta(imageUploadKey, { add: { id, pos: insertPos, deco } }),
    );

    try {
      const buffer = await file.arrayBuffer();
      const relativeSrc = await saveImage(vaultRoot, file.name, new Uint8Array(buffer));
      const pos = findPlaceholder(imageUploadKey.getState(view.state)!, id);
      if (pos < 0) continue;
      const tr = view.state.tr
        .setMeta(imageUploadKey, { remove: { id } })
        .insert(pos, schema.nodes.image.create({ src: relativeSrc }));
      view.dispatch(tr);
    } catch {
      view.dispatch(view.state.tr.setMeta(imageUploadKey, { remove: { id } }));
    }
  }
  return true;
}

export function imageUploadPlugin(vaultRoot: () => string, saveImage: SaveImage) {
  return new Plugin<DecorationSet>({
    key: imageUploadKey,
    state: {
      init() { return DecorationSet.empty; },
      apply(tr, set, _old, newState) {
        let next = set.map(tr.mapping, tr.doc);
        const meta = tr.getMeta(imageUploadKey) as
          | { add: { id: symbol; pos: number; deco: Decoration } }
          | { remove: { id: symbol } }
          | undefined;
        if (!meta) return next;
        if ('add' in meta) {
          next = next.add(newState.doc, [meta.add.deco]);
        } else if ('remove' in meta) {
          const target = next.find(undefined, undefined, (s) => (s as Record<string, unknown>).id === meta.remove.id);
          next = next.remove(target);
        }
        return next;
      },
    },
    props: {
      decorations(state) { return imageUploadKey.getState(state); },

      handlePaste(view, event) {
        const cd = event.clipboardData;
        if (!cd) return false;

        // paste image file
        if (cd.files.length) {
          return handleFiles(view, cd.files, view.state.selection.from, vaultRoot(), saveImage) as unknown as boolean;
        }

        // paste image URL from clipboard text
        const text = cd.getData('text/plain').trim();
        if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(text)) {
          insertImageNode(view, view.state.selection.from, text);
          event.preventDefault();
          return true;
        }

        return false;
      },

      handleDrop(view, event) {
        const de = event as DragEvent;
        if (!de.dataTransfer?.files.length) return false;
        const pos = view.posAtCoords({ left: de.clientX, top: de.clientY })?.pos;
        if (pos == null) return false;
        event.preventDefault();
        return handleFiles(view, de.dataTransfer.files, pos, vaultRoot(), saveImage) as unknown as boolean;
      },
    },
  });
}
