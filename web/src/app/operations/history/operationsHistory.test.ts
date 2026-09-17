import { describe, expect, it } from 'vitest';
import { countByType, measuredCount, OPERATION_EVENT_RANGE, OPERATION_EVENTS } from './operationsHistory';

describe('operations history', () => {
  it('keeps events newest first with unique ids and wiki evidence links', () => {
    const timestamps = OPERATION_EVENTS.map((event) => Date.parse(event.occurredAt));
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
    expect(new Set(OPERATION_EVENTS.map((event) => event.id)).size).toBe(OPERATION_EVENTS.length);
    expect(OPERATION_EVENTS.every((event) => event.href.startsWith('/wiki/'))).toBe(true);
  });

  it('exposes the range the list covers, oldest first', () => {
    expect(Date.parse(OPERATION_EVENT_RANGE.first)).toBeLessThan(Date.parse(OPERATION_EVENT_RANGE.last));
  });

  it('counts every event exactly once so the type counts add up', () => {
    const counts = countByType();
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(OPERATION_EVENTS.length);
  });

  it('only carries a duration when it was actually measured', () => {
    // 재지 않은 사건은 null 이어야 한다. 0 이나 추정치가 들어오면 막대가 거짓말을 한다.
    expect(OPERATION_EVENTS.every((event) => event.durationSeconds === null || event.durationSeconds > 0)).toBe(true);
    expect(measuredCount()).toBeGreaterThan(0);
    expect(measuredCount()).toBeLessThanOrEqual(OPERATION_EVENTS.length);
  });
});
