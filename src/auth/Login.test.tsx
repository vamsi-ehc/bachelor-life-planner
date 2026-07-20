import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockSignIn = vi.fn().mockResolvedValue(undefined);
const mockSignUp = vi.fn().mockResolvedValue(undefined);

vi.mock('./useAuth', () => ({
  signIn: (...args: [string, string]) => mockSignIn(...args),
  signUp: (...args: [string, string]) => mockSignUp(...args),
}));

import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => {
    mockSignIn.mockClear();
    mockSignUp.mockClear();
  });

  it('submits sign-in with the entered email and password', async () => {
    render(<Login />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Email'), 'me@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockSignIn).toHaveBeenCalledWith('me@example.com', 'hunter2');
  });

  it('switches to sign-up mode and submits signUp instead', async () => {
    render(<Login />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /need an account/i }));
    await user.type(screen.getByPlaceholderText('Email'), 'new@example.com');
    await user.type(screen.getByPlaceholderText('Password'), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'hunter2');
  });
});
