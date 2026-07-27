import { describe, it, expect } from 'vitest';
import { computeAnchoredPosition } from './computeAnchoredPosition';

const viewport = { width: 800, height: 600 };
const card = { width: 320, height: 200 };

describe('computeAnchoredPosition', () => {
  it('positions the card below the target when there is enough room below', () => {
    const targetRect = { top: 100, left: 100, right: 200, bottom: 140, width: 100, height: 40 };
    const position = computeAnchoredPosition(targetRect, viewport, card);
    expect(position.top).toBe(140 + 12);
    expect(position.left).toBe(100);
  });

  it('positions the card above the target when there is not enough room below', () => {
    const targetRect = { top: 480, left: 100, right: 200, bottom: 520, width: 100, height: 40 };
    const position = computeAnchoredPosition(targetRect, viewport, card);
    expect(position.top).toBe(480 - card.height - 12);
  });

  it('clamps left so the card does not overflow the right edge of the viewport', () => {
    const targetRect = { top: 100, left: 700, right: 780, bottom: 140, width: 80, height: 40 };
    const position = computeAnchoredPosition(targetRect, viewport, card);
    expect(position.left).toBe(viewport.width - card.width - 12);
  });

  it('clamps left so the card does not overflow the left edge of the viewport', () => {
    const targetRect = { top: 100, left: -50, right: 50, bottom: 140, width: 100, height: 40 };
    const position = computeAnchoredPosition(targetRect, viewport, card);
    expect(position.left).toBe(12);
  });

  it('clamps top within the viewport when there is no room above or below', () => {
    const targetRect = { top: 250, left: 100, right: 200, bottom: 550, width: 100, height: 300 };
    const position = computeAnchoredPosition(targetRect, viewport, card);
    expect(position.top).toBeGreaterThanOrEqual(12);
    expect(position.top).toBeLessThanOrEqual(viewport.height - card.height - 12);
  });
});
