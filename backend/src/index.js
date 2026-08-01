import Koa from 'koa';
import cors from '@koa/cors';
import toolsRouter from './routes/tools.js';
import entriesRouter from './routes/entries.js';
import promptsRouter from './routes/prompts.js';
import categoriesRouter from './routes/categories.js';
import statsRouter from './routes/stats.js';
import { initSchema } from './db.js';

const app = new Koa();

// CORS（开发期前后端不同端口）
app.use(cors({ origin: '*' }));

// 轻量 JSON body 解析（避免 koa-bodyparser 与 koa3 的版本兼容问题）
app.use(async (ctx, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(ctx.method)) {
    const ct = ctx.request.type || '';
    if (ct.includes('json')) {
      const chunks = [];
      for await (const c of ctx.req) chunks.push(c);
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        ctx.request.body = text ? JSON.parse(text) : {};
      } catch {
        ctx.throw(400, 'Invalid JSON body');
      }
    }
  }
  await next();
});

// 统一错误处理
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message || 'Internal Server Error' };
    // eslint-disable-next-line no-console
    console.error('[error]', err.message);
  }
});

app.use(toolsRouter.routes()).use(toolsRouter.allowedMethods());
app.use(entriesRouter.routes()).use(entriesRouter.allowedMethods());
app.use(promptsRouter.routes()).use(promptsRouter.allowedMethods());
app.use(categoriesRouter.routes()).use(categoriesRouter.allowedMethods());
app.use(statsRouter.routes()).use(statsRouter.allowedMethods());

const PORT = process.env.PORT || 3000;

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`✅ cmd-kb backend on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to init schema:', err);
    process.exit(1);
  });
