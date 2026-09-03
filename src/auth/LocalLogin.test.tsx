import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockSignInLocal = vi.fn().mockResolvedValue(undefined);
const mockSignUpLocal = vi.fn().mockResolvedValue(undefined);

vi.mock('./localAuth', () => ({
  signInLocal: (...args: unknown[]) => mockSignInLocal(...args),
  signUpLocal: (...args: unknown[]) => mockSignUpLocal(...args),
}));

import { LocalLogin } from './LocalLogin';

describe('LocalLogin', () => {
  beforeEach(() => {
    mockSignInLocal.mockClear();
    mockSignUpLocal.mockClear();
  });

  it('renders email/password fields and defaults to sign-in', () => {
    render(<LocalLogin />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('signs in with the entered credentials', async () => {
    render(<LocalLogin />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Email'), 'me@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(mockSignInLocal).toHaveBeenCalledWith('me@example.com', 'password123'));
  });

  it('switches to create-account mode and signs up', async () => {
    render(<LocalLogin />);
    const user = userEvent.setup();
    await user.click(screen.getByText(/don't have an account/i));
    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(mockSignUpLocal).toHaveBeenCalledWith('new@example.com', 'password123'));
  });

  it('shows an error if sign in rejects', async () => {
    mockSignInLocal.mockRejectedValueOnce(new Error('Invalid email or password'));
    render(<LocalLogin />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Email'), 'me@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(screen.getByText('Invalid email or password')).toBeInTheDocument());
  });

  it('shows a redirectError passed in', () => {
    render(<LocalLogin redirectError="something failed" />);
    expect(screen.getByText('something failed')).toBeInTheDocument();
  });
});
