import { describe, it, expect } from 'vitest';
import { computeMilestoneProgress, isWeeklyReviewDue } from './goalsLogic';
import { Goal } from '../shared/types';

describe('computeMilestoneProgress', () => {
  it('returns 0 when the goal has no milestones', () => {
    const goal: Goal = { id: 'g1', title: 'X', targetDate: '', status: 'active', milestones: [] };
    expect(computeMilestoneProgress(goal)).toBe(0);
  });

  it('computes the rounded percent of done milestones', () => {
    const goal: Goal = {
      id: 'g1',
      title: 'X',
      targetDate: '',
      status: 'active',
      milestones: [
        { id: 'm1', label: 'A', done: true },
        { id: 'm2', label: 'B', done: false },
      ],
    };
    expect(computeMilestoneProgress(goal)).toBe(50);
  });

  it('returns 100 when all milestones are done', () => {
    const goal: Goal = {
      id: 'g1',
      title: 'X',
      targetDate: '',
      status: 'active',
      milestones: [
        { id: 'm1', label: 'A', done: true },
        { id: 'm2', label: 'B', done: true },
        { id: 'm3', label: 'C', done: true },
      ],
    };
    expect(computeMilestoneProgress(goal)).toBe(100);
  });
});

describe('isWeeklyReviewDue', () => {
  it('is due on Sunday when no review has been recorded yet', () => {
    expect(isWeeklyReviewDue(0, null)).toBe(true);
  });

  it('is not due on Sunday when a review already exists', () => {
    expect(isWeeklyReviewDue(0, { weekId: '2026-07-19', wentWell: '', wentBadly: '', focusNext: '' })).toBe(
      false
    );
  });

  it('is not due on a non-Sunday day, regardless of review state', () => {
    expect(isWeeklyReviewDue(3, null)).toBe(false);
  });
});
