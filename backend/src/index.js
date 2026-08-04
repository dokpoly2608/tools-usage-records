import './env.js'; // 注入 .env（db.js 也各自 import，保证连接参数可用）
import Koa from 'koa';
import cors from '@koa/cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import toolsRouter from './routes/tools.js';
import entriesRouter from './routes/entries.js';
import promptsRouter from './routes/prompts.js';
import categoriesRouter from './routes/categories.js';
import statsRouter from './routes/stats.js';
import { initSchema } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// ---- 生产：同端口托管前端静态文件（前端用 hash 路由，只需 / 与 /assets/*） ----
// 注册在路由之后：先让 /api/* 被路由处理；未命中的 GET（404）再回落到静态文件 / SPA。
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};
app.use(async (ctx, next) => {
  await next();
  // 仅处理未被路由命中（仍为 404 且无 body）的 GET 请求
  if (ctx.method !== 'GET' || ctx.status !== 404 || ctx.body) return;
  if (ctx.path.startsWith('/api')) return;
  // 路径穿越防护：解析后必须仍在 distDir 之内
  const rel = decodeURIComponent(ctx.path.slice(1));
  const fp = path.join(distDir, rel);
  if (fp !== distDir && !fp.startsWith(distDir + path.sep)) return;
  try {
    if (fs.statSync(fp).isFile()) {
      ctx.status = 200;
      ctx.type = MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream';
      ctx.body = fs.createReadStream(fp);
      return;
    }
  } catch {
    /* 不是具体文件，走 SPA fallback */
  }
  // SPA fallback：返回 index.html
  try {
    ctx.status = 200;
    ctx.type = 'text/html; charset=utf-8';
    ctx.body = fs.createReadStream(path.join(distDir, 'index.html'));
  } catch {
    /* 无前端构建产物时保持 404 */
  }
});

const PORT = Number(process.env.BACKEND_PORT) || 3000;

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
