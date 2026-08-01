import Router from '@koa/router';
import { sql } from 'kysely';
import { db, nowIso, parseTags, parseVariables } from '../db.js';

const router = new Router({ prefix: '/api/prompts' });

function shapeRow(r) {
  return {
    ...r,
    tags: parseTags(r.tags),
    variables: parseVariables(r.variables),
    usage_count: Number(r.usage_count),
  };
}

// 列表 / 搜索：支持 ?source=&q=&limit=
// 搜索排序：标题命中(100) > 内容命中(50) > 用途命中(20) > 标签命中(1)，再加 usage_count
router.get('/', async (ctx) => {
  const { source, q } = ctx.query;
  const limit = Math.min(Number(ctx.query.limit) || 200, 500);

  let query = db.selectFrom('prompts').select([
    'prompts.id', 'prompts.title', 'prompts.content', 'prompts.purpose',
    'prompts.tags', 'prompts.variables', 'prompts.source', 'prompts.usage_count',
    'prompts.created_at', 'prompts.updated_at',
  ]);

  if (source) query = query.where('prompts.source', '=', source);

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.where((eb) => eb.or([
      eb('prompts.title', 'like', like),
      eb('prompts.content', 'like', like),
      eb('prompts.purpose', 'like', like),
      eb('prompts.tags', 'like', like),
    ]));
    query = query.orderBy(
      sql`(case when prompts.title like ${like} then 100
                when prompts.content like ${like} then 50
                when prompts.purpose like ${like} then 20
                else 1 end) + prompts.usage_count`,
      'desc',
    );
  } else {
    query = query.orderBy('prompts.usage_count', 'desc')
      .orderBy('prompts.updated_at', 'desc');
  }

  const rows = await query.limit(limit).execute();
  ctx.body = rows.map(shapeRow);
});

// 详情
router.get('/:id', async (ctx) => {
  const row = await getById(Number(ctx.params.id));
  if (!row) ctx.throw(404, 'prompt not found');
  ctx.body = row;
});

// 创建
router.post('/', async (ctx) => {
  const b = ctx.request.body || {};
  const { title, content, purpose, tags, variables, source } = b;
  if (!title || !title.trim()) ctx.throw(400, 'title required');
  const now = nowIso();
  const r = await db.insertInto('prompts')
    .values({
      title: title.trim(),
      content: content || '',
      purpose: purpose || '',
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      variables: JSON.stringify(Array.isArray(variables) ? variables : []),
      source: source || 'manual',
      usage_count: 0,
      created_at: now,
      updated_at: now,
    })
    .executeTakeFirst();
  ctx.body = await getById(Number(r.insertId));
});

// 更新
router.put('/:id', async (ctx) => {
  const id = Number(ctx.params.id);
  const b = ctx.request.body || {};
  const patch = { updated_at: nowIso() };
  if (b.title !== undefined) patch.title = b.title;
  if (b.content !== undefined) patch.content = b.content;
  if (b.purpose !== undefined) patch.purpose = b.purpose;
  if (b.source !== undefined) patch.source = b.source;
  if (b.tags !== undefined) patch.tags = JSON.stringify(Array.isArray(b.tags) ? b.tags : []);
  if (b.variables !== undefined) patch.variables = JSON.stringify(Array.isArray(b.variables) ? b.variables : []);

  await db.updateTable('prompts').set(patch).where('id', '=', id).execute();
  ctx.body = await getById(id);
});

// 删除
router.delete('/:id', async (ctx) => {
  await db.deleteFrom('prompts').where('id', '=', Number(ctx.params.id)).execute();
  ctx.body = { ok: true };
});

// 记录一次使用：usage_count + 1，并写 prompt_usage_logs
router.post('/:id/use', async (ctx) => {
  const id = Number(ctx.params.id);
  const b = ctx.request.body || {};
  const now = nowIso();
  await db.updateTable('prompts')
    .set({ usage_count: sql`usage_count + 1`, updated_at: now })
    .where('id', '=', id)
    .execute();
  await db.insertInto('prompt_usage_logs')
    .values({ prompt_id: id, note: b.note || '', used_at: now })
    .execute();
  ctx.body = await getById(id);
});

// 某提示词的使用历史
router.get('/:id/history', async (ctx) => {
  const rows = await db.selectFrom('prompt_usage_logs')
    .select(['id', 'note', 'used_at'])
    .where('prompt_id', '=', Number(ctx.params.id))
    .orderBy('used_at', 'desc')
    .limit(50)
    .execute();
  ctx.body = rows;
});

async function getById(id) {
  const row = await db.selectFrom('prompts')
    .select([
      'id', 'title', 'content', 'purpose', 'tags', 'variables', 'source',
      'usage_count', 'created_at', 'updated_at',
    ])
    .where('id', '=', id)
    .executeTakeFirst();
  return row ? shapeRow(row) : null;
}

export default router;
