import { db, initSchema, nowIso } from './db.js';

// 示例知识库数据 —— 取自需求里举的例子，开箱即可看到效果
const SEED = [
  {
    tool: 'git',
    tool_desc: '分布式版本控制系统',
    entries: [
      {
        title: '删除远程分支',
        command: 'git push origin --delete <branch>',
        purpose: '删除远程仓库上的分支',
        tags: ['branch', 'remote', '删除'],
        content: `## 删除远程分支

\`\`\`bash
# 推荐写法
git push origin --delete <branch-name>

# 等价的旧写法（冒号前缀）
git push origin :<branch-name>
\`\`\`

### 同时删除本地 + 远程

\`\`\`bash
git branch -d <branch-name>            # 删本地（已合并）
git branch -D <branch-name>            # 强制删本地
git push origin --delete <branch-name> # 删远程
\`\`\`

> 远程分支名用 \`git branch -r\` 查看；删除后队友需要 \`git fetch --prune\` 清理本地残留引用。`,
      },
      {
        title: '查看 / 设置上游分支',
        command: 'git branch --set-upstream-to=origin/<branch>',
        purpose: '把当前本地分支关联到远程分支',
        tags: ['branch', 'upstream', 'push'],
        content: `## 关联上游分支

\`\`\`bash
# 首次推送并建立关联
git push -u origin <branch>

# 已存在的分支补关联
git branch --set-upstream-to=origin/<branch>
\`\`\`

关联后可直接 \`git push\` / \`git pull\` 不带参数。`,
      },
    ],
  },
  {
    tool: 'claude',
    tool_desc: 'Claude Code CLI',
    entries: [
      {
        title: '非交互模式执行（-p / print）',
        command: 'claude -p "你的提示"',
        purpose: '一次性发送 prompt 拿到结果，不走交互式会话',
        tags: ['cli', '-p', '非交互', '脚本'],
        content: `## claude code 非交互模式

\`\`\`bash
# 直接给 prompt，输出结果后退出
claude -p "解释这段代码的作用"

# 从 stdin 读入
cat file.py | claude -p "review 这段代码"

# 指定输出格式
claude -p "列出 TODO" --output-format json
\`\`\`

### 常用参数

| 参数 | 作用 |
| --- | --- |
| \`-p, --print\` | 非交互，执行完即退出 |
| \`--output-format\` | text / json / stream-json |
| \`--model\` | 指定模型 |
| \`--allowedTools\` | 允许的工具 |

> 适合写进脚本、CI、或被其他程序调用。`,
      },
      {
        title: '指定允许使用的工具',
        command: 'claude -p "..." --allowedTools "Bash(git status)"',
        purpose: '限制非交互模式下能调用的工具范围',
        tags: ['cli', '权限', '工具'],
        content: `## 限制可用工具

\`\`\`bash
claude -p "看看 git 状态" --allowedTools "Bash(git status:*)"
\`\`\`

可传多个，逗号分隔，或多次 \`--allowedTools\`。`,
      },
    ],
  },
  {
    tool: 'jq',
    tool_desc: '命令行 JSON 处理器',
    entries: [
      {
        title: '提取嵌套字段',
        command: "jq '.data.items[].name'",
        purpose: '从 JSON 中提取数组里每个对象的某个字段',
        tags: ['json', '提取', '数组'],
        content: `## jq 提取字段

\`\`\`bash
echo '{"data":{"items":[{"name":"a"},{"name":"b"}]}}' \\
  | jq '.data.items[].name'
# 输出:
# "a"
# "b"
\`\`\`

### 常用片段

\`\`\`bash
jq '.field'           # 取字段
jq '.[]'              # 展开数组
jq '.a + .b'          # 运算
jq 'keys'             # 列出 key
jq '.[] | select(.age>18)'  # 过滤
\`\`\``,
      },
    ],
  },
];

async function ensureTool(name, desc) {
  const existing = await db.selectFrom('tools').select('id').where('name', '=', name).executeTakeFirst();
  if (existing) return existing.id;
  const now = nowIso();
  const r = await db.insertInto('tools')
    .values({ name, description: desc || '', created_at: now, updated_at: now })
    .executeTakeFirst();
  return Number(r.insertId);
}

async function main() {
  await initSchema();

  const count = await db.selectFrom('entries').select((eb) => eb.fn.count('id').as('c')).executeTakeFirst();
  if (Number(count?.c || 0) > 0) {
    // eslint-disable-next-line no-console
    console.log(`⚠️  已有 ${count.c} 条数据，跳过 seed（如需重置请删除 backend/data/kb.sqlite）`);
    return;
  }

  for (const group of SEED) {
    const tid = await ensureTool(group.tool, group.tool_desc);
    for (const e of group.entries) {
      const now = nowIso();
      await db.insertInto('entries').values({
        tool_id: tid,
        title: e.title,
        command: e.command,
        purpose: e.purpose,
        content: e.content,
        tags: JSON.stringify(e.tags || []),
        usage_count: 0,
        created_at: now,
        updated_at: now,
      }).execute();
    }
    // eslint-disable-next-line no-console
    console.log(`✓ seeded tool "${group.tool}" (${group.entries.length} 条)`);
  }
  // eslint-disable-next-line no-console
  console.log('🌱 seed 完成');
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('seed failed:', e);
  process.exit(1);
});
