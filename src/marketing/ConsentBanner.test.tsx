import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockLoadGoogleAnalytics = vi.fn();
vi.mock('../analytics/ga', () => ({
  loadGoogleAnalytics: (...args: unknown[]) => mockLoadGoogleAnalytics(...args),
}));

import { ConsentBanner } from './ConsentBanner';

describe('ConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockLoadGoogleAnalytics.mockClear();
  });

  it('shows the banner on first visit', () => {
    render(<ConsentBanner />);
    expect(screen.getByText(/cookies/i)).toBeInTheDocument();
  });

  it('loads analytics and hides the banner on Accept', async () => {
    render(<ConsentBanner />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /accept/i }));
    expect(mockLoadGoogleAnalytics).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('punch-in-consent')).toBe('accepted');
  });

  it('hides the banner without loading analytics on Decline', async () => {
    render(<ConsentBanner />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /decline/i }));
    expect(mockLoadGoogleAnalytics).not.toHaveBeenCalled();
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('punch-in-consent')).toBe('declined');
  });

  it('does not render if a choice was already made in localStorage', () => {
    window.localStorage.setItem('punch-in-consent', 'accepted');
    render(<ConsentBanner />);
    expect(screen.queryByText(/cookies/i)).not.toBeInTheDocument();
  });

  it('loads analytics immediately if consent was already accepted previously', () => {
    window.localStorage.setItem('punch-in-consent', 'accepted');
    render(<ConsentBanner />);
    expect(mockLoadGoogleAnalytics).toHaveBeenCalledTimes(1);
  });
});
