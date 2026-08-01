#!/usr/bin/env node
// 按会话采集 claude code / codex 的提示词档案，存到 .tmp/collect/sessions/。
// 每个会话一个 json：含 会话id/来源/项目/会话起止时间/采集时间/原始提示词列表。
// 产出 sessions/index.json 汇总。纯 node 零依赖。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();
const OUT = path.resolve('.tmp/collect/sessions');
fs.mkdirSync(path.join(OUT, 'claude'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'codex'), { recursive: true });

const COLLECTED_AT = new Date().toISOString();

// 复用 collect.mjs 的噪声过滤
function isNoise(text) {
  const t = text.trim();
  if (!t) return true;
  if (t.startsWith('<command-name>')) return true;
  if (t.startsWith('<local-command-')) return true;
  if (t.startsWith('<task-notification>')) return true;
  if (t.startsWith('<system-reminder>')) return true;
  if (t.startsWith('<user_shell_command>')) return true; // codex shell 命令回执
  if (t.startsWith('<environment_context>')) return true;
  if (t.startsWith('Caveat: The messages below')) return true;
  return false;
}

// ---------- claude code ----------
// 会话文件：~/.claude/projects/<project>/<sessionId>.jsonl
function collectClaude() {
  const dir = path.join(HOME, '.claude/projects');
  if (!fs.existsSync(dir)) return { sessions: 0, prompts: 0 };
  const list = [];
  let totalPrompts = 0;
  for (const proj of fs.readdirSync(dir)) {
    const pdir = path.join(dir, proj);
    if (!fs.statSync(pdir).isDirectory()) continue;
    for (const f of fs.readdirSync(pdir)) {
      if (!f.endsWith('.jsonl')) continue;
      const sessionId = f.replace(/\.jsonl$/, '');
      const fp = path.join(pdir, f);
      let lines;
      try { lines = fs.readFileSync(fp, 'utf8').split('\n'); } catch { continue; }
      const prompts = [];
      let tsList = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        let o;
        try { o = JSON.parse(line); } catch { continue; }
        if (o.timestamp) tsList.push(o.timestamp);
        if (o.type !== 'user') continue;
        const c = o.message?.content;
        let text = '';
        if (typeof c === 'string') text = c;
        else if (Array.isArray(c)) {
          text = c.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        }
        text = text.trim();
        if (isNoise(text)) continue;
        prompts.push({ ts: o.timestamp || '', text });
      }
      tsList = tsList.filter(Boolean).sort();
      const rec = {
        session_id: sessionId,
        source: 'claude-code',
        project: proj,
        session_start: tsList[0] || null,
        session_end: tsList[tsList.length - 1] || null,
        collected_at: COLLECTED_AT,
        prompt_count: prompts.length,
        prompts,
      };
      fs.writeFileSync(path.join(OUT, 'claude', `${sessionId}.json`), JSON.stringify(rec, null, 2));
      totalPrompts += prompts.length;
      list.push({ id: sessionId, source: 'claude-code', project: proj, time: rec.session_start, prompts_n: prompts.length });
    }
  }
  return { sessions: list.length, prompts: totalPrompts, list };
}

// ---------- codex ----------
// 会话文件：~/.codex/sessions/**/rollout-*.jsonl；首行 session_meta
function collectCodex() {
  const root = path.join(HOME, '.codex/sessions');
  if (!fs.existsSync(root)) return { sessions: 0, prompts: 0, list: [] };
  const list = [];
  let totalPrompts = 0;
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!name.startsWith('rollout-') || !name.endsWith('.jsonl')) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
      if (!lines.length) continue;
      let meta = null;
      try { meta = JSON.parse(lines[0]); } catch { continue; }
      if (meta.type !== 'session_meta') continue;
      const sid = meta.payload?.session_id || meta.payload?.id;
      if (!sid) continue;
      const cwd = meta.payload?.cwd || '';
      const start = meta.payload?.timestamp || meta.timestamp || null;
      const prompts = [];
      let endTs = start;
      for (let i = 1; i < lines.length; i++) {
        let o;
        try { o = JSON.parse(lines[i]); } catch { continue; }
        // codex rollout: type=="response_item" 且 payload.type=="message" role=="user"
        if (o.type === 'response_item' && o.payload?.type === 'message' && o.payload?.role === 'user') {
          const content = o.payload.content;
          let text = '';
          if (Array.isArray(content)) {
            text = content.filter((b) => b.text).map((b) => b.text).join('\n');
          } else if (typeof content === 'string') {
            text = content;
          }
          text = text.trim();
          if (text && !isNoise(text)) {
            prompts.push({ ts: o.timestamp || '', text });
          }
        }
        if (o.timestamp && o.timestamp > endTs) endTs = o.timestamp;
      }
      const proj = cwd ? path.basename(cwd) : '';
      const rec = {
        session_id: sid,
        source: 'codex',
        project: proj,
        cwd,
        session_start: start,
        session_end: endTs,
        cli_version: meta.payload?.cli_version || '',
        collected_at: COLLECTED_AT,
        prompt_count: prompts.length,
        prompts,
      };
      fs.writeFileSync(path.join(OUT, 'codex', `${sid}.json`), JSON.stringify(rec, null, 2));
      totalPrompts += prompts.length;
      list.push({ id: sid, source: 'codex', project: proj, time: start, prompts_n: prompts.length });
    }
  }
  walk(root);
  return { sessions: list.length, prompts: totalPrompts, list };
}

const claude = collectClaude();
const codex = collectCodex();

const index = {
  collected_at: COLLECTED_AT,
  claude: { sessions: claude.sessions, prompts: claude.prompts },
  codex: { sessions: codex.sessions, prompts: codex.prompts },
  list: [...claude.list, ...codex.list].sort((a, b) => (b.time || '').localeCompare(a.time || '')),
};
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));

console.log(`claude: ${claude.sessions} 会话 / ${claude.prompts} 提示词`);
console.log(`codex : ${codex.sessions} 会话 / ${codex.prompts} 提示词`);
console.log(`→ ${OUT}/`);
