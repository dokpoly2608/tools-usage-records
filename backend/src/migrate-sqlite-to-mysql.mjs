// 一次性迁移：把本地 SQLite（backend/data/kb.sqlite）全量导入远程 MySQL。
// 用系统 sqlite3 CLI 读（无需 better-sqlite3 依赖），mysql2 写。
//
// 策略：先 TRUNCATE 清空目标表（含历史 seed/测试数据），再按依赖顺序导入并保留原 id，
// 外键关系（tool_id / entry_id / category_id / prompt_id）随 id 一并保留。
//
// 用法：npm run migrate  （需先配好 .env 的 DB_* 或同名环境变量）
import './env.js';
import mysql from 'mysql2/promise';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE = path.join(__dirname, '..', 'data', 'kb.sqlite');
// 按外键依赖顺序：被引用的表先导
const TABLES = ['tools', 'entries', 'usage_logs', 'prompt_categories', 'prompts', 'prompt_usage_logs'];

function readTable(table) {
  const out = execFileSync('sqlite3', [SQLITE, '-json', `SELECT * FROM ${table}`], { encoding: 'utf8' });
  const text = (out || '').trim();
  return text ? JSON.parse(text) : [];
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
});

const conn = await pool.getConnection();
try {
  // 清空目标表（外键检查临时关闭，便于无序 TRUNCATE）
  await conn.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of TABLES) await conn.query(`TRUNCATE TABLE \`${t}\``);

  let total = 0;
  for (const t of TABLES) {
    const rows = readTable(t);
    if (!rows.length) {
      console.log(`${t}: 0 (跳过)`);
      continue;
    }
    const cols = Object.keys(rows[0]);
    const placeholders = rows.map(() => `(${cols.map(() => '?').join(',')})`).join(', ');
    const values = rows.flatMap((r) => cols.map((c) => r[c]));
    await conn.query(
      `INSERT INTO \`${t}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES ${placeholders}`,
      values,
    );
    console.log(`${t}: ${rows.length} 行`);
    total += rows.length;
  }
  await conn.query('SET FOREIGN_KEY_CHECKS=1');
  console.log(`\n✅ 迁移完成，共 ${total} 行`);
} catch (e) {
  console.error('❌ 迁移失败:', e.message);
  process.exitCode = 1;
} finally {
  conn.release();
  await pool.end();
}
