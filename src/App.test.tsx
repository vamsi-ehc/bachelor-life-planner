import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseAuth = vi.fn();
const mockSignOutUser = vi.fn();
vi.mock('./auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  signOutUser: (...args: unknown[]) => mockSignOutUser(...args),
}));
vi.mock('./marketing/Home', () => ({ Home: () => <div>Home screen</div> }));
vi.mock('./marketing/PrivacyPolicy', () => ({ PrivacyPolicy: () => <div>Privacy screen</div> }));
vi.mock('./marketing/TermsOfService', () => ({ TermsOfService: () => <div>Terms screen</div> }));
vi.mock('./marketing/ConsentBanner', () => ({ ConsentBanner: () => null }));
vi.mock('./analytics/ga', () => ({ trackPageview: vi.fn() }));
vi.mock('./dashboard/Dashboard', () => ({
  Dashboard: ({ uid }: { uid: string }) => <div>Dashboard for {uid}</div>,
}));
vi.mock('./domains/finances/FinancesScreen', () => ({
  FinancesScreen: ({ uid }: { uid: string }) => <div>Finances for {uid}</div>,
}));
vi.mock('./domains/meals/MealsScreen', () => ({
  MealsScreen: ({ uid }: { uid: string }) => <div>Meals for {uid}</div>,
}));
vi.mock('./domains/health/HealthScreen', () => ({
  HealthScreen: ({ uid }: { uid: string }) => <div>Health for {uid}</div>,
}));
vi.mock('./domains/goals/GoalsScreen', () => ({
  GoalsScreen: ({ uid }: { uid: string }) => <div>Goals for {uid}</div>,
}));
vi.mock('./domains/settings/SettingsScreen', () => ({
  SettingsScreen: ({ uid }: { uid: string }) => <div>Settings for {uid}</div>,
}));
vi.mock('./firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('./pwa/InstallPrompt', () => ({ InstallPrompt: () => null }));
vi.mock('./pwa/UpdateToast', () => ({ UpdateToast: () => null }));
vi.mock('./notifications/NotificationPermission', () => ({ NotificationPermission: () => null }));

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

  it('shows the Home marketing page at / when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<App />);
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });

  it('shows the Privacy page at /privacy when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect(screen.getByText('Privacy screen')).toBeInTheDocument();
  });

  it('shows the Terms page at /terms when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    window.history.pushState({}, '', '/terms');
    render(<App />);
    expect(screen.getByText('Terms screen')).toBeInTheDocument();
  });

  it('shows the Privacy page at /privacy when signed in too', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect(screen.getByText('Privacy screen')).toBeInTheDocument();
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
    const [signOutButton] = screen.getAllByRole('button', { name: 'Sign out' });
    await user.click(signOutButton);

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

  it('renders HealthScreen at /health', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    window.history.pushState({}, '', '/health');
    render(<App />);
    expect(await screen.findByText('Health for user1')).toBeInTheDocument();
  });

  it('renders GoalsScreen at /goals', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'user1' }, loading: false });
    window.history.pushState({}, '', '/goals');
    render(<App />);
    expect(await screen.findByText('Goals for user1')).toBeInTheDocument();
  });
});
