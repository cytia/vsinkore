// Shared row renderer for the host's right-click menus (format menu and the
// in-table edit menu). Both build the same caption / divider / item structure;
// items may carry an icon and a submenu arrow.

export type MenuRow =
  | { kind: "caption"; label: string }
  | { kind: "divider" }
  | { kind: "item"; label: string; run: () => void; icon?: string; arrow?: boolean };

/** Append the rows into `menu`, wiring item clicks via mousedown (which keeps
 *  the doc selection — a click would blur it first). */
export function renderMenuRows(menu: HTMLElement, rows: MenuRow[]): void {
  for (const row of rows) {
    if (row.kind === "caption") {
      const el = document.createElement("div");
      el.className = "ctx-caption";
      el.textContent = row.label;
      menu.appendChild(el);
    } else if (row.kind === "divider") {
      const el = document.createElement("div");
      el.className = "ctx-divider";
      menu.appendChild(el);
    } else {
      const el = document.createElement("div");
      el.className = row.arrow ? "ctx-item has-sub" : "ctx-item";
      if (row.icon !== undefined) {
        const icon = document.createElement("span");
        icon.className = "ctx-icon";
        icon.textContent = row.icon;
        el.appendChild(icon);
      }
      const label = document.createElement("span");
      label.textContent = row.label;
      el.appendChild(label);
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        row.run();
      });
      menu.appendChild(el);
    }
  }
}
