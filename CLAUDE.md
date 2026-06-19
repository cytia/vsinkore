# vsinkore — Claude 工作指引

vsinkore 是 Inkore 的 VSCode 插件：把 `@inkore/editor-core` 作为 host，注册为 `.md` 的 Custom Text Editor，在 webview 里提供所见即所得的 Markdown 编辑体验。

技术栈：TypeScript + VSCode Extension API + `@inkore/editor-core`（原生 ProseMirror）+ esbuild。

**纯免费、只做编辑**——不碰激活 / PRO / 导出。这些属于桌面版，不进插件。

## 与相邻仓库的关系

```
D:\My-Projects\
├── Inkore-core\   ← 编辑器内核（独立私有仓，零 React / 零 Tauri）
├── My-MarkaV2\    ← 桌面版 v2（Tauri 客户端）
└── vsinkore\      ← 本仓：VSCode 插件
```

- 内核通过 `file:../Inkore-core` 本地依赖引入，先不发 npm。
- 内核**只提供能力，不带 host 封装、不带 CSS**。host wiring（构建 EditorView、接 NodeViews）、样式、平台桥接（图片持久化、URL 解析）都由本仓实现。
- 内核 `scope`：只含免费编辑能力。任何付费 / 导出逻辑都不属于内核，也不属于本插件。

## 当前进度

阶段零（方案敲定）完成：形态 / 付费边界 / 仓库落点 / 内核引入方式 / 构建 / 定位（开发者文档场景 + 视觉对齐 VSCode）/ 首版功能范围（含代码块 Shiki 高亮、图片只读、左侧源码行号槽）均已敲定。下一步进阶段一（仓库骨架，F5 起空 webview）。

详见 [学习/阶段工作表.md](学习/阶段工作表.md)（进度 + 首版功能范围表）与 [学习/阶段决策备忘.md](学习/阶段决策备忘.md)（`[D0-1]`~`[D0-8]`）。

## 文件规范

- 每个文件不超过 200 行，超过时拆分。

---

写代码或修改代码前，必须主动对照以下文档确认方向，再动手：

- [全局工作规范](C:\Users\oseph\.claude\CLAUDE.md)（基线：英文注释、范围控制、禁令、超出单函数先讲方案）
- [学习/工作规范.md](学习/工作规范.md)（技术栈 / 目录结构 / 动手前检查清单 / 代码规范 / VSCode 插件专项）
- [学习/阶段工作表.md](学习/阶段工作表.md)（进度 + 待办）
- [学习/阶段决策备忘.md](学习/阶段决策备忘.md)（决策 / 契约 / 踩坑，工作表 `[Dx-y]` 锚点指向此处）
