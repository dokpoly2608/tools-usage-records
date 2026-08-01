# 命令用法知识库（cmd-usage-kb）

把那些每次都要 Google / 问大模型、但明明可以复用的命令用法沉淀下来：
记录、搜索、统计高频命令，搜索时**按使用次数加权排序**，越常用的越靠前。

> 形态：先做**网站**（直观看结果），CLI 留到后续总结出高频功能再做（见 [TODO](#todo)）。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 后端 | **Koa 3** + `@koa/router` + `@koa/cors` |
| 数据库 | **SQLite**（better-sqlite3，WAL 模式） |
| 查询构建 | **Kysely**（类型安全的 query builder，不裸拼 SQL） |
| 前端 | **Vite 6 + React 19 + Tailwind 4 + TanStack React Query** |
| Markdown | react-markdown + remark-gfm（代码块带逐块复制按钮） |
| 组件 | 手写少量 shadcn 风格组件（Button/Input/Card/Badge…，基于 clsx） |

前后端分离，开发期前端 Vite 把 `/api` 代理到后端 3000 端口。

## 目录结构

```
.
├── backend/
│   ├── src/
│   │   ├── index.js          # Koa 入口 + json body 中间件 + 错误处理
│   │   ├── db.js             # Kysely 实例 + schema 初始化
│   │   ├── seed.js           # 示例数据（git/claude/jq）
│   │   └── routes/
│   │       ├── tools.js      # /api/tools
│   │       ├── entries.js    # /api/entries（搜索/CRUD/记录使用）
│   │       └── stats.js      # /api/stats
│   └── data/kb.sqlite        # 运行后生成
└── frontend/
    ├── vite.config.js        # proxy /api -> :3000
    └── src/
        ├── api.js            # fetch 封装 + react-query hooks
        ├── nav.jsx           # 极简 hash 路由上下文
        ├── components/        # ui.jsx / Layout.jsx / Markdown.jsx
        └── pages/            # HomePage / EntryView / EntryForm / StatsPage
```

## 快速开始

```bash
# 1. 安装所有依赖（根 + 前后端）
npm run install:all

# 2.（可选）写入示例数据
npm run seed

# 3. 同时启动前后端
npm run dev
#  后端 → http://localhost:3000
#  前端 → http://localhost:5173   ← 浏览器打开这个
```

只想单独跑某一端：`npm run dev:backend` / `npm run dev:frontend`。

重置数据：删除 `backend/data/kb.sqlite` 后重新 `npm run seed`。

## 数据模型

- **tools**：工具（git / jq / claude / docker …）。`name` 唯一。
- **entries**：命令用法条目。归属某个 tool，包含 `title`、`command`（命令原文）、`purpose`（用途简述）、`content`（markdown 详情）、`tags`、`usage_count`（累计使用次数，用于搜索加权）。
- **usage_logs**：每次「记录使用」的明细（时间 + 备注），用于历史时间线。

## 核心功能

- **搜索匹配**：标题 / 命令 / 用途 / 内容 / 标签 多字段 LIKE；排序 = 匹配位置权重（标题 100 > 命令 50 > 用途 20）+ `usage_count`，**高频命令优先**。
- **使用频次**：每条命令记 `usage_count`，按工具聚合；详情页可「记录本次使用」，统计页有高频榜 / 按工具汇总 / 最近使用。
- **Markdown 编辑**：新建/编辑带实时预览；详情页渲染，代码块悬浮显示复制按钮，命令一键复制。
- **新建工具**：建条目时选「新建工具」可直接建出 tool，无需先建工具。

## API 一览

```
GET    /api/tools                     工具列表（含条目数、累计使用）
POST   /api/tools                     新建工具
DELETE /api/tools/:id                 删除工具

GET    /api/entries?tool=&q=&limit=   列表/搜索（按频次+匹配加权排序）
GET    /api/entries/:id               详情
POST   /api/entries                   创建（可带 tool_id 或 tool_name）
PUT    /api/entries/:id               更新
DELETE /api/entries/:id               删除
POST   /api/entries/:id/use           记录一次使用（usage_count +1，写日志）
GET    /api/entries/:id/history       使用历史

GET    /api/stats                     总览（条目数/工具数/累计使用）
GET    /api/stats/top?limit=          高频命令 Top N
GET    /api/stats/by-tool             按工具汇总
GET    /api/stats/recent?limit=       最近使用记录
```

## <a id="todo"></a>TODO（快速实现优先，以下暂缓）

见 [TODO.md](./TODO.md)。
