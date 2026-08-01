import Router from '@koa/router';
import { db } from '../db.js';

const router = new Router({ prefix: '/api/stats' });

// 总览：总条目数、总工具数、总使用次数
router.get('/', async (ctx) => {
  const entries = await db.selectFrom('entries')
    .select([(eb) => eb.fn.count('id').as('count'), (eb) => eb.fn.sum('usage_count').as('usage')])
    .executeTakeFirst();
  const tools = await db.selectFrom('tools')
    .select([(eb) => eb.fn.count('id').as('count')])
    .executeTakeFirst();

  ctx.body = {
    entries: Number(entries?.count || 0),
    tools: Number(tools?.count || 0),
    usage: Number(entries?.usage || 0),
  };
});

// 高频命令 Top N
router.get('/top', async (ctx) => {
  const limit = Math.min(Number(ctx.query.limit) || 15, 100);
  const rows = await db.selectFrom('entries')
    .leftJoin('tools', 'tools.id', 'entries.tool_id')
    .select([
      'entries.id', 'entries.title', 'entries.command', 'entries.purpose',
      'entries.usage_count', 'tools.name as tool_name',
    ])
    .where('entries.usage_count', '>', 0)
    .orderBy('entries.usage_count', 'desc')
    .orderBy('entries.updated_at', 'desc')
    .limit(limit)
    .execute();
  ctx.body = rows.map((r) => ({ ...r, usage_count: Number(r.usage_count) }));
});

// 最近使用记录（跨条目）
router.get('/recent', async (ctx) => {
  const limit = Math.min(Number(ctx.query.limit) || 30, 100);
  const rows = await db.selectFrom('usage_logs')
    .innerJoin('entries', 'entries.id', 'usage_logs.entry_id')
    .leftJoin('tools', 'tools.id', 'entries.tool_id')
    .select([
      'usage_logs.id', 'usage_logs.note', 'usage_logs.used_at',
      'entries.id as entry_id', 'entries.title', 'entries.command',
      'tools.name as tool_name',
    ])
    .orderBy('usage_logs.used_at', 'desc')
    .limit(limit)
    .execute();
  ctx.body = rows;
});

// 按工具汇总
router.get('/by-tool', async (ctx) => {
  const rows = await db.selectFrom('entries')
    .innerJoin('tools', 'tools.id', 'entries.tool_id')
    .select([
      'tools.id', 'tools.name',
      (eb) => eb.fn.count('entries.id').as('entries'),
      (eb) => eb.fn.sum('entries.usage_count').as('usage'),
    ])
    .groupBy('tools.id')
    .orderBy('usage', 'desc')
    .execute();
  ctx.body = rows.map((r) => ({ ...r, entries: Number(r.entries), usage: Number(r.usage) }));
});

export default router;
