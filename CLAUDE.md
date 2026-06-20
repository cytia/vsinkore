# vsinkore — Claude 工作指引

vsinkore 是 Inkore 的 VSCode 插件：把编辑器内核（源码内联在 `src/editor-core/`）作为 host，注册为 `.md` 的 Custom Text Editor，在 webview 里提供所见即所得的 Markdown 编辑体验。

技术栈：TypeScript + VSCode Extension API + 内联编辑器内核（原生 ProseMirror）+ esbuild。

**纯免费、只做编辑**——不碰激活 / PRO / 导出。这些属于桌面版，不进插件。

## 与相邻仓库的关系

```
D:\My-Projects\
├── Inkore-core\   ← 编辑器内核源头（独立私有仓，零 React / 零 Tauri）；本仓不引用它
├── My-MarkaV2\    ← 桌面版 v2（Tauri 客户端）
└── vsinkore\      ← 本仓：VSCode 插件（内核源码已内联在 src/editor-core/）
```

- 内核源码**拷贝内联**在本仓 `src/editor-core/`，本仓独立持有、独立构建，不再 `file:` 引用外部 `Inkore-core` 仓。改内核即改本仓自己的文件；外部 `Inkore-core` 仅作源头记录，存量不动。
- 内核**只提供能力，不带 host 封装、不带 CSS**。host wiring（构建 EditorView、接 NodeViews）、样式、平台桥接（图片持久化、URL 解析）都由本仓 `src/extension` / `src/webview` 实现。
- 内核 `scope`：只含免费编辑能力。任何付费 / 导出逻辑都不属于内核，也不属于本插件。

## 当前进度

阶段二（内核跑起来，PoC 只读不回写）完成并 F5 验证：webview 接内核 `createEditorState` + 全套 NodeView，extension 推 `document.getText()` → `parseMarkdown` 所见即所得渲染，配色对齐 VSCode；katex/prosemirror CSS 打包不走 CDN；代码块 Shiki 高亮（JS 引擎 + decoration + nonce 色表 + ESM 按需加载语言，跟随明暗主题）`[D0-8]`。内核源码已内联 `src/editor-core/`（断开外部 `file:` 依赖）`[D-inline]`。

阶段三（双向桥：编辑回写 + 外部同步）完成并 F5 验证：webview 改动 → `serializeMarkdown`（延迟进防抖）→ `edit` 消息 → extension `WorkspaceEdit` 整文替换；外部改动 → `update` 消息 → `applyExternal` 原地重渲染；防回环走 `lastWrittenText` 文本比对 + webview 侧 `applyingExternal` 标志双层守卫 `[D3-1]`。

阶段四（图片只读显示 + 主题对齐）完成并 F5 验证：extension 算文档所在 vault 根的 `asWebviewUri` base 随消息下发，webview 侧 `new URL` 拼相对图片路径；图片根取 workspace folder（vault 根，非文档目录），`localResourceRoots` 同步授权；`saveImage` no-op 不插图；图片样式接 `--vscode-*` 明暗跟随 `[D4-1]`。

阶段五（行号槽 + 交互打磨）推进中：**行号槽**完成并 F5 验证——内核导出配置好的 `mdIt`，host 侧平行解析取每块 `token.map` 源码起始行、与顶层节点 1:1 zip，绝对定位兄弟层按 `coordsAtPos` 对齐块顶渲染（无竖线、右对齐、逐块标首行、rAF 节流）；源码物理行号口径与 .md 真实行号一致 `[D5-1]`。余下子任务：空态/加载态、查找高亮、右键菜单、Bubble Toolbar（UI 对齐 VSCode 原生）。

已知待办：标准 Markdown 脚注定义 `[^1]: 文本` 内核不解析（成因二，内核侧独立任务，见阶段工作表）。

详见 [学习/阶段工作表.md](学习/阶段工作表.md)（进度 + 首版功能范围表）与 [学习/阶段决策备忘.md](学习/阶段决策备忘.md)（`[D0-1]`~`[D5-1]`）。

## 文件规范

- 每个文件不超过 200 行，超过时拆分。

---

写代码或修改代码前，必须主动对照以下文档确认方向，再动手：

- [全局工作规范](C:\Users\oseph\.claude\CLAUDE.md)（基线：英文注释、范围控制、禁令、超出单函数先讲方案）
- [学习/工作规范.md](学习/工作规范.md)（技术栈 / 目录结构 / 动手前检查清单 / 代码规范 / VSCode 插件专项）
- [学习/阶段工作表.md](学习/阶段工作表.md)（进度 + 待办）
- [学习/阶段决策备忘.md](学习/阶段决策备忘.md)（决策 / 契约 / 踩坑，工作表 `[Dx-y]` 锚点指向此处）
