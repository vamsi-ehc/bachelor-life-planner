import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./useDashboardData', () => ({
  useDashboardData: () => ({
    loading: false,
    completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
    chores: [],
    dueItems: [{ id: 'c1', label: 'Laundry', domain: 'chores' }],
    streak: 3,
    dayHealth: 50,
  }),
}));

import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('renders the streak, day health, chips, and due-now strip', () => {
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText('Workout')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Chores')).toBeInTheDocument();
    expect(screen.getByText('Laundry')).toBeInTheDocument();
  });

  it('navigates when a chip is clicked', async () => {
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Workout'));
    expect(onNavigate).toHaveBeenCalledWith('/workout');
  });
});
