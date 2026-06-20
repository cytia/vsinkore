import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
  InputRule,
} from 'prosemirror-inputrules';
import type { MarkType, NodeType, Schema } from 'prosemirror-model';
import { schema } from '../schema';

// Replace `match[0]` with text wrapped by `markType`, dropping the surrounding delimiters.
function markInputRule(regexp: RegExp, markType: MarkType): InputRule {
  return new InputRule(regexp, (state, match, start, end) => {
    const inner = match[1];
    if (!inner) return null;
    const tr = state.tr;
    tr.replaceWith(start, end, schema.text(inner, [markType.create()]));
    tr.removeStoredMark(markType);
    return tr;
  });
}

function headingRule(nodeType: NodeType, maxLevel: number): InputRule {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${maxLevel}})\\s$`),
    nodeType,
    (match) => ({ level: match[1].length }),
  );
}

function bulletListRule(nodeType: NodeType): InputRule {
  return wrappingInputRule(/^\s*([-*])\s$/, nodeType);
}

function orderedListRule(nodeType: NodeType): InputRule {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    nodeType,
    (match) => ({ order: +match[1] }),
    (match, node) => node.childCount + node.attrs.order === +match[1],
  );
}

function blockquoteRule(nodeType: NodeType): InputRule {
  return wrappingInputRule(/^\s*>\s$/, nodeType);
}

function codeBlockRule(nodeType: NodeType): InputRule {
  return textblockTypeInputRule(/^```$/, nodeType);
}

function horizontalRuleRule(nodeType: NodeType): InputRule {
  return new InputRule(/^(?:---|\*\*\*|___)$/, (state, _match, start, end) => {
    const tr = state.tr.replaceRangeWith(start, end, nodeType.create());
    return tr;
  });
}

export function buildInputRules(s: Schema) {
  const rules: InputRule[] = [];

  // Block-level rules
  if (s.nodes.heading) rules.push(headingRule(s.nodes.heading, 6));
  if (s.nodes.bullet_list) rules.push(bulletListRule(s.nodes.bullet_list));
  if (s.nodes.ordered_list) rules.push(orderedListRule(s.nodes.ordered_list));
  if (s.nodes.blockquote) rules.push(blockquoteRule(s.nodes.blockquote));
  if (s.nodes.code_block) rules.push(codeBlockRule(s.nodes.code_block));
  if (s.nodes.horizontal_rule) rules.push(horizontalRuleRule(s.nodes.horizontal_rule));

  // Inline mark rules — non-greedy capture, require non-space at boundaries.
  if (s.marks.strong) {
    rules.push(markInputRule(/\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, s.marks.strong));
  }
  if (s.marks.em) {
    rules.push(markInputRule(/(?<![*_\w])\*([^*\s](?:[^*]*[^*\s])?)\*$/, s.marks.em));
    rules.push(markInputRule(/(?<![*_\w])_([^_\s](?:[^_]*[^_\s])?)_$/, s.marks.em));
  }
  if (s.marks.code) {
    rules.push(markInputRule(/`([^`\s](?:[^`]*[^`\s])?)`$/, s.marks.code));
  }
  if (s.marks.strikethrough) {
    rules.push(markInputRule(/~~([^~\s](?:[^~]*[^~\s])?)~~$/, s.marks.strikethrough));
  }

  return inputRules({ rules });
}
