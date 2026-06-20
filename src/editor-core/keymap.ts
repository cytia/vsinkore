import { keymap } from 'prosemirror-keymap';
import { baseKeymap, chainCommands } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { goToNextCell } from 'prosemirror-tables';
import type { Command } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';
import { toggleBold, toggleItalic, toggleCode } from './commands';
import { exitTableOnLastRow, moveToNextRowInTable } from './tableCommands';
import { schema } from './schema';

const exitCodeBlockOnEmptyLastLine: Command = (state, dispatch) => {
  const { $head, empty } = state.selection;
  if (!empty || $head.parent.type !== schema.nodes.code_block) return false;

  const block = $head.parent;
  const offsetInBlock = $head.parentOffset;

  // Current line is empty when there's no non-newline char between the last
  // newline before cursor and the cursor itself.
  const textBefore = block.textContent.slice(0, offsetInBlock);
  const lastNewline = textBefore.lastIndexOf('\n');
  const currentLineText = textBefore.slice(lastNewline + 1);
  if (currentLineText !== '') return false;

  // Must be the last line: nothing after cursor except at most a trailing newline.
  const textAfter = block.textContent.slice(offsetInBlock);
  if (textAfter !== '' && textAfter !== '\n') return false;

  if (dispatch) {
    // Delete the empty line (and trailing newline if present), then insert paragraph after block.
    const blockStart = $head.before();         // pos of the code_block node itself
    const blockEnd = blockStart + block.nodeSize;
    const deleteFrom = $head.pos - (lastNewline >= 0 ? 1 : 0); // include the preceding \n
    const deleteTo = blockEnd - 1;             // up to but not including closing token

    const paragraph = schema.nodes.paragraph.create();
    const tr = state.tr
      .delete(deleteFrom, deleteTo)
      .insert(blockStart + block.nodeSize - (deleteTo - deleteFrom), paragraph);
    const insertedParaPos = blockEnd - (deleteTo - deleteFrom);
    tr.setSelection(TextSelection.near(tr.doc.resolve(insertedParaPos)));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

const insertHardBreak: Command = (state, dispatch) => {
  const { hard_break } = schema.nodes;
  if (!hard_break) return false;
  if (dispatch) {
    dispatch(state.tr.replaceSelectionWith(hard_break.create()).scrollIntoView());
  }
  return true;
};

// In footnote_def (text* content), Enter should move focus outside rather than
// create a new block, since footnote_def does not allow block children.
const exitFootnoteDefOnEnter: Command = (state, dispatch) => {
  const { $head } = state.selection;
  if ($head.parent.type !== schema.nodes.footnote_def) return false;
  if (dispatch) {
    // Move cursor to just after the footnote_def node
    const after = $head.after($head.depth);
    const tr = state.tr.setSelection(TextSelection.near(state.doc.resolve(after)));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

const splitListItemStd = splitListItem(schema.nodes.list_item);
const splitTaskItem = splitListItem(schema.nodes.task_item);
const liftListItemStd = liftListItem(schema.nodes.list_item);
const liftTaskItem = liftListItem(schema.nodes.task_item);
const sinkListItemStd = sinkListItem(schema.nodes.list_item);
const sinkTaskItem = sinkListItem(schema.nodes.task_item);

export const editorKeymap = keymap({
  ...baseKeymap,
  'Enter': chainCommands(exitFootnoteDefOnEnter, exitCodeBlockOnEmptyLastLine, exitTableOnLastRow, moveToNextRowInTable, splitTaskItem, splitListItemStd, baseKeymap['Enter']),
  'Shift-Enter': insertHardBreak,
  'Tab': chainCommands(goToNextCell(1), sinkTaskItem, sinkListItemStd),
  'Shift-Tab': chainCommands(goToNextCell(-1), liftTaskItem, liftListItemStd),
  'Mod-b': toggleBold,
  'Mod-i': toggleItalic,
  'Mod-`': toggleCode,
  'Mod-z': undo,
  'Mod-y': redo,
  'Mod-Shift-z': redo,
});
