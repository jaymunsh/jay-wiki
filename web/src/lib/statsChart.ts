/** 막대 높이를 백분율로 바꾼다. 최대값이 100 이 된다. 값이 전부 0 이면 전부 0 이다. */
export function barHeights(values: readonly number[]): number[] {
  const safe = values.map((v) => (v > 0 ? v : 0));
  const max = Math.max(0, ...safe);
  if (max === 0) return safe.map(() => 0);
  return safe.map((v) => Math.round((v / max) * 100));
}
