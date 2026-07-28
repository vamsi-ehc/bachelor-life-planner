// src/marketing/Home.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../auth/Login', () => ({ Login: () => <div>Login screen</div> }));

import { Home } from './Home';

describe('Home', () => {
  it('renders the hero, product overview, how-it-works, privacy summary, and footer', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /punch in/i, level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText(/workout/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/learning/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/chores/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/finances/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/meals/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/health/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/goals/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/get started/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in with google/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read.*privacy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });
});
