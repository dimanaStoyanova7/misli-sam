import { neon } from "@neondatabase/serverless";

// One tiny query helper: query(text, params) -> rows.
// In production this talks to Neon. For local tests, DATABASE_URL=pglite:memory
// runs an in-memory Postgres instead.

let runner = null;
let schemaReady = null;

// Vercel's Neon integration may add the connection string under a custom prefix
// (e.g. STORAGE_DATABASE_URL), so accept any variable ending in DATABASE_URL / POSTGRES_URL.
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.POSTGRES_URL) return process.env.POSTGRES_URL;
  const key = Object.keys(process.env).find(
    (k) => /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(k) && /^postgres(ql)?:\/\//.test(process.env[k] || "")
  );
  return key ? process.env[key] : "";
}

export function hasDatabase() {
  return Boolean(databaseUrl());
}

async function getRunner() {
  if (runner) return runner;
  const url = databaseUrl();
  if (!url) throw new Error("NO_DB");
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import(/* webpackIgnore: true */ "@electric-sql/pglite");
    const db = new PGlite();
    runner = async (text, params) => (await db.query(text, params)).rows;
  } else {
    const sql = neon(url);
    runner = (text, params) => sql.query(text, params);
  }
  return runner;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS schools (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     code TEXT NOT NULL UNIQUE,
     active BOOLEAN NOT NULL DEFAULT TRUE,
     monthly_limit INTEGER,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
     teacher_name TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     expires_at TIMESTAMPTZ NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS usage (
     id SERIAL PRIMARY KEY,
     school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
     teacher_name TEXT,
     kind TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS usage_school_time ON usage (school_id, created_at)`,
  // Personal teacher profiles (name + PIN within a school)
  `CREATE TABLE IF NOT EXISTS teachers (
     id SERIAL PRIMARY KEY,
     school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     name_key TEXT NOT NULL,
     pin_hash TEXT,
     failed_attempts INTEGER NOT NULL DEFAULT 0,
     locked_until TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_login TIMESTAMPTZ,
     UNIQUE (school_id, name_key)
   )`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE`,
  `ALTER TABLE usage ADD COLUMN IF NOT EXISTS teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL`,
  // Saved assignments ("Моите задачи")
  `CREATE TABLE IF NOT EXISTS assignments (
     id SERIAL PRIMARY KEY,
     teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
     school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     context JSONB NOT NULL DEFAULT '{}'::jsonb,
     analysis JSONB NOT NULL,
     selected JSONB,
     final JSONB,
     score_before INTEGER,
     score_after INTEGER,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS assignments_teacher_time ON assignments (teacher_id, updated_at DESC)`,
];

// Tables are created automatically on first use, so there's no manual setup.
async function ensureSchema(run) {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const stmt of SCHEMA) await run(stmt, []);
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

export async function query(text, params = []) {
  const run = await getRunner();
  await ensureSchema(run);
  return run(text, params);
}
