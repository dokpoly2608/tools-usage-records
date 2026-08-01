# TODO / 待办

> 原则：**快速实现优先**。核心功能已就绪，以下是按需求里「没能弄/实现的」记录的后续项。

## P1 —— 计划内后续阶段

- [ ] **CLI 工具**（核心高频功能）
  - 需求明确：先在网站用一段时间、总结出真正高频的操作后，再做针对性 CLI。
  - 初步设想：复用同一套 SQLite / API，命令如
    - `ckb search <query>` 搜索并直接打印命令
    - `ckb use <id>` 记录使用（+1 计数）
    - `ckb add` 快速添加一条
    - `ckb top` 看高频
  - 直接读 `backend/data/kb.sqlite` 或走 HTTP API 均可，待定。

- [ ] **自动录入 / 监控**（zsh 命令 + claude/codex 提示词自动记录 + 定期 AI 入库）
  - 完整设计见 [docs/auto-record-design.md](./docs/auto-record-design.md)。
  - 思路：zsh `zshaddhistory` + claude/codex `UserPromptSubmit` hook → 追加 `backend/data/raw_*.jsonl`；`scripts/auto_ingest.mjs` 增量读取 → AI 聚类提炼 → 复用 `import.mjs` 幂等入库。
  - 参考 `agentmemory` 插件 hook 模式。当前**仅设计**，未启用。

## P2 —— 增强项（当前用简单方案实现，后续可替换）

- [ ] **全文检索 FTS5**
  - 当前是 LIKE + 匹配位置加权，对中文/小数据量够用；
  - 数据量上来后可加 SQLite FTS5 虚拟表，支持分词、`MATCH`、高亮、`bm25()` 排序。
- [ ] **shadcn/ui 完整集成**
  - 当前是手写的 shadcn 风格组件（`components/ui.jsx`）；
  - React 19 + Tailwind 4 + shadcn CLI 偏新，初版未接入；稳定后可跑 `shadcn` CLI 替换为官方组件。
- [ ] **tags 独立建表**
  - 当前 tags 以 JSON 字符串存在 `entries.tags` 文本字段；
  - 后续可拆 `tags` / `entry_tags` 多对多表，支持按标签聚合/筛选页面。
- [ ] **搜索体验**
  - 命中高亮、模糊匹配 / 拼音 / 别名、回车直达第一条。
- [ ] **暗色模式**（Tailwind 4 `@theme` + dark variant，已留接口）。

## P3 —— 可选

- [ ] 知识库导入/导出（markdown / json），便于备份与多机同步。
- [ ] 工具级编辑/删除页面（目前工具只能由建条目时自动创建；删除工具走 API）。
- [ ] 编辑流程已实现（`#/edit/:id`），但缺少「移动到别的工具」的便捷 UI。
- [ ] 鉴权 / 多用户（当前是本地单用户工具，无需鉴权）。
- [ ] 把总结的 markdown 直接粘贴入库的快捷入口（命令行或拖拽）。
