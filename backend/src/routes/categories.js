import Router from '@koa/router';
import { db, nowIso } from '../db.js';

const router = new Router({ prefix: '/api/categories' });

// 提示词分类列表（附带条目数、总使用次数）
router.get('/', async (ctx) => {
  const cats = await db.selectFrom('prompt_categories')
    .select(['id', 'name', 'description', 'created_at', 'updated_at'])
    .orderBy('name')
    .execute();

  const agg = await db.selectFrom('prompts')
    .select([
      'category_id',
      (eb) => eb.fn.count('id').as('entry_count'),
      (eb) => eb.fn.sum('usage_count').as('usage'),
    ])
    .groupBy('category_id')
    .execute();
  const map = new Map(agg.map((r) => [r.category_id, r]));

  ctx.body = cats.map((c) => {
    const a = map.get(c.id);
    return {
      ...c,
      entry_count: a ? Number(a.entry_count) : 0,
      usage: a ? Number(a.usage) : 0,
    };
  });
});

// 新建分类
router.post('/', async (ctx) => {
  const { name, description } = ctx.request.body || {};
  if (!name || !name.trim()) ctx.throw(400, 'name required');
  const now = nowIso();
  const r = await db.insertInto('prompt_categories')
    .values({ name: name.trim(), description: description || '', created_at: now, updated_at: now })
    .executeTakeFirst();
  const cat = await db.selectFrom('prompt_categories').selectAll().where('id', '=', Number(r.insertId)).executeTakeFirst();
  ctx.body = { ...cat, entry_count: 0, usage: 0 };
});

// 更新分类
router.put('/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  const { name, description } = ctx.request.body || {};
  const patch = { updated_at: nowIso() };
  if (name !== undefined) patch.name = String(name).trim();
  if (description !== undefined) patch.description = description || '';
  await db.updateTable('prompt_categories').set(patch).where('id', '=', id).execute();
  ctx.body = await db.selectFrom('prompt_categories').selectAll().where('id', '=', id).executeTakeFirst();
});

// 删除分类（prompts.category_id 因 ON DELETE SET NULL 自动置空）
router.delete('/:id', async (ctx) => {
  await db.deleteFrom('prompt_categories').where('id', '=', Number(ctx.params.id)).execute();
  ctx.body = { ok: true };
});

export default router;
