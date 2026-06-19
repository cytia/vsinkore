# 备份源代码

将 vsinkore 当前变更提交并推送到 GitHub `main` 分支（远程仓 `cytia/vsinkore`，私有）。

## 触发口令

`备份源代码`

---

## 执行步骤

### 步骤 1：更新阶段工作表

根据本轮工作内容，更新 `学习/阶段工作表.md`：

- 已完成项：`[ ]` → `[X]`
- 新增子任务：按既有缩进格式追加
- 范围变更 / 设计变更：在对应条目下加 _设计变更_ 说明，重大决策同步进 `学习/阶段决策备忘.md`（挂 `[Dx-y]` 锚点）
- 当前阶段推进：同步更新 [CLAUDE.md](../../CLAUDE.md) "当前进度"

更新后将阶段工作表（及 CLAUDE.md / 决策备忘，如改动）一并加入后续 add 列表。

### 步骤 2：制作 commit 描述

根据当前工作进度制作简明 commit 描述。遵循项目 commit 格式（`feat:` / `fix:` / `docs:` / `chore:` 等），不出现 AI 工具名或进度标签（`FIXED` / `Phase` / `Step` 等）。

### 步骤 3：询问是否打 tag

向用户提问：

> 是否需要打 tag？如回答"要"，就根据之前版本号迭代更新版本号
> 如之前是 v0.2.1，就迭代为 v0.2.2
> 如用户明确指定版本号，则按照用户指定执行

### 步骤 4：查看变更文件

运行以下命令，列出所有变更文件供参考：

```bash
cd "d:\My-Projects\vsinkore" && git status --short
```

### 步骤 5：手动指定文件并 add

根据 `git status` 的输出，逐一 add 实际变更的文件（不用 `git add .`）：

```bash
cd "d:\My-Projects\vsinkore" && git add <文件1> <文件2> ...
```

**禁忌**：不要 `git add dist/` / `git add node_modules/`（构建产物与依赖，由 `.gitignore` 排除）。`@inkore/editor-core` 是 `file:../Inkore-core` 本地依赖、独立私有仓，其改动只在它自己的仓库 commit/push，永远不进本仓。

### 步骤 6：如版本号有变动，同步更新

vsinkore 版本号集中在 `package.json` 一处（`"version": "x.x.x"`）。如本轮改了版本号，先用 Edit 工具更新后一并加入 add。

> 注：阶段一尚未建出 `package.json` 时本步跳过。

### 步骤 7：commit

```bash
cd "d:\My-Projects\vsinkore" && git commit -m "$(cat <<'EOF'
<用户提供的描述>
EOF
)"
```

### 步骤 8：push

```bash
cd "d:\My-Projects\vsinkore" && git push origin main
```

### 步骤 9：打 tag（如需要）

```bash
cd "d:\My-Projects\vsinkore" && git tag <版本号> && git push origin <版本号>
```

### 步骤 10：确认完成

输出最终 commit hash 和推送结果，告知用户备份完成。
