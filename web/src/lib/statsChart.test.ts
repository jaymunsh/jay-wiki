import { describe, expect, it } from 'vitest';

import { barHeights } from './statsChart';

describe('barHeights', () => {
  it('최대값이 100 이 된다', () => {
    expect(barHeights([1, 2, 4])).toEqual([25, 50, 100]);
  });

  it('전부 0 이면 전부 0 이다 — 0 으로 나누지 않는다', () => {
    expect(barHeights([0, 0])).toEqual([0, 0]);
  });

  it('빈 배열은 빈 배열이다', () => {
    expect(barHeights([])).toEqual([]);
  });

  it('음수는 0 으로 본다', () => {
    expect(barHeights([-5, 10])).toEqual([0, 100]);
  });
});
