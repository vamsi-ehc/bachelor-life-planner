import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ScreenHeader } from './ScreenHeader';

function renderAtWorkout() {
  return render(
    <MemoryRouter initialEntries={['/workout']}>
      <Routes>
        <Route path="/" element={<div>Home screen</div>} />
        <Route path="/workout" element={<ScreenHeader label="Workout" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ScreenHeader', () => {
  it('renders the label as the visible heading', () => {
    renderAtWorkout();
    expect(screen.getByRole('heading', { name: 'Workout' })).toBeInTheDocument();
  });

  it('navigates to / when the back arrow is clicked', async () => {
    renderAtWorkout();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });

  it('navigates to / when the Home breadcrumb is clicked', async () => {
    renderAtWorkout();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByText('Home screen')).toBeInTheDocument();
  });
});
