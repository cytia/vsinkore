/**
 * Host injection surface.
 *
 * The editor core never touches the file system or any platform API directly.
 * A host (Inkore desktop app, a VSCode extension, a community project, the demo
 * in `example/`) supplies the small set of capabilities the editor actually
 * needs. Only image persistence and image-URL resolution are required today.
 */

/** Persist a pasted/dropped image into the host's storage, returning the
 *  in-document src to reference it by (e.g. an in-vault relative path). */
export type SaveImage = (
  vaultRoot: string,
  filename: string,
  data: Uint8Array,
) => Promise<string>;

/** Resolve an in-document relative src to a URL the browser can render
 *  (e.g. a blob: URL, or a platform asset protocol). */
export type ToRenderUrl = (vaultRoot: string, relPath: string) => string;

// ─── Search types ─────────────────────────────────────────────────────────────
// Defined here (rather than imported from a host store) so the core owns its
// own search vocabulary and stays dependency-free.

export interface SearchOpts {
  fuzzy: boolean;
  caseSensitive: boolean;
  regex: boolean;
  /** Whether the search spans the whole vault; the editor highlight ignores it
   *  but carries it through so a host can share one options object. */
  vaultScope: boolean;
}

export interface SearchMatch {
  from: number;
  to: number;
  lineText: string;
  ranges: { start: number; end: number }[];
}
