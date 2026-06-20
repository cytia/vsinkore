import type { Node } from 'prosemirror-model';

export interface OutlineItem {
  text: string;
  level: number;
  pos: number;
}

export function extractOutline(doc: Node): OutlineItem[] {
  const items: OutlineItem[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      items.push({ text: node.textContent, level: node.attrs.level as number, pos });
    }
  });
  return items;
}
