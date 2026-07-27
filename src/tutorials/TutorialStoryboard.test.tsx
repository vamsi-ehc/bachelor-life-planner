import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('TutorialStoryboard anchored positioning', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('does not render the full-screen backdrop when the step has no targetId', () => {
    render(<TutorialStoryboard title="Workout" steps={steps} onDismiss={vi.fn()} />);
    expect(screen.queryByTestId('tutorial-backdrop')).toBeInTheDocument();
  });

  it('scrolls the target into view and skips the full-screen backdrop when the targetId matches an element', () => {
    document.body.innerHTML = '<div id="my-target"></div>';
    const target = document.getElementById('my-target') as HTMLElement;
    const scrollIntoViewSpy = vi.fn();
    target.scrollIntoView = scrollIntoViewSpy;

    const anchoredSteps = [{ title: 'Step one', body: 'Body one', targetId: 'my-target' }];
    render(<TutorialStoryboard title="Workout" steps={anchoredSteps} onDismiss={vi.fn()} />);

    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(screen.queryByTestId('tutorial-backdrop')).not.toBeInTheDocument();
  });

  it('falls back to the full-screen backdrop when the targetId does not match any element', () => {
    const anchoredSteps = [{ title: 'Step one', body: 'Body one', targetId: 'missing-target' }];
    render(<TutorialStoryboard title="Workout" steps={anchoredSteps} onDismiss={vi.fn()} />);

    expect(screen.queryByTestId('tutorial-backdrop')).toBeInTheDocument();
  });

  it('re-scrolls to the new target when advancing to a step with a different targetId', async () => {
    document.body.innerHTML = '<div id="target-a"></div><div id="target-b"></div>';
    const targetA = document.getElementById('target-a') as HTMLElement;
    const targetB = document.getElementById('target-b') as HTMLElement;
    const scrollA = vi.fn();
    const scrollB = vi.fn();
    targetA.scrollIntoView = scrollA;
    targetB.scrollIntoView = scrollB;

    const anchoredSteps = [
      { title: 'Step one', body: 'Body one', targetId: 'target-a' },
      { title: 'Step two', body: 'Body two', targetId: 'target-b' },
    ];
    render(<TutorialStoryboard title="Workout" steps={anchoredSteps} onDismiss={vi.fn()} />);
    expect(scrollA).toHaveBeenCalledTimes(1);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(scrollB).toHaveBeenCalledTimes(1);
  });
});
