import type { Command } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';
import {
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  addRowAfter,
  addRowBefore,
  deleteRow,
  mergeCells,
  splitCell,
  deleteTable,
  isInTable,
  TableMap,
} from 'prosemirror-tables';
import { schema } from './schema';

export {
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  addRowAfter,
  addRowBefore,
  deleteRow,
  mergeCells,
  splitCell,
  deleteTable,
  isInTable,
};

export function insertTable(rows: number, cols: number): Command {
  return (state, dispatch) => {
    const { table, table_row, table_cell, table_header } = schema.nodes;

    const headerCells = Array.from({ length: cols }, () =>
      table_header.createAndFill()!
    );
    const headerRow = table_row.create(null, headerCells);

    const bodyRows = Array.from({ length: rows - 1 }, () => {
      const cells = Array.from({ length: cols }, () =>
        table_cell.createAndFill()!
      );
      return table_row.create(null, cells);
    });

    const node = table.create(null, [headerRow, ...bodyRows]);

    if (dispatch) {
      const tr = state.tr.replaceSelectionWith(node);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export const moveToNextRowInTable: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;

  const { $head } = state.selection;

  let tablePos = -1;
  let tableNode = null;
  for (let d = $head.depth; d > 0; d--) {
    if ($head.node(d).type === schema.nodes.table) {
      tableNode = $head.node(d);
      tablePos = $head.before(d);
      break;
    }
  }
  if (!tableNode) return false;

  let cellDepth = -1;
  for (let d = $head.depth; d > 0; d--) {
    const t = $head.node(d).type;
    if (t === schema.nodes.table_cell || t === schema.nodes.table_header) {
      cellDepth = d;
      break;
    }
  }
  if (cellDepth < 0) return false;

  const map = TableMap.get(tableNode);
  const cellPos = $head.before(cellDepth);
  const relativeCellPos = cellPos - tablePos - 1;

  const cellIndex = map.map.indexOf(relativeCellPos);
  if (cellIndex < 0) return false;

  const col = cellIndex % map.width;
  const row = Math.floor(cellIndex / map.width);

  // Already last row — let exitTableOnLastRow handle it
  if (row >= map.height - 1) return false;

  const nextCellRelPos = map.map[(row + 1) * map.width + col];
  const nextCellPos = tablePos + 1 + nextCellRelPos;

  if (dispatch) {
    const $next = state.doc.resolve(nextCellPos + 1);
    const sel = TextSelection.near($next);
    dispatch(state.tr.setSelection(sel).scrollIntoView());
  }
  return true;
};

export const exitTableOnLastRow: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;

  const { $head } = state.selection;

  // Walk up to find the table node and the table_row containing the cursor
  let tablePos = -1;
  let tableNode = null;
  for (let d = $head.depth; d > 0; d--) {
    if ($head.node(d).type === schema.nodes.table) {
      tableNode = $head.node(d);
      tablePos = $head.before(d);
      break;
    }
  }
  if (!tableNode) return false;

  const map = TableMap.get(tableNode);
  // Find the depth of the cell node (table_cell or table_header)
  let cellDepth = -1;
  for (let d = $head.depth; d > 0; d--) {
    const t = $head.node(d).type;
    if (t === schema.nodes.table_cell || t === schema.nodes.table_header) {
      cellDepth = d;
      break;
    }
  }
  if (cellDepth < 0) return false;

  const cellPos = $head.before(cellDepth);
  const lastRowStart = map.map[(map.height - 1) * map.width];
  const lastRowEnd = map.map[map.height * map.width - 1];
  const relativeCellPos = cellPos - tablePos - 1;
  const isInLastRow = relativeCellPos >= lastRowStart && relativeCellPos <= lastRowEnd;

  if (!isInLastRow) return false;

  if (dispatch) {
    const tableEnd = tablePos + tableNode.nodeSize;
    const paragraph = schema.nodes.paragraph.create();
    const tr = state.tr.insert(tableEnd, paragraph);
    const newPos = tableEnd + 1;
    tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

export function setCellAlignment(alignment: 'left' | 'center' | 'right' | null): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    const { from, to } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.type === schema.nodes.table_cell || node.type === schema.nodes.table_header) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, alignment });
        }
      });
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}
