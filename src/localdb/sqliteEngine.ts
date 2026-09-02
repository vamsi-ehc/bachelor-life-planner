// Client-side SQLite engine backing both local basic auth and the offline
// data store. Runs entirely in the browser via sql.js (SQLite compiled to
// WebAssembly) and persists to IndexedDB so state survives reloads. No
// server, no network request is ever made by this module.
import initSqlJs, { Database } from 'sql.js';
// The `?url` suffix tells Vite to emit the wasm file as a static asset and
// give us its final built URL, so it is served from the same origin as the
// app instead of being fetched from a CDN.
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { idbGet, idbSet } from './idbPersistence';

const PERSIST_KEY = 'sqlite-db';
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS documents (
    path TEXT PRIMARY KEY,
    collection_path TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection_path);

  CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`;

let dbPromise: Promise<Database> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function loadDatabase(): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const existing = await idbGet(PERSIST_KEY);
  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  db.run(SCHEMA);
  return db;
}

export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = loadDatabase();
  }
  return dbPromise;
}

// Writes are batched onto a short debounce so a burst of mutations (e.g.
// saving several fields in a row) only serializes the database once.
export function schedulePersist(db: Database): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    idbSet(PERSIST_KEY, db.export()).catch((err) => {
      console.error('Failed to persist local database', err);
    });
  }, 150);
}

export async function flushPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const db = await getDatabase();
  await idbSet(PERSIST_KEY, db.export());
}
