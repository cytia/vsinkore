// Left line-number gutter: shows each top-level block's source start line,
// aligned to the block's visual top ([D0-7] [D5-1]).
//
// The gutter is NOT a ProseMirror decoration — PM forbids widgets in editable
// content (same constraint as the Shiki highlighter, [D0-8]). It's an absolutely
// positioned sibling layer inside the scroll container, painted from
// view.coordsAtPos of each top-level node.
//
// Two paths, kept separate so scrolling stays cheap:
//  - refresh()    (doc changed): re-map blocks→source lines (serialize + parse)
//                 and rebuild the number nodes.
//  - reposition() (scroll/resize): only update each existing node's `top`; no
//                 serialize, no parse, no DOM rebuild. Both are rAF-throttled.
import type { EditorView } from "prosemirror-view";
import { collectBlockLines } from "./sourceLines";

export interface LineGutter {
  /** Re-map source lines and rebuild numbers (after a doc change). */
  refresh(): void;
  destroy(): void;
}

/**
 * Mount a line-number gutter for `view`. `scroller` is the scrolling container
 * (#root) the gutter overlays; `serialize` yields the current Markdown so the
 * gutter can map top-level blocks to their source start lines.
 */
export function mountLineGutter(
  view: EditorView,
  scroller: HTMLElement,
  serialize: () => string,
): LineGutter {
  const gutter = document.createElement("div");
  gutter.className = "pm-line-gutter";
  scroller.appendChild(gutter);

  // One element per top-level block, reused across repaints so scrolling only
  // touches `style.top` instead of rebuilding the DOM.
  let nums: HTMLElement[] = [];
  let frame = 0;
  let rebuildPending = false;

  function gutterOffset(): number {
    return scroller.scrollTop - scroller.getBoundingClientRect().top;
  }

  // Empty paragraphs are real PM nodes (an editable blank line in WYSIWYG) but
  // markdown-it emits no block for a blank line, so they must not consume a
  // source-line index — otherwise the zip drifts and trailing blocks lose their
  // number ([D5-1] assumed node count == block count, which empties break).
  function isNumberedBlock(node: import("prosemirror-model").Node): boolean {
    return !(node.type.name === "paragraph" && node.content.size === 0);
  }

  // Rebuild number nodes from the current source-line mapping. Only on doc change.
  function rebuild(): void {
    const lines = collectBlockLines(serialize());
    const offset = gutterOffset();
    gutter.textContent = "";
    nums = [];
    let index = 0;
    view.state.doc.forEach((node, pos) => {
      if (!isNumberedBlock(node)) return;
      const lineNo = lines[index++];
      if (lineNo === undefined) return;
      const el = document.createElement("div");
      el.className = "pm-line-gutter-num";
      el.textContent = String(lineNo);
      // +1: coordsAtPos needs a position inside the node, not at its boundary.
      el.style.top = `${view.coordsAtPos(pos + 1).top + offset}px`;
      gutter.appendChild(el);
      nums.push(el);
    });
  }

  // Cheap path: move existing numbers to their blocks' current tops. On scroll.
  // Must skip the same empty paragraphs as rebuild so numbers stay aligned.
  function reposition(): void {
    const offset = gutterOffset();
    let index = 0;
    view.state.doc.forEach((node, pos) => {
      if (!isNumberedBlock(node)) return;
      const el = nums[index++];
      if (!el) return;
      el.style.top = `${view.coordsAtPos(pos + 1).top + offset}px`;
    });
  }

  function paint(): void {
    frame = 0;
    if (rebuildPending) {
      rebuildPending = false;
      rebuild();
    } else {
      reposition();
    }
  }

  function schedule(rebuildNeeded: boolean): void {
    if (rebuildNeeded) rebuildPending = true;
    if (frame === 0) frame = requestAnimationFrame(paint);
  }

  const onScrollOrResize = () => schedule(false);
  scroller.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize);

  schedule(true);

  return {
    refresh: () => schedule(true),
    destroy() {
      if (frame !== 0) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      gutter.remove();
    },
  };
}
