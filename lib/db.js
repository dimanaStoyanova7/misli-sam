import { neon } from "@neondatabase/serverless";

// One tiny query helper: query(text, params) -> rows.
// In production this talks to Neon. For local tests, DATABASE_URL=pglite:memory
// runs an in-memory Postgres instead.

let runner = null;
let schemaReady = null;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
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
