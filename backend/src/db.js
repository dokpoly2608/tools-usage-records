import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'kb.sqlite');

// better-sqlite3 实例：开启 WAL + 外键
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// 注：SqliteDialect 的构造参数在 0.27.x 及之前为 { database }（传实例）；
// 0.28 之后若 API 变化，这里是最可能需要调整的点。
const dialect = new SqliteDialect({ database: sqlite });

export const db = new Kysely({ dialect });

export async function initSchema() {
  // tools: 工具（git / jq / claude …）
  await db.schema.createTable('tools').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull().unique())
    .addColumn('description', 'text', (c) => c.defaultTo(''))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .execute();

  // entries: 命令用法知识条目
  await db.schema.createTable('entries').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('tool_id', 'integer', (c) =>
      c.notNull().references('tools.id').onDelete('cascade'))
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('command', 'text', (c) => c.defaultTo(''))
    .addColumn('purpose', 'text', (c) => c.defaultTo(''))
    .addColumn('content', 'text', (c) => c.defaultTo(''))
    .addColumn('tags', 'text', (c) => c.defaultTo('[]'))
    .addColumn('usage_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .execute();

  // usage_logs: 每次使用记录（历史明细）
  await db.schema.createTable('usage_logs').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('entry_id', 'integer', (c) =>
      c.notNull().references('entries.id').onDelete('cascade'))
    .addColumn('note', 'text', (c) => c.defaultTo(''))
    .addColumn('used_at', 'text', (c) => c.notNull())
    .execute();

  // 常用查询索引
  await db.schema.createIndex('idx_entries_tool').ifNotExists()
    .on('entries').column('tool_id').execute();
  await db.schema.createIndex('idx_entries_usage').ifNotExists()
    .on('entries').column('usage_count').execute();
  await db.schema.createIndex('idx_usage_entry').ifNotExists()
    .on('usage_logs').column('entry_id').execute();
}

// tags 以 JSON 数组字符串存储，读取时解析
export function parseTags(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function nowIso() {
  return new Date().toISOString();
}
