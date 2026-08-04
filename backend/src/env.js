// 轻量加载根目录 .env（无需 dotenv 依赖）。已存在的同名环境变量优先。
//
// 单独成模块的原因：ESM 的 import 是静态提升的——若把加载逻辑放在 index.js
// 里，db.js 的模块体（创建连接池读取 process.env）会先于这段代码执行，导致
// 连接参数读不到。任何依赖环境变量的模块（如 db.js）只要在本模块之后 import，
// 或自身首行 `import './env.js'`，即可保证 process.env 已注入。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const val = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
