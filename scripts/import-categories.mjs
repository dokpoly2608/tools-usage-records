#!/usr/bin/env node
// 把 scripts/seed_categories.json 导入：幂等建分类 + 给提示词归类(已有则更新category,否则新建)。
// 需后端在 localhost:3000 运行。纯 node(fetch) 零依赖。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.API_BASE || 'http://localhost:3000/api';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed_categories.json'), 'utf8'));

async function req(p, opts = {}) {
  const res = await fetch(BASE + p, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// 分类名 -> id（不存在则建）
async function ensureCategoryId(name) {
  const cats = await req('/categories');
  const found = cats.find((c) => c.name === name);
  if (found) return found.id;
  const created = await req('/categories', { method: 'POST', body: { name } });
  return created.id;
}

async function findPromptId(title) {
  const rows = await req(`/prompts?q=${encodeURIComponent(title)}&limit=500`);
  const hit = rows.find((r) => r.title === title);
  return hit ? hit.id : null;
}

// 1) 建分类
const catMap = new Map(); // name -> id
for (const c of data.categories) {
  const id = await ensureCategoryId(c.name);
  catMap.set(c.name, id);
  console.log(`  [category] ${c.name} → id=${id}`);
}

// 2) 处理提示词
let created = 0, updated = 0;
for (const p of data.prompts) {
  const catId = p.category_name ? catMap.get(p.category_name) : null;
  if (p._existing) {
    // 仅给已有提示词归类
    const id = await findPromptId(p.title);
    if (!id) { console.log(`  [prompt] ⚠ 未找到已有: ${p.title}`); continue; }
    await req(`/prompts/${id}`, { method: 'PUT', body: { category_id: catId } });
    updated++;
    console.log(`  [prompt] 归类 ${p.title} → ${p.category_name}`);
  } else {
    // 新建提示词（按 title 去重，已存在则更新 category）
    const existing = await findPromptId(p.title);
    const payload = {
      title: p.title,
      content: p.content,
      purpose: p.purpose || '',
      source: p.source || 'manual',
      tags: p.tags || [],
      variables: p.variables || [],
      category_id: catId,
    };
    if (existing) {
      await req(`/prompts/${existing}`, { method: 'PUT', body: payload });
      updated++;
      console.log(`  [prompt] 更新 ${p.title} → ${p.category_name}`);
    } else {
      await req('/prompts', { method: 'POST', body: payload });
      created++;
      console.log(`  [prompt] 新建 ${p.title} → ${p.category_name}`);
    }
  }
}

console.log(`\n完成：分类 ${data.categories.length} 个；提示词 新建 ${created} / 归类或更新 ${updated}`);
