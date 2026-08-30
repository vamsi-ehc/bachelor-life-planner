import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockSignInWithGoogle = vi.fn().mockResolvedValue(undefined);

vi.mock('./useAuth', () => ({
  signInWithGoogle: () => mockSignInWithGoogle(),
}));

import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => {
    mockSignInWithGoogle.mockClear();
  });

  it('renders a single Google sign-in button', () => {
    render(<Login />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Password')).not.toBeInTheDocument();
  });

  it('calls signInWithGoogle when clicked', async () => {
    render(<Login />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1));
  });

  it('shows an error if signInWithGoogle rejects', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('popup blocked'));
    render(<Login />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /sign in with google/i }));
    await waitFor(() => expect(screen.getByText('popup blocked')).toBeInTheDocument());
  });

  it('shows a redirectError passed in from a failed redirect flow', () => {
    render(<Login redirectError="redirect failed" />);
    expect(screen.getByText('redirect failed')).toBeInTheDocument();
  });
});
