import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TutorialStoryboard } from './TutorialStoryboard';

const steps = [
  { title: 'Step one', body: 'Body one' },
  { title: 'Step two', body: 'Body two' },
  { title: 'Step three', body: 'Body three' },
];

describe('TutorialStoryboard', () => {
  it('shows the first step and advances on Next', async () => {
    const onDismiss = vi.fn();
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={onDismiss} />);

    expect(screen.getByText('Step one')).toBeInTheDocument();
    expect(screen.getByText('Body one')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Step two')).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('goes back to the previous step', async () => {
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step two')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step one')).toBeInTheDocument();
  });

  it('calls onDismiss immediately when Skip is clicked', async () => {
    const onDismiss = vi.fn();
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={onDismiss} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows "Got it" on the last step and calls onDismiss when clicked', async () => {
    const onDismiss = vi.fn();
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={onDismiss} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Step three')).toBeInTheDocument();

    const lastButton = screen.getByRole('button', { name: 'Got it' });
    await user.click(lastButton);

    expect(onDismiss).toHaveBeenCalled();
  });
});
