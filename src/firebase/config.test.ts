import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'mock-app' })),
}));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ name: 'mock-auth' })),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({ name: 'mock-db' })),
}));

describe('firebase config', () => {
  it('exports an initialized app, auth, and db', async () => {
    const { app, auth, db } = await import('./config');
    expect(app).toEqual({ name: 'mock-app' });
    expect(auth).toEqual({ name: 'mock-auth' });
    expect(db).toEqual({ name: 'mock-db' });
  });
});
