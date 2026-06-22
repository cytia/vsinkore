import type { EditorState } from "prosemirror-state";
import { isMarkActive, isBlockActive } from "../editor-core";

// A bubble button whose pressed state is driven by an active-state predicate
// (mark buttons check isMarkActive, block buttons check isBlockActive).
export interface ToggleButton {
  el: HTMLButtonElement;
  isActive: (state: EditorState) => boolean;
}

export const markActive = (mark: string) => (s: EditorState) => isMarkActive(s, mark);
export const blockActive = (name: string) => (s: EditorState) => isBlockActive(s, name);
