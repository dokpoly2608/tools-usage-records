import Router from '@koa/router';
import { sql } from 'kysely';
import { db, nowIso, parseTags, parseVariables } from '../db.js';

const router = new Router({ prefix: '/api/entries' });

function shapeRow(r) {
  return {
    ...r,
    tags: parseTags(r.tags),
    variables: parseVariables(r.variables),
    usage_count: Number(r.usage_count),
    copy_count: Number(r.copy_count || 0),
    visit_count: Number(r.visit_count || 0),
  };
}

// 列表 / 搜索：支持 ?tool=&q=&limit=
// 搜索排序：标题命中(100) > 命令命中(50) > 用途命中(20) > 内容/标签命中(1)，再加 usage_count
router.get('/', async (ctx) => {
  const { tool, q } = ctx.query;
  const limit = Math.min(Number(ctx.query.limit) || 200, 500);

  let query = db.selectFrom('entries')
    .leftJoin('tools', 'tools.id', 'entries.tool_id')
    .select([
      'entries.id', 'entries.tool_id', 'entries.title', 'entries.command',
      'entries.purpose', 'entries.content', 'entries.tags', 'entries.variables',
      'entries.usage_count', 'entries.copy_count', 'entries.visit_count',
      'entries.created_at', 'entries.updated_at',
      'tools.name as tool_name',
    ]);

  if (tool) query = query.where('entries.tool_id', '=', Number(tool));

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.where((eb) => eb.or([
      eb('entries.title', 'like', like),
      eb('entries.command', 'like', like),
      eb('entries.purpose', 'like', like),
      eb('entries.content', 'like', like),
      eb('entries.tags', 'like', like),
    ]));
    query = query.orderBy(
      sql`(case when entries.title like ${like} then 100
                when entries.command like ${like} then 50
                when entries.purpose like ${like} then 20
                else 1 end) + entries.usage_count`,
      'desc',
    );
  } else {
    query = query.orderBy('entries.usage_count', 'desc')
      .orderBy('entries.updated_at', 'desc');
  }

  const rows = await query.limit(limit).execute();
  ctx.body = rows.map(shapeRow);
});

// 详情
router.get('/:id', async (ctx) => {
  const row = await db.selectFrom('entries')
    .leftJoin('tools', 'tools.id', 'entries.tool_id')
    .select([
      'entries.id', 'entries.tool_id', 'entries.title', 'entries.command',
      'entries.purpose', 'entries.content', 'entries.tags', 'entries.variables',
      'entries.usage_count', 'entries.copy_count', 'entries.visit_count',
      'entries.created_at', 'entries.updated_at',
      'tools.name as tool_name',
    ])
    .where('entries.id', '=', Number(ctx.params.id))
    .executeTakeFirst();
  if (!row) ctx.throw(404, 'entry not found');
  ctx.body = shapeRow(row);
});

// 创建（支持传 tool_id 或 tool_name；tool_name 不存在则自动创建）
router.post('/', async (ctx) => {
  const b = ctx.request.body || {};
  const { tool_id, tool_name, title, command, purpose, content, tags, variables } = b;
  if (!title || !title.trim()) ctx.throw(400, 'title required');

  let tid = tool_id ? Number(tool_id) : null;
  if (!tid && tool_name && tool_name.trim()) {
    const name = tool_name.trim();
    const existing = await db.selectFrom('tools').select('id').where('name', '=', name).executeTakeFirst();
    if (existing) {
      tid = existing.id;
    } else {
      const now = nowIso();
      const r = await db.insertInto('tools')
        .values({ name, description: '', created_at: now, updated_at: now })
        .executeTakeFirst();
      tid = Number(r.insertId);
    }
  }
  if (!tid) ctx.throw(400, 'tool_id or tool_name required');

  const now = nowIso();
  const r = await db.insertInto('entries')
    .values({
      tool_id: tid,
      title: title.trim(),
      command: command || '',
      purpose: purpose || '',
      content: content || '',
      tags: JSON.stringify(Array.isArray(tags) ? tags : []),
      variables: JSON.stringify(Array.isArray(variables) ? variables : []),
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
  if (b.command !== undefined) patch.command = b.command;
  if (b.purpose !== undefined) patch.purpose = b.purpose;
  if (b.content !== undefined) patch.content = b.content;
  if (b.tags !== undefined) patch.tags = JSON.stringify(Array.isArray(b.tags) ? b.tags : []);
  if (b.variables !== undefined) patch.variables = JSON.stringify(Array.isArray(b.variables) ? b.variables : []);
  if (b.tool_id !== undefined) patch.tool_id = Number(b.tool_id);

  await db.updateTable('entries').set(patch).where('id', '=', id).execute();
  ctx.body = await getById(id);
});

// 删除
router.delete('/:id', async (ctx) => {
  await db.deleteFrom('entries').where('id', '=', Number(ctx.params.id)).execute();
  ctx.body = { ok: true };
});

// 记录一次使用：usage_count + 1，并写 usage_logs
router.post('/:id/use', async (ctx) => {
  const id = Number(ctx.params.id);
  const b = ctx.request.body || {};
  const now = nowIso();
  await db.updateTable('entries')
    .set({ usage_count: sql`usage_count + 1`, updated_at: now })
    .where('id', '=', id)
    .execute();
  await db.insertInto('usage_logs')
    .values({ entry_id: id, note: b.note || '', used_at: now })
    .execute();
  ctx.body = await getById(id);
});

// 记录一次复制
router.post('/:id/copy', async (ctx) => {
  const id = Number(ctx.params.id);
  const now = nowIso();
  await db.updateTable('entries')
    .set({ copy_count: sql`copy_count + 1`, updated_at: now })
    .where('id', '=', id)
    .execute();
  ctx.body = await getById(id);
});

// 记录一次详情页访问
router.post('/:id/visit', async (ctx) => {
  const id = Number(ctx.params.id);
  const now = nowIso();
  await db.updateTable('entries')
    .set({ visit_count: sql`visit_count + 1`, updated_at: now })
    .where('id', '=', id)
    .execute();
  ctx.body = await getById(id);
});

// 某条目的使用历史
router.get('/:id/history', async (ctx) => {
  const rows = await db.selectFrom('usage_logs')
    .select(['id', 'note', 'used_at'])
    .where('entry_id', '=', Number(ctx.params.id))
    .orderBy('used_at', 'desc')
    .limit(50)
    .execute();
  ctx.body = rows;
});

async function getById(id) {
  const row = await db.selectFrom('entries')
    .leftJoin('tools', 'tools.id', 'entries.tool_id')
    .select([
      'entries.id', 'entries.tool_id', 'entries.title', 'entries.command',
      'entries.purpose', 'entries.content', 'entries.tags', 'entries.variables',
      'entries.usage_count', 'entries.copy_count', 'entries.visit_count',
      'entries.created_at', 'entries.updated_at',
      'tools.name as tool_name',
    ])
    .where('entries.id', '=', id)
    .executeTakeFirst();
  return row ? shapeRow(row) : null;
}

export default router;
