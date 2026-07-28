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
    expect(screen.getAllByText(/firestore/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/third part/i)).toBeInTheDocument();
    expect(screen.getAllByText(/security/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/retention/i)).toBeInTheDocument();
    expect(screen.getAllByText(/cookies|analytics/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/konathalavamsi123@gmail\.com/).length).toBeGreaterThan(0);
    expect(screen.getByText(/soc 2|hipaa|iso 27001/i)).not.toBeNull();
  });
});
