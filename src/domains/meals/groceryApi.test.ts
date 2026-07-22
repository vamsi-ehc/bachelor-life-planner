import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCollection = vi.fn((..._args: unknown[]) => ({}));
const mockDoc = vi.fn((..._args: unknown[]) => ({}));
const mockGetDocs = vi.fn((..._args: unknown[]) => ({}));
const mockAddDoc = vi.fn((..._args: unknown[]) => ({}));
const mockSetDoc = vi.fn((..._args: unknown[]) => ({}));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../../firebase/config', () => ({ db: {} }));

import { listGroceryItems, addGroceryItem, setGroceryItemChecked } from './groceryApi';

describe('groceryApi', () => {
  beforeEach(() => {
    mockGetDocs.mockReset();
    mockAddDoc.mockReset();
    mockSetDoc.mockReset();
  });

  it('listGroceryItems maps docs to GroceryItem objects', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'g1', data: () => ({ name: 'Milk', checked: false }) }],
    });
    const result = await listGroceryItems('user1');
    expect(result).toEqual([{ id: 'g1', name: 'Milk', checked: false }]);
  });

  it('addGroceryItem writes an unchecked item and returns its id', async () => {
    mockAddDoc.mockResolvedValue({ id: 'g1' });
    const id = await addGroceryItem('user1', 'Milk');
    expect(id).toBe('g1');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), { name: 'Milk', checked: false });
  });

  it('setGroceryItemChecked merges the checked flag', async () => {
    await setGroceryItemChecked('user1', 'g1', true);
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { checked: true }, { merge: true });
  });

  it('listGroceryItems defaults missing fields sensibly', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'g1', data: () => ({}) },
        { id: 'g2', data: () => ({ name: 'Bread' }) },
        { id: 'g3', data: () => ({ checked: true }) },
        { id: 'g4', data: () => ({ name: 'Eggs', checked: null }) },
      ],
    });
    const result = await listGroceryItems('user1');
    expect(result).toEqual([
      { id: 'g1', name: '', checked: false },
      { id: 'g2', name: 'Bread', checked: false },
      { id: 'g3', name: '', checked: true },
      { id: 'g4', name: 'Eggs', checked: false },
    ]);
  });
});
