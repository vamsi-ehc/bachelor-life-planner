import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';

vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({
  default: require.resolve('sql.js/dist/sql-wasm.wasm'),
}));

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from './localFirestore';

describe('localFirestore', () => {
  it('round-trips a document via doc()/setDoc()/getDoc()', async () => {
    const db = getFirestore();
    const ref = doc(db, 'users', 'u1', 'chores', 'c1');
    await setDoc(ref, { name: 'Dishes', points: 3 });

    const snap = await getDoc(ref);
    expect(snap.exists()).toBe(true);
    expect(snap.id).toBe('c1');
    expect(snap.data()).toEqual({ name: 'Dishes', points: 3 });
  });

  it('reports a missing document as not existing', async () => {
    const db = getFirestore();
    const snap = await getDoc(doc(db, 'users', 'u1', 'chores', 'missing'));
    expect(snap.exists()).toBe(false);
    expect(snap.data()).toBeUndefined();
  });

  it('merges fields with setDoc({ merge: true }) instead of overwriting', async () => {
    const db = getFirestore();
    const ref = doc(db, 'users', 'u1', 'completions', '2026-01-01');
    await setDoc(ref, { date: '2026-01-01', workout: true });
    await setDoc(ref, { learning: true }, { merge: true });

    const snap = await getDoc(ref);
    expect(snap.data()).toEqual({ date: '2026-01-01', workout: true, learning: true });
  });

  it('lists documents in a collection and assigns ids via addDoc', async () => {
    const db = getFirestore();
    const coll = collection(db, 'users', 'u2', 'transactions');
    const ref = await addDoc(coll, { date: '2026-02-01', amount: 10, category: 'food', type: 'expense' });
    expect(ref.id).toBeTruthy();

    const snap = await getDocs(coll);
    expect(snap.docs).toHaveLength(1);
    expect(snap.docs[0].id).toBe(ref.id);
    expect(snap.docs[0].data()).toMatchObject({ amount: 10, category: 'food' });
  });

  it('deletes a document', async () => {
    const db = getFirestore();
    const ref = doc(db, 'users', 'u3', 'goals', 'g1');
    await setDoc(ref, { name: 'Read more' });
    await deleteDoc(ref);

    const snap = await getDoc(ref);
    expect(snap.exists()).toBe(false);
  });

  it('applies where/orderBy/limit query constraints', async () => {
    const db = getFirestore();
    const coll = collection(db, 'users', 'u4', 'transactions');
    await addDoc(coll, { date: '2026-03-01', amount: 5 });
    await addDoc(coll, { date: '2026-03-15', amount: 20 });
    await addDoc(coll, { date: '2026-02-28', amount: 99 });

    const q = query(coll, where('date', '>=', '2026-03-01'), orderBy('date', 'desc'), limit(1));
    const snap = await getDocs(q);

    expect(snap.docs).toHaveLength(1);
    expect(snap.docs[0].data()).toMatchObject({ date: '2026-03-15' });
  });

  it('keeps documents in different collections isolated', async () => {
    const db = getFirestore();
    await setDoc(doc(db, 'users', 'u5', 'chores', 'c1'), { name: 'A' });
    await setDoc(doc(db, 'users', 'u6', 'chores', 'c1'), { name: 'B' });

    const u5Snap = await getDocs(collection(db, 'users', 'u5', 'chores'));
    expect(u5Snap.docs.map((d) => d.data())).toEqual([{ name: 'A' }]);
  });
});
