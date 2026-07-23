import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockEnable = vi.fn();
const mockUseNotificationPermission = vi.fn();

vi.mock('./useNotificationPermission', () => ({
  useNotificationPermission: (...args: unknown[]) => mockUseNotificationPermission(...args),
}));

import { NotificationPermission } from './NotificationPermission';

describe('NotificationPermission', () => {
  beforeEach(() => {
    mockEnable.mockClear();
    mockUseNotificationPermission.mockReset();
  });

  it('renders nothing once granted', () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'granted', enable: mockEnable, error: null });
    const { container } = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an Enable button when idle and calls enable on click', async () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable, error: null });
    render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enable' }));
    expect(mockEnable).toHaveBeenCalledTimes(1);
  });

  it('shows a blocked message and no Enable button when denied', () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'denied', enable: mockEnable, error: null });
    render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(screen.getByText(/blocked/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
  });

  it('dismisses the banner when Dismiss is clicked', async () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable, error: null });
    const { container } = render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('displays an error message when error is set', () => {
    mockUseNotificationPermission.mockReturnValue({ status: 'idle', enable: mockEnable, error: 'Network error' });
    render(<NotificationPermission uid="user1" vapidKey="vapid-key" />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});
