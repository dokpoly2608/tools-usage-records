# 候选清单（待评审导入）

> 从 zsh（1454 条去重）/ codex（909）/ claude（1604）历史输入中提炼的高频、通用、有复用价值的条目。
> 工作隐私路径/项目专属命令已过滤。**请审阅：删除你不想要的、补充说明，确认后我会生成 `seed_curated.json` 批量导入。**
> 自动统计原文见 `.tmp/collect/stats.md`（未入库）。

---

## 一、命令候选

### git

| # | 标题 | 命令（模板） | 用途 | 变量 | 标签 |
|---|---|---|---|---|---|
| c1 | 推送当前分支并设上游 | `git push -u origin $(git branch --show-current)` | 推送当前分支到远程并建立追踪关系（10×） | — | push, upstream |
| c2 | 删除远程分支 | `git push origin --delete {{branch}}` | 删除远程仓库上的分支 | `branch`:远程分支名 | branch, remote, 删除 |
| c3 | 快速提交全部改动（git ci 别名） | `git ci -m "{{msg}}" -a` | 用自定义 `ci` 别名暂存并提交全部改动（112×） | `msg`:提交信息 | commit, alias |
| c4 | 图形化提交历史 | `git log --oneline --graph` | 单行+图形展示提交历史（8×） | — | log, history |
| c5 | 切回上一个分支 | `git switch -` | 切换到上一次所在的分支（8×） | — | branch, switch |
| c6 | 查看所有分支 | `git branch -a` | 列出本地+远程全部分支（7×） | — | branch |
| c7 | 查看远程地址 | `git remote -v` | 查看仓库远程地址（8×） | — | remote |
| c8 | 丢弃工作区改动 | `git restore .` | 还原当前目录所有未提交改动（6×） | — | restore, 危险 |
| c9 | 初始化仓库 | `git init` | 在当前目录初始化 git 仓库（17×） | — | init |

### claude code（最高频工具，293×）

| # | 标题 | 命令（模板） | 用途 | 变量 | 标签 |
|---|---|---|---|---|---|
| c10 | 跳过权限启动 claude | `claude --allow-dangerously-skip-permissions --dangerously-skip-permissions` | 免确认启动 claude code（最高频，203×） | — | claude, 启动 |
| c11 | 用指定配置启动 claude | `claude --settings {{path}} --allow-dangerously-skip-permissions --dangerously-skip-permissions` | 用自定义 settings.json 启动（如切换模型/网关，42×） | `path`:settings.json 路径 | claude, 配置 |
| c12 | 恢复 claude 会话 | `claude --resume {{session}}` | 恢复指定 session id 的历史会话 | `session`:会话 id | claude, resume |

### codex（111×）

| # | 标题 | 命令（模板） | 用途 | 变量 | 标签 |
|---|---|---|---|---|---|
| c13 | 免审批启动 codex | `codex --dangerously-bypass-approvals-and-sandbox` | 跳过审批与沙箱启动 codex（92×） | — | codex, 启动 |
| c14 | 恢复 codex 会话 | `codex resume {{session}}` | 恢复指定 session 的 codex 会话 | `session`:会话 id | codex, resume |
| c15 | 用指定 profile 启动 codex | `codex -p {{profile}}` | 用指定配置 profile 启动（3×） | `profile`:profile 名 | codex, 配置 |

### tmux / 通用开发

| # | 标题 | 命令（模板） | 用途 | 变量 | 标签 |
|---|---|---|---|---|---|
| c16 | 新建/接入命名会话 | `tmux new -t "{{name}}"` | 新建或接入一个命名 tmux 会话（48×） | `name`:会话名 | tmux |
| c17 | 列出 tmux 会话 | `tmux ls` | 查看当前所有 tmux 会话（19×） | — | tmux |
| c18 | 起静态文件服务器 | `python3 -m http.server` | 在当前目录起 HTTP 静态服务（默认 8000，6×） | — | python, server |
| c19 | 查端口占用 | `portpeek -p {{range}} -t node` | 查指定端口段被哪些 node 进程占用（9×） | `range`:端口段如 3000-3200 | 端口, 调试 |
| c20 | 复制文件作为 CLAUDE.md | `cp {{path}} CLAUDE.md` | 把模板文件复制为当前项目 CLAUDE.md（20×） | `path`:模板路径 | claude, 模板 |
| c21 | uv 安装本地工具 | `uv tool install --force {{path}}` | 用 uv 全局安装/覆盖本地 python 工具（8×） | `path`:工具目录 | uv, python |
| c22 | uv 运行脚本（多 worker） | `uv run python {{script}} --workers {{n}} {{path}}` | 用 uv 运行 python 脚本并指定 worker 数（8×） | `script`:脚本;`n`:worker数;`path`:输入 | uv, python |

---

## 二、提示词候选

| # | 标题 | 提示词原文（模板） | 用途 | 来源 | 变量 |
|---|---|---|---|---|---|
| p1 | 提交代码（参考规范） | `提交 git 保存代码。commit message 参考仓库里已有的提交信息规范，先看近期提交再写。` | 让 AI 提交当前改动并遵守已有 commit 规范（最高频，56×“提交git”类） | claude-code | — |
| p2 | 继续上次工作 | `Continue from where you left off.` | 恢复上下文继续未完成的工作（23×） | claude-code | — |
| p3 | 切换 worktree 继续 | `切换到刚才的 worktree 然后继续工作！` | 切回之前的工作树继续任务（7×） | claude-code | — |
| p4 | 只读调研（不改代码） | `不要改代码，只调研为什么 {{question}}。给出原因分析和结论，不要直接动手改。` | 约束 AI 仅调研不改代码（4×） | claude-code | `question`:要调研的问题 |
| p5 | 输出为排序表格 | `按从高到低分成 {{n}} 个表格列出 {{topic}}。` | 约定输出格式为多个降序表格 | claude-code | `n`:表数;`topic`:主题 |
| p6 | 分析下一个条目 | `ok 分析下一个 {{item}}。` | 推进到下一个分析对象（字段/用例等） | codex | `item`:分析对象 |
| p7 | 代码审查 | `请审查以下 {{language}} 代码，重点关注 {{focus}}：\n\n\`\`\`\n{{code}}\n\`\`\`\n\n给出问题清单与改进建议。` | 通用代码审查模板 | manual | `language`;`focus`;`code` |
| p8 | 只分析不修改某目录 | `只分析不修改，目录：{{path}}。读完代码后说明现状与问题，不要做任何写入。` | 强制只读分析指定目录 | codex | `path`:目录 |

---

## 三、说明

- 命令侧 `git push origin --delete {{branch}}` 已是系统 seed 条目（本次会改为模板形式）；c2 与之重复，导入时跳过或合并。
- `git ci` 是用户自定义 alias（`git config alias.ci`），导入时在 content 里注明。
- 提示词 p1/p2/p3 直接来自历史高频原话，已轻度泛化。
- 确认后我会把保留项写成 `scripts/seed_curated.json`，用 `scripts/import.mjs` 幂等导入（按 title 去重）。
