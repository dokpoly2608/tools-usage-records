#!/usr/bin/env node
// 把 scripts/seed_curated.json 幂等导入知识库（需后端在 localhost:3000 运行）。
//   命令：按 (tool, title) 匹配，存在则更新，否则创建（tool 不存在自动建）。
//   提示词：按 title 匹配，存在则更新，否则创建。
// 纯 node（fetch），零依赖。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.API_BASE || 'http://localhost:3000/api';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_curated.json'), 'utf8'));

async function req(p, opts = {}) {
  const res = await fetch(BASE + p, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function findEntryId(tid, title) {
  const rows = await req(`/entries?tool=${tid}&q=${encodeURIComponent(title)}&limit=500`);
  const hit = rows.find((r) => r.title === title && r.tool_id === tid);
  return hit ? hit.id : null;
}
async function findPromptId(title) {
  const rows = await req(`/prompts?q=${encodeURIComponent(title)}&limit=500`);
  const hit = rows.find((r) => r.title === title);
  return hit ? hit.id : null;
}

let cmdCreated = 0, cmdUpdated = 0, prmCreated = 0, prmUpdated = 0;

// ---- 命令 ----
for (const c of data.commands) {
  // 解析 tool id（不存在则通过 tool_name 让后端自动建）
  let tid = null;
  const tools = await req('/tools');
  const found = tools.find((t) => t.name === c.tool);
  if (found) tid = found.id;

  const payload = {
    title: c.title,
    command: c.command,
    purpose: c.purpose,
    content: c.content || '',
    tags: c.tags || [],
    variables: c.variables || [],
  };

  const existing = tid ? await findEntryId(tid, c.title) : null;
  if (existing) {
    await req(`/entries/${existing}`, { method: 'PUT', body: payload });
    cmdUpdated++;
  } else {
    payload.tool_name = c.tool; // 后端自动建 tool
    await req('/entries', { method: 'POST', body: payload });
    cmdCreated++;
  }
  console.log(`  [cmd] ${c.title} → ${existing ? '更新' : '新建'}`);
}

// ---- 提示词 ----
for (const p of data.prompts) {
  const payload = {
    title: p.title,
    content: p.content,
    purpose: p.purpose,
    source: p.source,
    tags: p.tags || [],
    variables: p.variables || [],
  };
  const existing = await findPromptId(p.title);
  if (existing) {
    await req(`/prompts/${existing}`, { method: 'PUT', body: payload });
    prmUpdated++;
  } else {
    await req('/prompts', { method: 'POST', body: payload });
    prmCreated++;
  }
  console.log(`  [prompt] ${p.title} → ${existing ? '更新' : '新建'}`);
}

console.log(`\n完成：命令 新建 ${cmdCreated} / 更新 ${cmdUpdated}；提示词 新建 ${prmCreated} / 更新 ${prmUpdated}`);
