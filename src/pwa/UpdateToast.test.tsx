import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUpdateServiceWorker = vi.fn();
let mockNeedRefresh = false;
let mockOfflineReady = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, vi.fn()],
    offlineReady: [mockOfflineReady, vi.fn()],
    updateServiceWorker: mockUpdateServiceWorker,
  }),
}));

import { UpdateToast } from './UpdateToast';

describe('UpdateToast', () => {
  beforeEach(() => {
    mockNeedRefresh = false;
    mockOfflineReady = false;
    mockUpdateServiceWorker.mockClear();
  });

  it('renders nothing when there is no update and offline-ready has not fired', () => {
    const { container } = render(<UpdateToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the offline-ready message', () => {
    mockOfflineReady = true;
    render(<UpdateToast />);
    expect(screen.getByText('Punch In is ready to work offline.')).toBeInTheDocument();
  });

  it('shows a reload button when an update is available and calls updateServiceWorker(true) on click', async () => {
    mockNeedRefresh = true;
    render(<UpdateToast />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reload to update' }));
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });
});
