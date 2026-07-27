import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseDashboardData = vi.fn();
vi.mock('./useDashboardData', () => ({
  useDashboardData: () => mockUseDashboardData(),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

const mockUseTutorial = vi.fn((..._args: [string, string]) => ({ isOpen: false, dismiss: vi.fn() }));
vi.mock('../tutorials/useTutorial', () => ({
  useTutorial: (...args: [string, string]) => mockUseTutorial(...args),
}));

import { Dashboard } from './Dashboard';

describe('Dashboard', () => {
  it('renders the streak, day health, chips, and due-now strip', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [{ id: 'c1', label: 'Laundry', domain: 'chores' }],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText('Workout')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Chores')).toBeInTheDocument();
    expect(screen.getByText('Finances')).toBeInTheDocument();
    expect(screen.getByText('Meals')).toBeInTheDocument();
    expect(screen.getByText('Laundry')).toBeInTheDocument();
  });

  it('navigates when a chip is clicked', async () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Workout'));
    expect(onNavigate).toHaveBeenCalledWith('/workout');
  });

  it('navigates to /finances when the Finances chip is clicked', async () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Finances'));
    expect(onNavigate).toHaveBeenCalledWith('/finances');
  });

  it('navigates to /meals when the Meals chip is clicked', async () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    const onNavigate = vi.fn();
    render(<Dashboard uid="user1" onNavigate={onNavigate} />);
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByText('Meals'));
    expect(onNavigate).toHaveBeenCalledWith('/meals');
  });

  it('shows the Finances chip as in-progress with a due-bill count when a bill is due today', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [{ id: 'b1', name: 'Rent', amount: 1200, dueDay: new Date().getDate(), category: 'Housing' }],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('1 bill(s) due')).toBeInTheDocument();
  });

  it('shows the Finances chip as done with no bills due when nothing is due today', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [{ id: 'b1', name: 'Rent', amount: 1200, dueDay: new Date().getDate() === 1 ? 2 : 1, category: 'Housing' }],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('No bills due')).toBeInTheDocument();
  });

  it('shows the Meals chip with the unchecked grocery count', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [
        { id: 'g1', name: 'Milk', checked: false },
        { id: 'g2', name: 'Eggs', checked: true },
      ],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('1 to buy')).toBeInTheDocument();
  });

  it('shows an error message instead of hanging when data fails to load', () => {
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: 'permission denied',
      completion: null,
      chores: [],
      bills: [],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 0,
      dayHealth: 0,
      healthHistory: [],
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('Something went wrong: permission denied')).toBeInTheDocument();
  });

  it('renders Health and Goals chips', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T12:00:00'));
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-19', workout: true, learning: true, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      sleepLog: { date: '2026-07-19', bedtime: '23:00', wakeTime: '07:00' },
      goals: [
        { id: 'g1', title: 'Run a 10k', targetDate: '2026-12-01', status: 'active', milestones: [] },
      ],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 100,
      healthHistory: [],
    });

    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);

    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('8h slept')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Review due')).toBeInTheDocument();

    vi.useRealTimers();
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
      bills: [],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: ['c1'],
      streak: 3,
      dayHealth: 100,
      healthHistory: [],
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(screen.getByText('1/1 done')).toBeInTheDocument();
  });

  it('shows the tutorial storyboard when useTutorial reports it is open', () => {
    mockUseTutorial.mockReturnValueOnce({ isOpen: true, dismiss: vi.fn() });
    mockUseDashboardData.mockReturnValue({
      loading: false,
      error: null,
      completion: { date: '2026-07-20', workout: true, learning: false, chores: {} },
      chores: [],
      bills: [],
      groceryItems: [],
      sleepLog: null,
      goals: [],
      weeklyReview: null,
      dueItems: [],
      dueTodayChoreIds: [],
      streak: 3,
      dayHealth: 50,
      healthHistory: [],
    });
    render(<Dashboard uid="user1" onNavigate={vi.fn()} />);
    expect(mockUseTutorial).toHaveBeenCalledWith('user1', 'dashboard');
  });
});
