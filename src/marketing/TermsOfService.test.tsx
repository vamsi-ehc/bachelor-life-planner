import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TermsOfService } from './TermsOfService';

describe('TermsOfService', () => {
  it('covers eligibility, acceptable use, disclaimer, liability, termination, and governing law', () => {
    render(
      <MemoryRouter>
        <TermsOfService />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /terms of service/i })).toBeInTheDocument();
    expect(screen.getByText(/eligibility/i)).toBeInTheDocument();
    expect(screen.getByText(/acceptable use/i)).toBeInTheDocument();
    expect(screen.getByText(/as is|as-is/i)).toBeInTheDocument();
    expect(screen.getByText(/limitation of liability/i)).toBeInTheDocument();
    expect(screen.getByText(/termination/i)).toBeInTheDocument();
    expect(screen.getByText(/governing law/i)).toBeInTheDocument();
    expect(screen.getByText(/konathalavamsi123@gmail\.com/)).toBeInTheDocument();
  });
});
