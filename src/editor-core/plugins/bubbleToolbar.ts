import { Plugin, PluginKey, NodeSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { CellSelection } from 'prosemirror-tables';

export interface BubbleSelectionInfo {
  // viewport coords of selection start and end
  fromTop: number;
  fromLeft: number;
  toBottom: number;
  toRight: number;
  // bounding rect of the editor scroll card
  cardRect: DOMRect;
}

export interface BubbleToolbarPosition {
  visible: boolean;
  top: number;
  left: number;
  arrowX: number;
  arrowBelow: boolean;
}

export const BUBBLE_HIDDEN: BubbleToolbarPosition = {
  visible: false,
  top: 0,
  left: 0,
  arrowX: 0,
  arrowBelow: false,
};

const GAP = 8;
const EDGE_PAD = 8;

export function calcBubblePosition(
  info: BubbleSelectionInfo,
  toolbarW: number,
  toolbarH: number,
): BubbleToolbarPosition {
  const { fromTop, fromLeft, toBottom, toRight, cardRect } = info;

  const selCenterX = (fromLeft + toRight) / 2;

  const minLeft = cardRect.left + EDGE_PAD;
  const maxLeft = cardRect.right - toolbarW - EDGE_PAD;
  const left = Math.max(minLeft, Math.min(selCenterX - toolbarW / 2, maxLeft));

  let top = fromTop - toolbarH - GAP;
  let arrowBelow = false;

  if (top < cardRect.top + EDGE_PAD) {
    top = toBottom + GAP;
    arrowBelow = true;
  }

  const arrowX = Math.max(10, Math.min(selCenterX - left, toolbarW - 10));

  return { visible: true, top, left, arrowX, arrowBelow };
}

export type SelectionCallback = (info: BubbleSelectionInfo | null) => void;

export const bubbleToolbarKey = new PluginKey<null>('bubbleToolbar');

export function bubbleToolbarPlugin(onSelectionChange: SelectionCallback): Plugin {
  let showTimer: ReturnType<typeof setTimeout> | null = null;

  function tryShow(view: EditorView) {
    const { selection } = view.state;
    if (selection.empty || selection instanceof CellSelection || selection instanceof NodeSelection) {
      onSelectionChange(null);
      return;
    }

    const { $from, $to } = selection;
    const inCodeBlock =
      $from.parent.type === view.state.schema.nodes.code_block ||
      $to.parent.type === view.state.schema.nodes.code_block;
    if (inCodeBlock) {
      onSelectionChange(null);
      return;
    }

    const inFootnoteDef =
      $from.parent.type === view.state.schema.nodes.footnote_def ||
      $to.parent.type === view.state.schema.nodes.footnote_def;
    if (inFootnoteDef) {
      onSelectionChange(null);
      return;
    }

    const { from, to } = view.state.selection;
    const fromCoords = view.coordsAtPos(from);
    const toCoords = view.coordsAtPos(to);

    const cardEl =
      view.dom.closest('[data-editor-card]') ??
      view.dom.parentElement ??
      view.dom;
    const cardRect = cardEl.getBoundingClientRect();

    onSelectionChange({
      fromTop: fromCoords.top,
      fromLeft: fromCoords.left,
      toBottom: toCoords.bottom,
      toRight: toCoords.right,
      cardRect,
    });
  }

  return new Plugin({
    key: bubbleToolbarKey,

    view(editorView) {
      // mouseup must be on document so it fires even when the mouse is released
      // outside the editor DOM (e.g. reverse-selection ending in left margin)
      const handleMouseUp = () => {
        if (showTimer) clearTimeout(showTimer);
        showTimer = setTimeout(() => tryShow(editorView), 10);
      };
      document.addEventListener('mouseup', handleMouseUp);

      return {
        destroy() {
          document.removeEventListener('mouseup', handleMouseUp);
          if (showTimer) clearTimeout(showTimer);
          onSelectionChange(null);
        },
      };
    },

    props: {
      handleDOMEvents: {
        // Hide immediately on mousedown; selection is not yet final
        mousedown(_view, _event) {
          if (showTimer) clearTimeout(showTimer);
          onSelectionChange(null);
          return false;
        },
        blur(_view, event) {
          const related = (event as FocusEvent).relatedTarget as Element | null;
          if (related?.closest('[data-bubble-toolbar]')) return false;
          if (showTimer) clearTimeout(showTimer);
          onSelectionChange(null);
          return false;
        },
      },
    },
  });
}
