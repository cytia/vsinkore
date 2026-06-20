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

阶段一（仓库骨架）完成：`package.json` 注册 `.md` 的 `CustomTextEditorProvider`（viewType `inkore.editor`，priority option 不抢占）、esbuild 双 bundle（extension Node/CJS + webview browser/IIFE）、CSP + nonce + asWebviewUri 链路、launch.json/tasks.json。F5 实跑验证通过（Reopen With Inkore Editor 显示空 webview）。下一步进阶段二（内核跑起来，PoC 只读不回写）。

详见 [学习/阶段工作表.md](学习/阶段工作表.md)（进度 + 首版功能范围表）与 [学习/阶段决策备忘.md](学习/阶段决策备忘.md)（`[D0-1]`~`[D0-8]`）。

## 文件规范

- 每个文件不超过 200 行，超过时拆分。

---

写代码或修改代码前，必须主动对照以下文档确认方向，再动手：

- [全局工作规范](C:\Users\oseph\.claude\CLAUDE.md)（基线：英文注释、范围控制、禁令、超出单函数先讲方案）
- [学习/工作规范.md](学习/工作规范.md)（技术栈 / 目录结构 / 动手前检查清单 / 代码规范 / VSCode 插件专项）
- [学习/阶段工作表.md](学习/阶段工作表.md)（进度 + 待办）
- [学习/阶段决策备忘.md](学习/阶段决策备忘.md)（决策 / 契约 / 踩坑，工作表 `[Dx-y]` 锚点指向此处）
