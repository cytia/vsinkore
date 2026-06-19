import * as vscode from "vscode";
import { InkoreEditorProvider } from "./InkoreEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(InkoreEditorProvider.register(context));
}

export function deactivate(): void {
  // Nothing to clean up: disposables are owned by context.subscriptions.
}
