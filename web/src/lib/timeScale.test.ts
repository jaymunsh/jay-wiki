import { describe, expect, it } from 'vitest';
import { logPosition, TIME_SCALE_MAX, TIME_SCALE_MIN } from './timeScale';

describe('timeScale', () => {
  it('pins the axis ends and keeps a decade at a constant width', () => {
    expect(logPosition(TIME_SCALE_MIN)).toBe(0);
    expect(logPosition(TIME_SCALE_MAX)).toBe(100);
    const decade = logPosition(100) - logPosition(10);
    expect(logPosition(10) - logPosition(1)).toBeCloseTo(decade, 10);
  });

  it('clamps values outside the axis instead of overflowing the bar', () => {
    expect(logPosition(0)).toBe(0);
    expect(logPosition(-5)).toBe(0);
    expect(logPosition(99_999)).toBe(100);
  });
});
