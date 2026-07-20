import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PunchInButton } from './PunchInButton';

describe('PunchInButton', () => {
  it('shows "Punch In" when not done and calls onToggle when clicked', async () => {
    const onToggle = vi.fn();
    render(<PunchInButton done={false} onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Punch In' });
    const user = userEvent.setup();
    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the done state when already punched in', () => {
    render(<PunchInButton done={true} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Punched in/ })).toBeInTheDocument();
  });
});
