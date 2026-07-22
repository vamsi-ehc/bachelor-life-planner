import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInstallPrompt } from './useInstallPrompt';

const originalUserAgent = window.navigator.userAgent;

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function makeBeforeInstallPromptEvent() {
  const promptMock = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = promptMock;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  return { event, promptMock };
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', { value: originalUserAgent, configurable: true });
  });

  it('starts with canInstall false and installed false when no event has fired', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it('sets canInstall true after beforeinstallprompt fires', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event } = makeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });

    await waitFor(() => expect(result.current.canInstall).toBe(true));
  });

  it("promptInstall calls the deferred event's prompt() and then clears canInstall", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event, promptMock } = makeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });
    await waitFor(() => expect(result.current.canInstall).toBe(true));

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(promptMock).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('sets installed true and canInstall false when appinstalled fires', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const { event } = makeBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });
    await waitFor(() => expect(result.current.canInstall).toBe(true));

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    await waitFor(() => expect(result.current.installed).toBe(true));
    expect(result.current.canInstall).toBe(false);
  });

  it('reports isIOS true for an iPhone user agent', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(true);
  });

  it('reports isIOS false for a desktop Chrome user agent', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIOS).toBe(false);
  });
});
