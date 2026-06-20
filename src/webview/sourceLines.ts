// Maps each top-level ProseMirror block to its 1-based source line in the .md
// text, for the left line-number gutter ([D0-7] [D5-1]).
//
// Feasibility ([D5-1]): the core's configured markdown-it emits one block-start
// token per top-level block, each carrying token.map = [startLine, endLine]
// (0-based), in the same order as the parsed doc's top-level nodes. So zipping
// by index yields each block's source line — no kernel schema change needed.
import { mdIt } from "../editor-core";

/**
 * Collect the 1-based source start line of every top-level block in `text`.
 *
 * Filter is `level === 0 && nesting >= 0 && map`: nesting 1 catches container
 * opens (heading/paragraph/list/quote/table), nesting 0 catches self-contained
 * blocks (fence/hr/html_block). Filtering only nesting === 1 would drop code
 * blocks and rules, shifting every later line number ([D5-1] pitfall).
 */
export function collectBlockLines(text: string): number[] {
  const tokens = mdIt.parse(text, {});
  const lines: number[] = [];
  for (const tok of tokens) {
    if (tok.level === 0 && tok.nesting >= 0 && tok.map) {
      lines.push(tok.map[0] + 1);
    }
  }
  return lines;
}
