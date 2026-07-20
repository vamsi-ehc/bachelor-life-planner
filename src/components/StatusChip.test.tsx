import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it('renders the label and detail', () => {
    render(<StatusChip label="Workout" status="done" detail="1 entry logged" />);
    expect(screen.getByText('Workout')).toBeInTheDocument();
    expect(screen.getByText('1 entry logged')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<StatusChip label="Learning" status="not-started" onClick={onClick} />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Learning'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
