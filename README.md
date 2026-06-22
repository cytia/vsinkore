# vsinkore

WYSIWYG Markdown editing for VSCode, powered by the Inkore editor core.

Opens `.md` files in a what-you-see-is-what-you-get editor instead of raw text,
while keeping VSCode's file lifecycle (save, dirty state, undo, external change
sync). The look follows your active VSCode theme.

## Features

- **WYSIWYG rendering** — headings, lists, task lists, blockquotes, tables,
  inline/block math (KaTeX), footnotes, table of contents.
- **Code blocks** with Shiki syntax highlighting matching your VSCode theme,
  light/dark aware.
- **Source line gutter** — left-side line numbers matching the `.md` file's real
  physical lines, for quick orientation.
- **Bubble toolbar** on selection — bold/italic/underline/strikethrough/inline
  code, heading levels, lists, text color, links. A compact variant inside tables.
- **Right-click menu** — format and insert actions; a dedicated row/column/cell
  menu when the cursor is inside a table.
- **In-editor find** — `Ctrl/Cmd+F` highlights matches with case/regex options
  and next/previous navigation.
- **Images** render read-only from the vault root; links open with `Ctrl/Cmd+click`.

## Usage

Open any `.md` file — it opens in the Inkore editor by default. To use the plain
text editor instead, right-click the tab → **Reopen Editor With…** → Text Editor.

## Scope

Free editing only. No activation, PRO, or export features — those belong to the
Inkore desktop app. The editor never makes network requests; notes stay local.
