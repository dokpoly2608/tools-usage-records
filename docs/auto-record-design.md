# 自动录入 / 监控 设计文档

> 目标：自动记录本地的 **zsh 命令** 与 **claude code / codex 提示词** 输入，定期用 AI 分析汇总后录入知识库，省去手动整理。
> 状态：**仅设计 + TODO**，暂不启用。参考已有 `agentmemory` 插件的 hook 模式（`~/.claude/plugins/.../agentmemory/0.9.28/hooks/`、`~/.codex/hooks.json`）。

## 一、架构

```
zsh ─┐                              ┌─> backend/data/raw_commands.jsonl
     ├─(hook 追加 JSONL)────────────┤
claude code ─┐                      │
             ├─(UserPromptSubmit)── ┼─> backend/data/raw_prompts.jsonl (source=claude-code|codex)
codex ───────┘                      │
                                    │
              scripts/auto_ingest.mjs (定时/cron/手动)
                    │  1. 读 raw 增量（记录已处理偏移）
                    │  2. 调 AI 聚类、提炼候选（复用 collect/analyze 管道）
                    │  3. 产出 candidates 待确认 或 直接幂等导入（复用 import.mjs）
                    └─> kb.sqlite (entries / prompts)
```

原始日志为本地 JSONL，**不进 git**（已在 `.gitignore` 排除 `backend/data/`）。

## 二、zsh 命令记录

在 `~/.zshrc` 末尾追加（`zshaddhistory` 在每条命令进历史前触发）：

```zsh
# 记录命令到 cmd-kb（自动录入，可注释掉关闭）
_cmdkb_log() {
  local cmd="${1%%$'\n'}"
  [[ -z "$cmd" ]] && return
  printf '{"ts":%s,"cwd":"%s","cmd":%s}\n' \
    "$EPOCHSECONDS" "$PWD" "$(printf '%s' "$cmd" | python3 -c 'import sys,json;print(json.dumps(sys.stdin.read()))')" \
    >> "$HOME/tmp_202608/personal_0801/01_tools_usage_records/backend/data/raw_commands.jsonl" 2>/dev/null
}
zshaddhistory_functions+=(_cmdkb_log)
```

- 用 `zshaddhistory_functions` 数组挂载，不覆盖已有 hook。
- `$EPOCHSECONDS` 是 zsh 内建时间戳；`$PWD` 记工作目录便于按项目归类。
- 失败静默（`2>/dev/null`），绝不影响正常命令执行。

## 三、claude code 提示词记录

`agentmemory` 的 `UserPromptSubmit` hook 收到 stdin JSON：`{ session_id, cwd, prompt }`（见其 `prompt-submit.mjs`）。照此写一个本地追加脚本 `scripts/hooks/claude-prompt.mjs`：

```js
#!/usr/bin/env node
// claude code UserPromptSubmit → 追加 raw_prompts.jsonl
import fs from 'node:fs';
import path from 'node:path';
const LOG = path.join(process.env.HOME, 'tmp_202608/personal_0801/01_tools_usage_records/backend/data/raw_prompts.jsonl');
let input = '';
for await (const c of process.stdin) input += c;
try {
  const d = JSON.parse(input);
  const prompt = d.prompt ?? d.userPrompt;
  if (!prompt || typeof prompt !== 'string') process.exit(0);
  const rec = { ts: new Date().toISOString(), source: 'claude-code', session_id: d.session_id || '', cwd: d.cwd || '', text: prompt };
  fs.appendFileSync(LOG, JSON.stringify(rec) + '\n');
} catch { /* 静默 */ }
```

在 `~/.claude/settings.json` 注册（参考 agentmemory 的 `hooks/hooks.json` 结构）：

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node \"$HOME/tmp_202608/personal_0801/01_tools_usage_records/scripts/hooks/claude-prompt.mjs\"" } ] }
    ]
  }
}
```

## 四、codex 提示词记录

codex 的 hook 事件名与 claude code 一致（`~/.codex/hooks.json` 已被 agentmemory 用 `UserPromptSubmit`/`Stop` 等占用）。复用同一脚本，source 标 `codex`。在 `~/.codex/hooks.json` 的 `UserPromptSubmit` 数组里追加一项：

```json
{ "type": "command", "command": "node \"$HOME/tmp_202608/personal_0801/01_tools_usage_records/scripts/hooks/codex-prompt.mjs\"" }
```

`codex-prompt.mjs` 与 `claude-prompt.mjs` 几乎相同，仅 `source: 'codex'`。也可合并为一个脚本，靠环境变量区分来源。

> 注意：codex 已有 agentmemory 的 `UserPromptSubmit` hook。**追加**一项即可，不要替换，避免破坏现有 agentmemory 功能。

## 五、定期 AI 分析入库

`scripts/auto_ingest.mjs`（草案）：

1. **增量读取**：维护 `backend/data/.ingest_offset.json` 记录每个 raw 文件已处理到的字节偏移；只读新增部分。
2. **去重清洗**：对命令做 `generalize()`（复用 `analyze.mjs` 的泛化逻辑），过滤噪声（`ll`/`cd`/`pwd` 这类无信息量命令可降权或丢弃）；提示词过滤 `[Request interrupted...]` 等噪声（复用 `collect.mjs` 的 `isNoise`）。
3. **AI 聚类提炼**：把新增条目按泛化模板/首词聚类后，批量送给 AI（claude `-p` 或 API），让它产出「值得沉淀的候选」——每条给 title/purpose/command-or-content/variables/tags/source。提示词中给系统提示约束输出 JSON。
4. **入库**：两种模式（配置项）：
   - `review`（默认，推荐）：AI 产出追加到 `docs/candidates.md`，等人工确认后跑 `import.mjs`。
   - `auto`：直接调 `import.mjs` 的幂等导入逻辑入库，事后在网站清理。
5. **触发**：手动 `node scripts/auto_ingest.mjs`；或用 cron / launchd 每日跑一次；或做成 claude code `/loop` / skill 定期触发。

复用现有管道：清洗逻辑 ← `scripts/collect.mjs` + `scripts/analyze.mjs`；入库 ← `scripts/import.mjs`。

## 六、隐私与去重

- raw 日志含完整命令/提示词（可能含密钥、内部路径），**仅存本地**，已 gitignore。AI 分析时如走云端需注意：可先做脱敏（正则替换 token/key/内部域名）再送模型，或只用本地模型。
- 去重：`import.mjs` 已按 `(tool,title)` / `title` 幂等；AI 提炼时应主动归并到已有条目（命中则建议「更新 usage_count / 补充 content」而非新建）。
- 关闭：注释掉 `~/.zshrc` 的 `_cmdkb_log`、移除 settings.json / codex hooks.json 中对应项即可，raw 文件可随时删除。

## 七、落地清单（实现时）

- [ ] `scripts/hooks/claude-prompt.mjs`、`codex-prompt.mjs`（本设计的脚本）
- [ ] `~/.zshrc` 追加 `_cmdkb_log`
- [ ] `~/.claude/settings.json` 加 `UserPromptSubmit`
- [ ] `~/.codex/hooks.json` 追加 `UserPromptSubmit`（不替换 agentmemory）
- [ ] `scripts/auto_ingest.mjs`（增量 + AI 聚类 + 入库）
- [ ] `.ingest_offset.json` 偏移管理
- [ ] cron / launchd 或 skill 触发
