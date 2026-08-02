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
    .addColumn('variables', 'text', (c) => c.defaultTo('[]')) // 命令模板变量 JSON
    .addColumn('usage_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .execute();

  // 旧库迁移：entries 增 variables 列（已存在则跳过）
  await ensureColumn('entries', 'variables', 'text NOT NULL DEFAULT "[]"');

  // usage_logs: 命令每次使用记录（历史明细）
  await db.schema.createTable('usage_logs').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('entry_id', 'integer', (c) =>
      c.notNull().references('entries.id').onDelete('cascade'))
    .addColumn('note', 'text', (c) => c.defaultTo(''))
    .addColumn('used_at', 'text', (c) => c.notNull())
    .execute();

  // prompt_categories: 提示词分类（按用途/场景，独立表）—— 先于 prompts 建立以供外键引用
  await db.schema.createTable('prompt_categories').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'text', (c) => c.notNull().unique())
    .addColumn('description', 'text', (c) => c.defaultTo(''))
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .execute();

  // prompts: AI 提示词知识条目（独立于 entries/tools）
  await db.schema.createTable('prompts').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('title', 'text', (c) => c.notNull())
    .addColumn('content', 'text', (c) => c.defaultTo('')) // 提示词原文，可含 {{var}}
    .addColumn('purpose', 'text', (c) => c.defaultTo(''))
    .addColumn('tags', 'text', (c) => c.defaultTo('[]'))
    .addColumn('variables', 'text', (c) => c.defaultTo('[]')) // 模板变量 JSON
    .addColumn('source', 'text', (c) => c.defaultTo('manual')) // claude-code / codex / manual
    .addColumn('category_id', 'integer', (c) => // 可空，归类用
      c.references('prompt_categories.id').onDelete('set null'))
    .addColumn('usage_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('created_at', 'text', (c) => c.notNull())
    .addColumn('updated_at', 'text', (c) => c.notNull())
    .execute();

  // 旧库迁移：prompts 增 category_id 列（已存在则跳过）
  await ensureColumn('prompts', 'category_id', 'integer REFERENCES prompt_categories(id) ON DELETE SET NULL');

  // 旧库迁移：entries/prompts 增 copy_count / visit_count
  await ensureColumn('entries', 'copy_count', 'integer NOT NULL DEFAULT 0');
  await ensureColumn('entries', 'visit_count', 'integer NOT NULL DEFAULT 0');
  await ensureColumn('prompts', 'copy_count', 'integer NOT NULL DEFAULT 0');
  await ensureColumn('prompts', 'visit_count', 'integer NOT NULL DEFAULT 0');

  // prompt_usage_logs: 提示词每次使用记录
  await db.schema.createTable('prompt_usage_logs').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('prompt_id', 'integer', (c) =>
      c.notNull().references('prompts.id').onDelete('cascade'))
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
  await db.schema.createIndex('idx_prompts_usage').ifNotExists()
    .on('prompts').column('usage_count').execute();
  await db.schema.createIndex('idx_prompts_category').ifNotExists()
    .on('prompts').column('category_id').execute();
  await db.schema.createIndex('idx_prompt_usage_entry').ifNotExists()
    .on('prompt_usage_logs').column('prompt_id').execute();
}

// 安全加列：列已存在则跳过（SQLite ALTER TABLE 无 IF NOT EXISTS）
async function ensureColumn(table, column, definition) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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

// variables: [{name, desc, default}]，同样以 JSON 字符串存储
export function parseVariables(raw) {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x === 'object' && x.name)
      .map((x) => ({ name: String(x.name), desc: x.desc || '', default: x.default ?? '' }));
  } catch {
    return [];
  }
}

export function nowIso() {
  return new Date().toISOString();
}
