import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn((..._args: unknown[]) => ({ __ref: true }));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

import { getTutorialFlags, markTutorialSeen, resetAllTutorialFlags } from './tutorialFlagsApi';
import { TUTORIAL_SCREEN_KEYS } from './types';

describe('tutorialFlagsApi', () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockClear();
    mockDoc.mockClear();
  });

  it('defaults every key to false when the doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const flags = await getTutorialFlags('user1');
    for (const key of TUTORIAL_SCREEN_KEYS) {
      expect(flags[key]).toBe(false);
    }
  });

  it('defaults a missing key to false when the doc exists but the key is absent', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ workout: true }) });
    const flags = await getTutorialFlags('user1');
    expect(flags.workout).toBe(true);
    expect(flags.learning).toBe(false);
  });

  it('merge-sets a single key to true when marking it seen', async () => {
    await markTutorialSeen('user1', 'workout');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { workout: true }, { merge: true });
  });

  it('merge-sets every key to false when resetting all', async () => {
    await resetAllTutorialFlags('user1');
    const [, payload, opts] = mockSetDoc.mock.calls[0];
    for (const key of TUTORIAL_SCREEN_KEYS) {
      expect(payload[key]).toBe(false);
    }
    expect(opts).toEqual({ merge: true });
  });
});
