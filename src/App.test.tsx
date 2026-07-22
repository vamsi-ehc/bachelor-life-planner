import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseAuth = vi.fn();
const mockSignOutUser = vi.fn();
vi.mock('./auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  signOutUser: (...args: unknown[]) => mockSignOutUser(...args),
}));
vi.mock('./auth/Login', () => ({ Login: () => <div>Login screen</div> }));
vi.mock('./dashboard/Dashboard', () => ({
  Dashboard: ({ uid }: { uid: string }) => <div>Dashboard for {uid}</div>,
}));
vi.mock('./domains/finances/FinancesScreen', () => ({
  FinancesScreen: ({ uid }: { uid: string }) => <div>Finances for {uid}</div>,
}));
vi.mock('./domains/meals/MealsScreen', () => ({
  MealsScreen: ({ uid }: { uid: string }) => <div>Meals for {uid}</div>,
}));
vi.mock('./firebase/config', () => ({ auth: {}, db: {} }));

import App from './App';

describe('App', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('shows a loading state while auth resolves', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows the Login screen when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<App />);
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('shows the Dashboard when signed in', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    render(<App />);
    expect(screen.getByText('Dashboard for user1')).toBeInTheDocument();
  });

  it('signs out when the Sign out button is clicked', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    render(<App />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(mockSignOutUser).toHaveBeenCalled();
  });

  it('renders FinancesScreen at /finances', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    window.history.pushState({}, '', '/finances');
    render(<App />);
    expect(screen.getByText('Finances for user1')).toBeInTheDocument();
  });

  it('renders MealsScreen at /meals', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    window.history.pushState({}, '', '/meals');
    render(<App />);
    expect(screen.getByText('Meals for user1')).toBeInTheDocument();
  });
});
