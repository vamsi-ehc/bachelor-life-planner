import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseDashboardData = vi.fn();
vi.mock('./useDashboardData', () => ({
  useDashboardData: () => mockUseDashboardData(),
}));

import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('renders the streak, day health, chips, and due-now strip', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      dueItems: [{ id: 'c1', label: 'Laundry', domain: 'chores' }],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText('Workout')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Chores')).toBeInTheDocument();
    expect(screen.getByText('Laundry')).toBeInTheDocument();
  });

  it('navigates when a chip is clicked', async () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
    });
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Workout'));
    expect(onNavigate).toHaveBeenCalledWith('/workout');
  });

  it('shows an error message instead of hanging when data fails to load', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: 'permission denied',
      completion: null,
      chores: [],
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 0,
      dayHealth: 0,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('Something went wrong: permission denied')).toBeInTheDocument();
  });

  it('computes the Chores chip denominator using only chores due today', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: {
        date: '2026-07-20',
        workout: true,
        learning: true,
        chores: { c1: true, c2: true },
      },
      chores: [
        { id: 'c1', name: 'Dishes', cadence: 'daily' },
        { id: 'c2', name: 'Weekly report', cadence: 'weekly', weeklyDays: [1] },
      ],
      dueItems: [],
      dueTodayChoreIds: ['c1'],
      streak: 3,
      dayHealth: 100,
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });
});
