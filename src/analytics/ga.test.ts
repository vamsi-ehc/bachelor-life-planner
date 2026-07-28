import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ga', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = '';
    delete (window as unknown as { gtag?: unknown }).gtag;
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', 'G-TEST123');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.assign(import.meta.env, originalEnv);
  });

  it('does not inject a script when VITE_GA_MEASUREMENT_ID is unset', async () => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', '');
    const { loadGoogleAnalytics } = await import('./ga');
    loadGoogleAnalytics();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it('does not inject a script outside production', async () => {
    vi.stubEnv('PROD', false);
    const { loadGoogleAnalytics } = await import('./ga');
    loadGoogleAnalytics();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });

  it('injects exactly one gtag script when configured in production', async () => {
    const { loadGoogleAnalytics } = await import('./ga');
    loadGoogleAnalytics();
    loadGoogleAnalytics();
    const scripts = document.querySelectorAll('script[src*="googletagmanager"]');
    expect(scripts.length).toBe(1);
  });

  it('trackPageview no-ops when gtag is not present', async () => {
    const { trackPageview } = await import('./ga');
    expect(() => trackPageview('/privacy')).not.toThrow();
  });

  it('trackPageview calls window.gtag with the path when present', async () => {
    const gtagMock = vi.fn();
    (window as unknown as { gtag: typeof gtagMock }).gtag = gtagMock;
    const { trackPageview } = await import('./ga');
    trackPageview('/privacy');
    expect(gtagMock).toHaveBeenCalledWith('event', 'page_view', { page_path: '/privacy' });
  });
});
