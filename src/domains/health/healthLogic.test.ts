import { describe, it, expect } from 'vitest';
import { computeSleepDurationHours, computeWeightChange } from './healthLogic';
import { WeightEntry } from '../shared/types';

describe('computeSleepDurationHours', () => {
  it('computes duration for an overnight sleep (crosses midnight)', () => {
    expect(computeSleepDurationHours('23:00', '07:00')).toBe(8);
  });

  it('computes a fractional duration', () => {
    expect(computeSleepDurationHours('23:30', '07:00')).toBe(7.5);
  });

  it('computes duration when both times are after midnight and wake is later than bed', () => {
    expect(computeSleepDurationHours('01:00', '09:00')).toBe(8);
  });
});

describe('computeWeightChange', () => {
  it('returns null when there are fewer than 2 entries', () => {
    expect(computeWeightChange([])).toBeNull();
    const one: WeightEntry[] = [{ id: 'w1', date: '2026-07-20', weightKg: 70 }];
    expect(computeWeightChange(one)).toBeNull();
  });

  it('returns the delta between the two most recent entries (assumed most-recent-first)', () => {
    const entries: WeightEntry[] = [
      { id: 'w2', date: '2026-07-20', weightKg: 69.5 },
      { id: 'w1', date: '2026-07-13', weightKg: 70 },
    ];
    expect(computeWeightChange(entries)).toBe(-0.5);
  });
});
