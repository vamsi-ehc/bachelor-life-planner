import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPolicy } from './PrivacyPolicy';

describe('PrivacyPolicy', () => {
  it('covers what is collected, third parties, security, retention, cookies, rights, and contact', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeInTheDocument();
    expect(screen.getByText(/what we collect/i)).toBeInTheDocument();
    expect(screen.getByText(/firestore/i)).toBeInTheDocument();
    expect(screen.getByText(/third part/i)).toBeInTheDocument();
    expect(screen.getByText(/security/i)).toBeInTheDocument();
    expect(screen.getByText(/retention/i)).toBeInTheDocument();
    expect(screen.getByText(/cookies|analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/konathalavamsi123@gmail\.com/)).toBeInTheDocument();
    expect(screen.getByText(/soc 2|hipaa|iso 27001/i)).not.toBeNull();
  });
});
