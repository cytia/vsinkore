// Dual-bundle build: extension host (Node/CJS) + webview (browser/IIFE).
// The two runtimes are isolated and never share objects (see 工作规范 §五).
import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

/** Extension host: runs in Node, must keep `vscode` external. */
const extensionConfig = {
  entryPoints: ["src/extension/extension.ts"],
  outfile: "dist/extension.js",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
};

/**
 * Webview: runs in the browser sandbox. ESM + code splitting so Shiki language
 * grammars load on demand ([D0-8]) instead of bloating the main bundle. Dynamic
 * import() chunks resolve relative to webview.js's own URL (import.meta.url),
 * which is the asWebviewUri the extension loads it from — so chunks just need to
 * sit beside webview.js in dist/.
 */
const webviewConfig = {
  entryPoints: ["src/webview/index.ts"],
  outdir: "dist",
  entryNames: "webview",
  chunkNames: "chunks/[name]-[hash]",
  bundle: true,
  splitting: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  // Imported CSS (katex/prosemirror/tables) is emitted as dist/webview.css.
  // katex's CSS references font files; copy them into dist as assets so they
  // load via asWebviewUri under the webview CSP (font-src cspSource).
  loader: {
    ".woff": "file",
    ".woff2": "file",
    ".ttf": "file",
  },
  assetNames: "[name]-[hash]",
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
};

if (watch) {
  const ctxExt = await context(extensionConfig);
  const ctxWeb = await context(webviewConfig);
  await Promise.all([ctxExt.watch(), ctxWeb.watch()]);
  console.log("watching extension + webview bundles...");
} else {
  await Promise.all([build(extensionConfig), build(webviewConfig)]);
}
