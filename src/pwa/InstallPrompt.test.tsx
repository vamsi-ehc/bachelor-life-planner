import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPromptInstall = vi.fn().mockResolvedValue(undefined);
const mockUseInstallPrompt = vi.fn();

vi.mock('./useInstallPrompt', () => ({
  useInstallPrompt: () => mockUseInstallPrompt(),
}));

import { InstallPrompt } from './InstallPrompt';

describe('InstallPrompt', () => {
  beforeEach(() => {
    mockPromptInstall.mockClear();
    mockUseInstallPrompt.mockReset();
  });

  it('renders nothing when already installed', () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: false,
      installed: true,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when not installable and not on iOS', () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: false,
      installed: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows an Install button and calls promptInstall when canInstall is true', async () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      installed: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });
    render(<InstallPrompt />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Install' }));
    expect(mockPromptInstall).toHaveBeenCalledTimes(1);
  });

  it('shows manual Add-to-Home-Screen instructions on iOS when no native prompt is available', () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: false,
      installed: false,
      isIOS: true,
      promptInstall: mockPromptInstall,
    });
    render(<InstallPrompt />);
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  it('dismisses the banner when Dismiss is clicked', async () => {
    mockUseInstallPrompt.mockReturnValue({
      canInstall: true,
      installed: false,
      isIOS: false,
      promptInstall: mockPromptInstall,
    });
    const { container } = render(<InstallPrompt />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(container).toBeEmptyDOMElement();
  });
});
