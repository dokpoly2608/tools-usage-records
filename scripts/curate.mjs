#!/usr/bin/env node
// 读 .tmp/collect/sessions/ 的会话档案，筛选值得总结的提示词模板，产出 docs/curated_templates.json（可追溯，入库）。
// 筛选标准：
//   1) 文本完全去重后出现 ≥2 次（高频复用）
//   2) 单条但有模板化价值：含占位/变量位、或带明确指令意图（"审查/分析/提交/继续/调研/输出..."开头）
//   3) 排除过短(<6)、纯对话(ok/hello/额/继续/goon 等)、工作隐私路径只保留结构
// 产出含每条的来源会话 id 与次数，便于追溯。
import fs from 'node:fs';
import path from 'node:path';

const IN = path.resolve('.tmp/collect/sessions');
const OUT = path.resolve('docs/curated_templates.json');

function loadAll() {
  const all = []; // {text, source, session_id, project, ts}
  for (const src of ['claude', 'codex']) {
    const d = path.join(IN, src);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.json')) continue;
      let rec;
      try { rec = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch { continue; }
      for (const p of rec.prompts || []) {
        all.push({ text: p.text, source: rec.source, session_id: rec.session_id, project: rec.project, ts: p.ts });
      }
    }
  }
  return all;
}

// 过短/纯对话噪声 + 系统/中断/注入噪声
function isChatter(t) {
  const s = t.trim();
  if (s.length < 6) return true;
  const low = /^(ok|okay|goon|go on|继续|好的|额|噢|对了|hello|你好|hi|yes|no|提交|提交git|提交git了吗|继续吧|继续\.?|1|2|3)$/i;
  if (low.test(s)) return true;
  // 系统注入 / 中断 / 框架自动内容
  if (s.startsWith('[Request interrupted')) return true;
  if (s.startsWith('<turn_aborted>')) return true;
  if (s.startsWith('<recommended_plugins>')) return true;
  if (s.startsWith('[Your previous response had no visible output')) return true;
  if (s.startsWith('# AGENTS.md instructions')) return true;
  if (s.startsWith('# Codex AGENTS.md')) return true;
  if (s.startsWith('--- HUMAN')) return true;
  if (s.startsWith('Caveat: The messages below')) return true;
  if (/^The following is the Codex agent history/.test(s)) return true;
  return false;
}

// 意图关键词（开头或包含）
const INTENT = [
  /^请?(审查|review|检查|分析|调研|研究|总结|归纳|梳理|优化|改进|重构|实现|新增|添加|修改|删除|生成|输出|列出|排查|调试|修复|写一个|帮我)/,
  /(按照|参考|根据).+(规范|模板|格式|约定)/,
  /\{\{.*\}\}/, // 含变量占位
];

function hasIntent(t) {
  return INTENT.some((re) => re.test(t));
}

const all = loadAll();

// 1) 完全去重 + 计数 + 来源会话
const byText = new Map();
for (const p of all) {
  const k = p.text.trim();
  if (isChatter(k)) continue;
  let v = byText.get(k);
  if (!v) { v = { text: k, count: 0, sources: new Set(), sessions: new Set(), projects: new Set() }; byText.set(k, v); }
  v.count++;
  v.sources.add(p.source);
  v.sessions.add(p.session_id);
  if (p.project) v.projects.add(p.project);
}

// 2) 高频（≥2）
const frequent = [...byText.values()].filter((v) => v.count >= 2).sort((a, b) => b.count - a.count);

// 3) 单条但有意图/占位（从 count==1 里挑）
const intentful = [...byText.values()]
  .filter((v) => v.count === 1 && hasIntent(v.text) && v.text.length <= 400)
  .sort((a, b) => a.text.length - b.text.length)
  .slice(0, 60);

const result = {
  collected_at: new Date().toISOString().slice(0, 19) + 'Z',
  summary: {
    total_prompts: all.length,
    unique_after_dedup: byText.size,
    frequent_ge2: frequent.length,
    intentful_single: intentful.length,
  },
  frequent: frequent.map((v) => ({
    count: v.count,
    sources: [...v.sources],
    session_count: v.sessions.size,
    text: v.text,
  })),
  intentful: intentful.map((v) => ({
    sources: [...v.sources],
    text: v.text,
  })),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`总提示词 ${all.length}，去重后 ${byText.size}，高频(≥2) ${frequent.length}，单条有意图 ${intentful.length}`);
console.log(`→ ${OUT}`);
