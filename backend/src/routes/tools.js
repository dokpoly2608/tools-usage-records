import Router from '@koa/router';
import { db, nowIso } from '../db.js';

const router = new Router({ prefix: '/api/tools' });

// 工具列表（附带条目数、总使用次数）
router.get('/', async (ctx) => {
  const tools = await db.selectFrom('tools')
    .select(['id', 'name', 'description', 'created_at', 'updated_at'])
    .orderBy('name')
    .execute();

  const agg = await db.selectFrom('entries')
    .select([
      'tool_id',
      (eb) => eb.fn.count('id').as('entry_count'),
      (eb) => eb.fn.sum('usage_count').as('usage'),
    ])
    .groupBy('tool_id')
    .execute();
  const map = new Map(agg.map((r) => [r.tool_id, r]));

  ctx.body = tools.map((t) => {
    const a = map.get(t.id);
    return {
      ...t,
      entry_count: a ? Number(a.entry_count) : 0,
      usage: a ? Number(a.usage) : 0,
    };
  });
});

router.post('/', async (ctx) => {
  const { name, description } = ctx.request.body || {};
  if (!name || !name.trim()) ctx.throw(400, 'name required');
  const now = nowIso();
  const r = await db.insertInto('tools')
    .values({ name: name.trim(), description: description || '', created_at: now, updated_at: now })
    .executeTakeFirst();
  const tool = await db.selectFrom('tools').selectAll().where('id', '=', Number(r.insertId)).executeTakeFirst();
  ctx.body = { ...tool, entry_count: 0, usage: 0 };
});

router.delete('/:id', async (ctx) => {
  await db.deleteFrom('tools').where('id', '=', Number(ctx.params.id)).execute();
  ctx.body = { ok: true };
});

export default router;
