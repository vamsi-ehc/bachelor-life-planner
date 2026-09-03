// Local, offline basic-auth provider: email + password accounts stored in
// the client-side SQLite database (see src/localdb/sqliteEngine.ts).
// Passwords are salted and hashed with PBKDF2 (src/auth/passwordHash.ts) —
// nothing is ever sent over the network.
import { useEffect, useState } from 'react';
import { getDatabase, schedulePersist } from '../localdb/sqliteEngine';
import { generateSalt, hashPassword, verifyPassword } from './passwordHash';
import { isLocalAuthProvider } from './authMode';

export interface LocalUser {
  uid: string;
  email: string | null;
}

export interface LocalAuthState {
  user: LocalUser | null;
  loading: boolean;
}

const SESSION_KEY = 'punch-in-local-session-uid';

type Listener = (user: LocalUser | null) => void;
let currentUser: LocalUser | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener(currentUser));
}

async function restoreSession(): Promise<void> {
  const uid = localStorage.getItem(SESSION_KEY);
  if (!uid) {
    currentUser = null;
    return;
  }
  const db = await getDatabase();
  const stmt = db.prepare('SELECT id, email FROM auth_users WHERE id = ?');
  stmt.bind([uid]);
  const row = stmt.step() ? (stmt.getAsObject() as { id: string; email: string }) : null;
  stmt.free();
  if (row) {
    currentUser = { uid: row.id, email: row.email };
  } else {
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
  }
}

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = restoreSession().then(() => {
      initialized = true;
      notify();
    });
  }
  return initPromise;
}

export function useLocalAuthState(): LocalAuthState {
  const [state, setState] = useState<LocalAuthState>({ user: currentUser, loading: !initialized });

  useEffect(() => {
    // Skip touching the local database entirely when this build uses the
    // Firebase provider, so tests and the online app never load sql.js.
    if (!isLocalAuthProvider) return;
    const listener: Listener = (user) => setState({ user, loading: false });
    listeners.add(listener);
    ensureInitialized();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return state;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function signUpLocal(email: string, password: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('Email is required');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const db = await getDatabase();
  const existing = db.exec('SELECT id FROM auth_users WHERE email = ?', [normalized]);
  if (existing.length > 0 && existing[0].values.length > 0) {
    throw new Error('An account with that email already exists');
  }

  const uid = crypto.randomUUID();
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  db.run('INSERT INTO auth_users (id, email, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [
    uid,
    normalized,
    salt,
    passwordHash,
    Date.now(),
  ]);
  schedulePersist(db);

  localStorage.setItem(SESSION_KEY, uid);
  currentUser = { uid, email: normalized };
  initialized = true;
  notify();
}

export async function signInLocal(email: string, password: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const db = await getDatabase();
  const stmt = db.prepare('SELECT id, email, salt, password_hash FROM auth_users WHERE email = ?');
  stmt.bind([normalized]);
  const row = stmt.step()
    ? (stmt.getAsObject() as { id: string; email: string; salt: string; password_hash: string })
    : null;
  stmt.free();

  if (!row || !(await verifyPassword(password, row.salt, row.password_hash))) {
    throw new Error('Invalid email or password');
  }

  localStorage.setItem(SESSION_KEY, row.id);
  currentUser = { uid: row.id, email: row.email };
  initialized = true;
  notify();
}

export async function signOutLocal(): Promise<void> {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  notify();
}
