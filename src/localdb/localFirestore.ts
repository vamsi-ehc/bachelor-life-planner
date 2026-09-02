// A minimal Firestore-API-compatible shim backed by the client-side SQLite
// database (see sqliteEngine.ts). It implements just the surface actually
// used by src/domains/**Api.ts (collection/doc/getDoc/getDocs/addDoc/setDoc/
// deleteDoc/query/where/orderBy/limit/serverTimestamp), so those files run
// unmodified against a local SQLite store instead of Firestore. Swapped in
// for the 'firebase/firestore' import via a mode-based Vite alias — see
// vite.config.ts — when building the offline (no-internet) version.
import { getDatabase, schedulePersist } from './sqliteEngine';

export interface LocalFirestoreHandle {
  readonly __local: true;
}
export type Firestore = LocalFirestoreHandle;

export function getFirestore(): LocalFirestoreHandle {
  return { __local: true };
}

export interface DocumentReference {
  __type: 'doc';
  path: string;
  id: string;
  collectionPath: string;
}

export interface CollectionReference {
  __type: 'collection';
  path: string;
}

type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=';

interface WhereConstraint {
  __type: 'where';
  field: string;
  op: WhereOp;
  value: unknown;
}
interface OrderByConstraint {
  __type: 'orderBy';
  field: string;
  direction: 'asc' | 'desc';
}
interface LimitConstraint {
  __type: 'limit';
  n: number;
}
type QueryConstraint = WhereConstraint | OrderByConstraint | LimitConstraint;

export interface Query {
  __type: 'query';
  path: string;
  constraints: QueryConstraint[];
}

export function collection(_db: unknown, ...segments: string[]): CollectionReference {
  return { __type: 'collection', path: segments.join('/') };
}

export function doc(_db: unknown, ...segments: string[]): DocumentReference {
  const id = segments[segments.length - 1];
  return { __type: 'doc', path: segments.join('/'), id, collectionPath: segments.slice(0, -1).join('/') };
}

const SERVER_TIMESTAMP_MARKER = '__local_server_timestamp__';

export function serverTimestamp(): unknown {
  return { [SERVER_TIMESTAMP_MARKER]: true };
}

function isServerTimestampMarker(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>)[SERVER_TIMESTAMP_MARKER] === true
  );
}

function resolveServerTimestamps(value: unknown): unknown {
  if (isServerTimestampMarker(value)) return Date.now();
  if (Array.isArray(value)) return value.map(resolveServerTimestamps);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = resolveServerTimestamps(v);
    }
    return out;
  }
  return value;
}

export function where(field: string, op: WhereOp, value: unknown): WhereConstraint {
  return { __type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderByConstraint {
  return { __type: 'orderBy', field, direction };
}

export function limit(n: number): LimitConstraint {
  return { __type: 'limit', n };
}

export function query(collRef: CollectionReference, ...constraints: QueryConstraint[]): Query {
  return { __type: 'query', path: collRef.path, constraints };
}

async function fetchCollectionRows(
  collectionPath: string
): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT path, data FROM documents WHERE collection_path = ?');
  stmt.bind([collectionPath]);
  const rows: { id: string; data: Record<string, unknown> }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { path: string; data: string };
    const id = row.path.slice(collectionPath.length + 1);
    rows.push({ id, data: JSON.parse(row.data) });
  }
  stmt.free();
  return rows;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function matchesWhere(data: Record<string, unknown>, c: WhereConstraint): boolean {
  const fieldValue = data[c.field];
  switch (c.op) {
    case '==':
      return fieldValue === c.value;
    case '!=':
      return fieldValue !== c.value;
    case '<':
      return compare(fieldValue, c.value) < 0;
    case '<=':
      return compare(fieldValue, c.value) <= 0;
    case '>':
      return compare(fieldValue, c.value) > 0;
    case '>=':
      return compare(fieldValue, c.value) >= 0;
    default:
      return true;
  }
}

function applyConstraints(
  rows: { id: string; data: Record<string, unknown> }[],
  constraints: QueryConstraint[]
): { id: string; data: Record<string, unknown> }[] {
  let result = rows;
  for (const c of constraints) {
    if (c.__type === 'where') result = result.filter((r) => matchesWhere(r.data, c));
  }
  for (const c of constraints) {
    if (c.__type === 'orderBy') {
      const { field, direction } = c;
      result = [...result].sort((a, b) => {
        const cmp = compare(a.data[field], b.data[field]);
        return direction === 'desc' ? -cmp : cmp;
      });
    }
  }
  for (const c of constraints) {
    if (c.__type === 'limit') result = result.slice(0, c.n);
  }
  return result;
}

export interface DocumentSnapshot {
  id: string;
  exists(): boolean;
  data(): Record<string, unknown> | undefined;
}

export interface QuerySnapshot {
  docs: DocumentSnapshot[];
}

export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  const db = await getDatabase();
  const stmt = db.prepare('SELECT data FROM documents WHERE path = ?');
  stmt.bind([ref.path]);
  const found = stmt.step();
  const data = found ? (JSON.parse((stmt.getAsObject() as { data: string }).data) as Record<string, unknown>) : undefined;
  stmt.free();
  return { id: ref.id, exists: () => found, data: () => data };
}

export async function getDocs(refOrQuery: CollectionReference | Query): Promise<QuerySnapshot> {
  const constraints = refOrQuery.__type === 'query' ? refOrQuery.constraints : [];
  const rows = await fetchCollectionRows(refOrQuery.path);
  const filtered = applyConstraints(rows, constraints);
  return {
    docs: filtered.map(({ id, data }) => ({ id, exists: () => true, data: () => data })),
  };
}

async function writeDoc(ref: DocumentReference, data: Record<string, unknown>, merge: boolean): Promise<void> {
  const db = await getDatabase();
  let finalData = resolveServerTimestamps(data) as Record<string, unknown>;
  if (merge) {
    const stmt = db.prepare('SELECT data FROM documents WHERE path = ?');
    stmt.bind([ref.path]);
    if (stmt.step()) {
      const existing = JSON.parse((stmt.getAsObject() as { data: string }).data) as Record<string, unknown>;
      finalData = { ...existing, ...finalData };
    }
    stmt.free();
  }
  db.run('INSERT OR REPLACE INTO documents (path, collection_path, data, updated_at) VALUES (?, ?, ?, ?)', [
    ref.path,
    ref.collectionPath,
    JSON.stringify(finalData),
    Date.now(),
  ]);
  schedulePersist(db);
}

export async function addDoc(collRef: CollectionReference, data: Record<string, unknown>): Promise<DocumentReference> {
  const id = crypto.randomUUID();
  const ref: DocumentReference = { __type: 'doc', path: `${collRef.path}/${id}`, id, collectionPath: collRef.path };
  await writeDoc(ref, data, false);
  return ref;
}

export async function setDoc(
  ref: DocumentReference,
  data: Record<string, unknown>,
  options?: { merge?: boolean }
): Promise<void> {
  await writeDoc(ref, data, options?.merge ?? false);
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  const db = await getDatabase();
  db.run('DELETE FROM documents WHERE path = ?', [ref.path]);
  schedulePersist(db);
}
