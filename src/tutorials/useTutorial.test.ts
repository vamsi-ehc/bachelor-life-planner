import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mockGetTutorialFlags = vi.fn();
const mockMarkTutorialSeen = vi.fn().mockResolvedValue(undefined);

vi.mock('./tutorialFlagsApi', () => ({
  getTutorialFlags: (...args: [string]) => mockGetTutorialFlags(...args),
  markTutorialSeen: (...args: [string, string]) => mockMarkTutorialSeen(...args),
}));

import { useTutorial } from './useTutorial';

describe('useTutorial', () => {
  beforeEach(() => {
    mockGetTutorialFlags.mockReset();
    mockMarkTutorialSeen.mockClear();
  });

  it('opens when the flag for the screen is unseen', async () => {
    mockGetTutorialFlags.mockResolvedValue({ workout: false });
    const { result } = renderHook(() => useTutorial('user1', 'workout'));
    await waitFor(() => expect(result.current.isOpen).toBe(true));
  });

  it('stays closed when the flag for the screen is already seen', async () => {
    mockGetTutorialFlags.mockResolvedValue({ workout: true });
    const { result } = renderHook(() => useTutorial('user1', 'workout'));
    await waitFor(() => expect(mockGetTutorialFlags).toHaveBeenCalled());
    expect(result.current.isOpen).toBe(false);
  });

  it('calls markTutorialSeen and closes on dismiss', async () => {
    mockGetTutorialFlags.mockResolvedValue({ workout: false });
    const { result } = renderHook(() => useTutorial('user1', 'workout'));
    await waitFor(() => expect(result.current.isOpen).toBe(true));

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isOpen).toBe(false);
    expect(mockMarkTutorialSeen).toHaveBeenCalledWith('user1', 'workout');
  });
});
