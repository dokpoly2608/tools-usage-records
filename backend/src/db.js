import './env.js'; // 必须最先：注入 .env，确保下方 process.env 可读
import mysql from 'mysql2';
import { Kysely, MysqlDialect, sql } from 'kysely';

// 连接参数全部走环境变量：本地读 .env，远程部署用 `DB_HOST=... node ...` 注入。
// index.js 启动时已把根目录 .env 注入 process.env，故此处直接读取。
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tools_kb',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE) || 10,
  charset: 'utf8mb4',
  // 连接超时：远程库不可达时快速失败，便于排错
  connectTimeout: 10_000,
});

const dialect = new MysqlDialect({ pool });

export const db = new Kysely({ dialect });

export async function initSchema() {
  // tools: 工具（git / jq / claude …）
  await db.schema.createTable('tools').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(100)', (c) => c.notNull().unique())
    .addColumn('description', 'varchar(500)', (c) => c.defaultTo(''))
    .addColumn('created_at', 'varchar(30)', (c) => c.notNull())
    .addColumn('updated_at', 'varchar(30)', (c) => c.notNull())
    .execute();

  // entries: 命令用法知识条目
  await db.schema.createTable('entries').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('tool_id', 'integer', (c) =>
      c.notNull().references('tools.id').onDelete('cascade'))
    .addColumn('title', 'varchar(500)', (c) => c.notNull())
    .addColumn('command', 'varchar(2000)', (c) => c.defaultTo(''))
    .addColumn('purpose', 'varchar(1000)', (c) => c.defaultTo(''))
    .addColumn('content', 'text') // markdown 正文，可能较长，用 text（MySQL 5.7 text 无 default）
    .addColumn('tags', 'varchar(1000)', (c) => c.defaultTo('[]'))
    .addColumn('variables', 'varchar(2000)', (c) => c.defaultTo('[]')) // 命令模板变量 JSON
    .addColumn('usage_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('copy_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('visit_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('created_at', 'varchar(30)', (c) => c.notNull())
    .addColumn('updated_at', 'varchar(30)', (c) => c.notNull())
    .execute();

  // usage_logs: 命令每次使用记录（历史明细）
  await db.schema.createTable('usage_logs').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('entry_id', 'integer', (c) =>
      c.notNull().references('entries.id').onDelete('cascade'))
    .addColumn('note', 'varchar(2000)', (c) => c.defaultTo(''))
    .addColumn('used_at', 'varchar(30)', (c) => c.notNull())
    .execute();

  // prompt_categories: 提示词分类（按用途/场景，独立表）—— 先于 prompts 建立以供外键引用
  await db.schema.createTable('prompt_categories').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(100)', (c) => c.notNull().unique())
    .addColumn('description', 'varchar(500)', (c) => c.defaultTo(''))
    .addColumn('created_at', 'varchar(30)', (c) => c.notNull())
    .addColumn('updated_at', 'varchar(30)', (c) => c.notNull())
    .execute();

  // prompts: AI 提示词知识条目（独立于 entries/tools）
  await db.schema.createTable('prompts').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('title', 'varchar(500)', (c) => c.notNull())
    .addColumn('content', 'text') // 提示词原文，可含 {{var}}
    .addColumn('purpose', 'varchar(1000)', (c) => c.defaultTo(''))
    .addColumn('tags', 'varchar(1000)', (c) => c.defaultTo('[]'))
    .addColumn('variables', 'varchar(2000)', (c) => c.defaultTo('[]')) // 模板变量 JSON
    .addColumn('source', 'varchar(50)', (c) => c.defaultTo('manual')) // claude-code / codex / manual
    .addColumn('category_id', 'integer', (c) => // 可空，归类用
      c.references('prompt_categories.id').onDelete('set null'))
    .addColumn('usage_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('copy_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('visit_count', 'integer', (c) => c.defaultTo(0).notNull())
    .addColumn('created_at', 'varchar(30)', (c) => c.notNull())
    .addColumn('updated_at', 'varchar(30)', (c) => c.notNull())
    .execute();

  // prompt_usage_logs: 提示词每次使用记录
  await db.schema.createTable('prompt_usage_logs').ifNotExists()
    .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
    .addColumn('prompt_id', 'integer', (c) =>
      c.notNull().references('prompts.id').onDelete('cascade'))
    .addColumn('note', 'varchar(2000)', (c) => c.defaultTo(''))
    .addColumn('used_at', 'varchar(30)', (c) => c.notNull())
    .execute();

  // 常用查询索引（MySQL 不支持 CREATE INDEX IF NOT EXISTS，先查 information_schema）
  await ensureIndex('idx_entries_tool', 'entries', 'tool_id');
  await ensureIndex('idx_entries_usage', 'entries', 'usage_count');
  await ensureIndex('idx_usage_entry', 'usage_logs', 'entry_id');
  await ensureIndex('idx_prompts_usage', 'prompts', 'usage_count');
  await ensureIndex('idx_prompts_category', 'prompts', 'category_id');
  await ensureIndex('idx_prompt_usage_entry', 'prompt_usage_logs', 'prompt_id');
}

// 安全建索引：MySQL 不支持 IF NOT EXISTS，通过 information_schema 判断后建。
async function ensureIndex(name, table, column) {
  const { rows } = await sql`
    SELECT 1 FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = ${table} AND index_name = ${name}
    LIMIT 1
  `.execute(db);
  if (rows.length) return;
  // name/table/column 为代码内常量，非外部输入，直接拼接标识符
  await sql.raw(`CREATE INDEX ${name} ON ${table} (${column})`).execute(db);
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
