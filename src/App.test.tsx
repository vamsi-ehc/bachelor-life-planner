import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockUseAuth = vi.fn();
vi.mock('./auth/useAuth', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('./auth/Login', () => ({ Login: () => <div>Login screen</div> }));
vi.mock('./dashboard/Dashboard', () => ({
  Dashboard: ({ uid }: { uid: string }) => <div>Dashboard for {uid}</div>,
}));
vi.mock('./firebase/config', () => ({ auth: {}, db: {} }));

import App from './App';

describe('App', () => {
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
});
