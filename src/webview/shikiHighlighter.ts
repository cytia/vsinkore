// Shiki syntax highlighting for code blocks ([D0-8]).
//
// Uses the JS regex engine (no WASM) so the webview CSP needs no
// wasm-unsafe-eval. Themes/languages load on demand to keep the bundle small.
//
// CSP-safe coloring: Shiki tokens only carry a color hex, not a scope class.
// We map each distinct hex to a `.shk-<hex>` class and write the rules into the
// pre-authorized (nonce) #shiki-styles element, so token spans need no inline
// style. Bold/italic/underline are emitted as fixed classes.
import {
  createHighlighterCore,
  type HighlighterCore,
  type ThemeInput,
  type LanguageInput,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Theme picked by the active VSCode light/dark mode; both are VSCode's own.
const DARK_THEME = "dark-plus";
const LIGHT_THEME = "light-plus";

// Dynamic imports keep each language/theme out of the initial chunk.
const themeLoaders: Record<string, () => ThemeInput> = {
  [DARK_THEME]: () => import("shiki/themes/dark-plus.mjs"),
  [LIGHT_THEME]: () => import("shiki/themes/light-plus.mjs"),
};

// Language id (and common aliases) → grammar loader. Unknown languages fall
// back to plain text in the NodeView.
const langLoaders: Record<string, () => LanguageInput> = {
  typescript: () => import("shiki/langs/typescript.mjs"),
  ts: () => import("shiki/langs/typescript.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  js: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  py: () => import("shiki/langs/python.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  yml: () => import("shiki/langs/yaml.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  md: () => import("shiki/langs/markdown.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  bash: () => import("shiki/langs/bash.mjs"),
  sh: () => import("shiki/langs/bash.mjs"),
  shell: () => import("shiki/langs/bash.mjs"),
  dockerfile: () => import("shiki/langs/docker.mjs"),
  graphql: () => import("shiki/langs/graphql.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
};

/** One highlighted token: the text plus the classes to color/style it. */
export interface ShikiToken {
  content: string;
  className: string;
}

const FONT_ITALIC = 1;
const FONT_BOLD = 2;
const FONT_UNDERLINE = 4;

let highlighter: HighlighterCore | null = null;
let initPromise: Promise<HighlighterCore> | null = null;
let activeTheme = DARK_THEME;

// Distinct token colors already written to #shiki-styles, to avoid duplicates.
const writtenColors = new Set<string>();
const loadedLangs = new Set<string>();
const loadingLangs = new Map<string, Promise<boolean>>();

function isDark(): boolean {
  // VSCode tags the webview body with the active theme kind.
  return !document.body.classList.contains("vscode-light");
}

function styleSink(): HTMLStyleElement | null {
  return document.getElementById("shiki-styles") as HTMLStyleElement | null;
}

/** Stable, CSS-safe class for a color hex (e.g. #569CD6 → shk-569cd6). */
function colorClass(hex: string): string {
  return "shk-" + hex.replace("#", "").toLowerCase();
}

/** Append a color rule to the nonce-authorized style element once per color. */
function ensureColorRule(hex: string): void {
  const cls = colorClass(hex);
  if (writtenColors.has(cls)) return;
  writtenColors.add(cls);
  const sink = styleSink();
  if (sink) sink.textContent += `.${cls}{color:${hex}}`;
}

/** Theme switch invalidates color rules (a different palette applies). */
function resetColorRules(): void {
  writtenColors.clear();
  const sink = styleSink();
  if (sink) sink.textContent = "";
}

async function getHighlighter(): Promise<HighlighterCore> {
  if (highlighter) return highlighter;
  if (initPromise) return initPromise;
  activeTheme = isDark() ? DARK_THEME : LIGHT_THEME;
  initPromise = createHighlighterCore({
    themes: [themeLoaders[activeTheme]()],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  }).then((hl) => {
    highlighter = hl;
    return hl;
  });
  return initPromise;
}

/**
 * Ensure a language grammar is loaded. Returns false for unsupported languages
 * (the NodeView then renders plain text). Concurrent calls share one load.
 */
export async function ensureLanguage(lang: string): Promise<boolean> {
  const key = lang.toLowerCase().trim();
  if (!key || !langLoaders[key]) return false;
  if (loadedLangs.has(key)) return true;
  const inflight = loadingLangs.get(key);
  if (inflight) return inflight;

  const load = (async () => {
    const hl = await getHighlighter();
    await hl.loadLanguage(langLoaders[key]());
    loadedLangs.add(key);
    loadingLangs.delete(key);
    return true;
  })();
  loadingLangs.set(key, load);
  return load;
}

/**
 * Tokenize code into styled lines. Caller must have awaited ensureLanguage for
 * the same lang; otherwise this returns null (signalling plain-text fallback).
 */
export function tokenize(code: string, lang: string): ShikiToken[][] | null {
  const key = lang.toLowerCase().trim();
  if (!highlighter || !loadedLangs.has(key)) return null;
  const { tokens } = highlighter.codeToTokens(code, {
    lang: key,
    theme: activeTheme,
  });
  return tokens.map((line) =>
    line.map((t) => {
      const classes: string[] = [];
      if (t.color) {
        ensureColorRule(t.color);
        classes.push(colorClass(t.color));
      }
      const fs = t.fontStyle ?? 0;
      if (fs & FONT_ITALIC) classes.push("shk-i");
      if (fs & FONT_BOLD) classes.push("shk-b");
      if (fs & FONT_UNDERLINE) classes.push("shk-u");
      return { content: t.content, className: classes.join(" ") };
    }),
  );
}

/** Current theme name, so NodeViews can detect a theme change and re-render. */
export function currentTheme(): string {
  return activeTheme;
}

/**
 * Re-create the highlighter for the active light/dark theme if it changed.
 * Returns true when a switch happened (callers should re-highlight). Loaded
 * languages are re-loaded into the fresh instance.
 */
export async function refreshThemeIfChanged(): Promise<boolean> {
  const wanted = isDark() ? DARK_THEME : LIGHT_THEME;
  if (highlighter && wanted === activeTheme) return false;
  const langs = [...loadedLangs];
  highlighter = null;
  initPromise = null;
  loadedLangs.clear();
  loadingLangs.clear();
  resetColorRules();
  activeTheme = wanted;
  const hl = await getHighlighter();
  await Promise.all(langs.map((l) => hl.loadLanguage(langLoaders[l]())));
  langs.forEach((l) => loadedLangs.add(l));
  return true;
}
