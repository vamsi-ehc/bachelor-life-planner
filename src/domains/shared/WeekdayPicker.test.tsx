import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekdayPicker, weekdaySummary } from './WeekdayPicker';

describe('weekdaySummary', () => {
  it('joins selected weekday labels', () => {
    expect(weekdaySummary([1, 3, 5])).toBe('Mon, Wed, Fri');
  });

  it('falls back to a placeholder when nothing is selected', () => {
    expect(weekdaySummary([])).toBe('No days selected');
    expect(weekdaySummary(undefined)).toBe('No days selected');
  });
});

describe('WeekdayPicker', () => {
  it('adds a day to the selection on click', async () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Wed' }));
    expect(onChange).toHaveBeenCalledWith([3]);
  });

  it('removes an already-selected day on click', async () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[1, 3]} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Mon' }));
    expect(onChange).toHaveBeenCalledWith([3]);
  });
});
