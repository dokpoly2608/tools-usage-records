#!/usr/bin/env node
// 收集本地历史输入到 .tmp/collect/，供后续统计分析。
//   zsh   → commands.tsv        (count \t first_ts \t last_ts \t command)
//   codex → prompts_codex.jsonl ({ts, session_id, text})
//   claude→ prompts_claude.jsonl({ts, project, text})
// 纯 node 零依赖。原始 dump 含隐私，已在 .gitignore 排除 .tmp/collect/。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const OUT = path.resolve('.tmp/collect');
fs.mkdirSync(OUT, { recursive: true });

// ---------- zsh ----------
function collectZsh() {
  const file = path.join(HOME, '.zsh_history');
  if (!fs.existsSync(file)) return 0;
  const raw = fs.readFileSync(file, 'utf8');
  // 按条目切：每条以 ": <ts>:<n>;" 开头；多行命令会延续到下一个前缀
  const entries = [];
  const re = /^: (\d+):\d+;/;
  let cur = null;
  for (const line of raw.split('\n')) {
    const m = line.match(re);
    if (m) {
      if (cur) entries.push(cur);
      cur = { ts: Number(m[1]), cmd: line.slice(m[0].length) };
    } else if (cur) {
      // 多行命令续行
      cur.cmd += '\n' + line;
    }
  }
  if (cur) entries.push(cur);

  // 归一化 + 计数
  const map = new Map(); // cmd -> {count, first, last}
  for (const e of entries) {
    const cmd = e.cmd.replace(/\\\n/g, '\n').trim(); // 还原续行转义
    if (!cmd) continue;
    const k = cmd;
    const v = map.get(k) || { count: 0, first: e.ts, last: e.ts };
    v.count += 1;
    v.first = Math.min(v.first, e.ts);
    v.last = Math.max(v.last, e.ts);
    map.set(k, v);
  }
  const rows = [...map.entries()]
    .map(([cmd, v]) => ({ ...v, cmd }))
    .sort((a, b) => b.count - a.count);
  const tsv = ['count\tfirst_ts\tlast_ts\tcommand']
    .concat(rows.map((r) => `${r.count}\t${r.first}\t${r.last}\t${r.cmd.replace(/\t/g, ' ').replace(/\n/g, ' ⏎ ')}`))
    .join('\n');
  fs.writeFileSync(path.join(OUT, 'commands.tsv'), tsv);
  return rows.length;
}

// ---------- codex ----------
function collectCodex() {
  const file = path.join(HOME, '.codex/history.jsonl');
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  const out = fs.createWriteStream(path.join(OUT, 'prompts_codex.jsonl'));
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (!o.text || !o.text.trim()) continue;
      out.write(JSON.stringify({ ts: o.ts, session_id: o.session_id, text: o.text }) + '\n');
      n++;
    } catch { /* skip */ }
  }
  out.end();
  return n;
}

// ---------- claude code ----------
function isNoise(text) {
  const t = text.trim();
  if (!t) return true;
  if (t.startsWith('<command-name>')) return true;
  if (t.startsWith('<local-command-')) return true;
  if (t.startsWith('<task-notification>')) return true;
  if (t.startsWith('<system-reminder>')) return true;
  if (t.startsWith('Caveat: The messages below')) return true;
  return false;
}
function collectClaude() {
  const dir = path.join(HOME, '.claude/projects');
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  const out = fs.createWriteStream(path.join(OUT, 'prompts_claude.jsonl'));
  const files = fs.readdirSync(dir);
  for (const proj of files) {
    const pdir = path.join(dir, proj);
    if (!fs.statSync(pdir).isDirectory()) continue;
    for (const f of fs.readdirSync(pdir)) {
      if (!f.endsWith('.jsonl')) continue;
      const fp = path.join(pdir, f);
      let lines;
      try { lines = fs.readFileSync(fp, 'utf8').split('\n'); } catch { continue; }
      for (const line of lines) {
        if (!line.trim()) continue;
        let o;
        try { o = JSON.parse(line); } catch { continue; }
        if (o.type !== 'user') continue;
        const c = o.message?.content;
        let text = '';
        if (typeof c === 'string') text = c;
        else if (Array.isArray(c)) {
          // 取文本块，跳过 tool_result
          text = c.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        }
        text = text.trim();
        if (isNoise(text)) continue;
        const ts = o.timestamp || '';
        out.write(JSON.stringify({ ts, project: proj, text }) + '\n');
        n++;
      }
    }
  }
  out.end();
  return n;
}

const z = collectZsh();
const cx = collectCodex();
const cl = collectClaude();
console.log(`zsh 命令条目(去重后): ${z}  → .tmp/collect/commands.tsv`);
console.log(`codex 提示词: ${cx}        → .tmp/collect/prompts_codex.jsonl`);
console.log(`claude 提示词: ${cl}       → .tmp/collect/prompts_claude.jsonl`);
