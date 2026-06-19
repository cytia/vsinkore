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

/** Webview: runs in the browser sandbox. IIFE keeps CSP/nonce injection simple. */
const webviewConfig = {
  entryPoints: ["src/webview/index.ts"],
  outfile: "dist/webview.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
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
