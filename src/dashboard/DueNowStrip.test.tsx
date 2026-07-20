import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DueNowStrip } from './DueNowStrip';

describe('DueNowStrip', () => {
  it('shows a message when nothing is due', () => {
    render(<DueNowStrip items={[]} />);
    expect(screen.getByText('Nothing due right now.')).toBeInTheDocument();
  });

  it('lists each due item label', () => {
    render(
      <DueNowStrip
        items={[
          { id: 'c1', label: 'Laundry', domain: 'chores' },
          { id: 'c2', label: 'Trash', domain: 'chores' },
        ]}
      />
    );
    expect(screen.getByText('Laundry')).toBeInTheDocument();
    expect(screen.getByText('Trash')).toBeInTheDocument();
  });
});
