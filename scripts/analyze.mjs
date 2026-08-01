#!/usr/bin/env node
// 读 .tmp/collect/ 下的原始收集，产出 .tmp/collect/stats.md（确定性统计，供人工提炼候选）。
//   - 命令：按工具分组 Top、泛化模板（路径/数字/引号 → {{arg}}）后按频次聚合
//   - 提示词：按来源统计、按首词/关键词粗聚类采样
import fs from 'node:fs';
import path from 'node:path';

const IN = path.resolve('.tmp/collect');
const OUT = path.join(IN, 'stats.md');

// ---------- 命令 ----------
function loadCommands() {
  const tsv = fs.readFileSync(path.join(IN, 'commands.tsv'), 'utf8').split('\n').slice(1).filter(Boolean);
  return tsv.map((l) => {
    const [count, first, last, ...rest] = l.split('\t');
    return { count: Number(count), first: Number(first), last: Number(last), cmd: rest.join('\t') };
  }).filter((c) => c.cmd);
}

function toolOf(cmd) {
  // 去掉前导 env 赋值 / sudo / cd 之外的第一个实际命令
  let s = cmd.replace(/^[\w_]+=\S+\s+/, '');
  const m = s.match(/^(\S+)/);
  if (!m) return '(other)';
  return m[1];
}

// 泛化：路径/数字/十六进制/引号串 → {{arg}}，便于发现同形命令
function generalize(cmd) {
  let g = cmd;
  g = g.replace(/(~\/[^\s'"]+)/g, '{{path}}');          // ~/...
  g = g.replace(/(\/[^\s'"]+)/g, '{{path}}');           // /abs/...
  g = g.replace(/"([^"]*)"/g, '"{{str}}"');             // "..."
  g = g.replace(/'([^']*)'/g, "'{{str}}'");             // '...'
  g = g.replace(/\b[0-9a-f]{7,40}\b/gi, '{{hash}}');    // git sha
  g = g.replace(/\b\d+\b/g, '{{n}}');                   // 纯数字
  return g;
}

function analyzeCommands() {
  const cmds = loadCommands();
  const byTool = new Map();
  const byPattern = new Map(); // generalized -> {count, samples:Set}
  for (const c of cmds) {
    const t = toolOf(c.cmd);
    (byTool.get(t) || byTool.set(t, []).get(t)).push(c);
    const g = generalize(c.cmd);
    const v = byPattern.get(g) || { count: 0, samples: new Set() };
    v.count += c.count;
    if (v.samples.size < 3) v.samples.add(c.cmd);
    byPattern.set(g, v);
  }
  return { cmds, byTool, byPattern };
}

// ---------- 提示词 ----------
function loadPrompts(file) {
  const fp = path.join(IN, file);
  if (!fs.existsSync(fp)) return [];
  return fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function firstWord(t) {
  return (t.match(/^[\p{L}\p{N}_]+/u) || [''])[0];
}

function analyzePrompts() {
  const codex = loadPrompts('prompts_codex.jsonl');
  const claude = loadPrompts('prompts_claude.jsonl');
  // 按首词聚类（粗），用于采样
  function cluster(list) {
    const m = new Map();
    for (const p of list) {
      const w = firstWord(p.text) || '(空)';
      (m.get(w) || m.set(w, []).get(w)).push(p);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }
  return { codex, claude, codexClusters: cluster(codex), claudeClusters: cluster(claude) };
}

// ---------- 输出 ----------
const { cmds, byTool, byPattern } = analyzeCommands();
const P = analyzePrompts();

let md = '# 历史输入统计（自动生成，供人工提炼候选）\n\n';
md += `> 源：zsh 去重命令 ${cmds.length} 条；codex 提示词 ${P.codex.length} 条；claude 提示词 ${P.claude.length} 条。\n\n`;

md += '## 一、命令 —— 按工具分组 Top\n\n';
const tools = [...byTool.entries()].sort((a, b) => {
  const ca = a[1].reduce((s, c) => s + c.count, 0);
  const cb = b[1].reduce((s, c) => s + c.count, 0);
  return cb - ca;
});
for (const [t, list] of tools.slice(0, 25)) {
  const total = list.reduce((s, c) => s + c.count, 0);
  md += `### ${t} （累计 ${total} 次，${list.length} 种）\n\n`;
  md += '| 次数 | 命令 |\n| --- | --- |\n';
  for (const c of list.slice(0, 12)) {
    md += `| ${c.count} | \`${c.cmd.replace(/\|/g, '\\|').slice(0, 120)}\` |\n`;
  }
  md += '\n';
}

md += '## 二、命令 —— 泛化模板（频次高且有复用价值）\n\n';
md += '> 路径/数字/引号/sha 已替换为 `{{arg}}`/`{{path}}`/`{{n}}` 等，便于发现同形命令。\n\n';
md += '| 频次 | 泛化模板 | 样例 |\n| --- | --- | --- |\n';
const pats = [...byPattern.entries()].filter(([, v]) => v.count >= 5).sort((a, b) => b[1].count - a[1].count);
for (const [g, v] of pats.slice(0, 60)) {
  const sample = [...v.samples][0] || '';
  md += `| ${v.count} | \`${g.replace(/\|/g, '\\|').slice(0, 100)}\` | \`${sample.replace(/\|/g, '\\|').slice(0, 80)}\` |\n`;
}

md += '\n## 三、提示词 —— codex（按首词聚类 Top + 采样）\n\n';
for (const [w, list] of P.codexClusters.slice(0, 15)) {
  md += `- **${w}** (${list.length})：${list.slice(0, 2).map((p) => p.text.replace(/\n/g, ' ').slice(0, 80)).join(' / ')}\n`;
}

md += '\n## 四、提示词 —— claude code（按首词聚类 Top + 采样）\n\n';
for (const [w, list] of P.claudeClusters.slice(0, 15)) {
  md += `- **${w}** (${list.length})：${list.slice(0, 2).map((p) => p.text.replace(/\n/g, ' ').slice(0, 80)).join(' / ')}\n`;
}

md += '\n## 五、提示词 —— 高频复用候选（手动提炼时关注）\n\n';
md += '下面按文本完全去重，取出现 ≥2 次的提示词（claude+codex 合并），这些是最值得沉淀的复用提示词：\n\n';
const pmap = new Map();
for (const p of [...P.codex, ...P.claude]) {
  const k = p.text.trim();
  if (k.length < 6) continue;
  pmap.set(k, (pmap.get(k) || 0) + 1);
}
const dups = [...pmap.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
md += `共 ${dups.length} 条重复出现的提示词，Top 30：\n\n`;
for (const [t, n] of dups.slice(0, 30)) {
  md += `- (${n}×) ${t.replace(/\n/g, ' ').slice(0, 140)}\n`;
}

fs.writeFileSync(OUT, md);
console.log(`已写出 ${OUT}（${md.length} 字节）`);
console.log(`命令工具数 ${tools.length}，泛化模板(≥5次) ${pats.length}，重复提示词 ${dups.length}`);
