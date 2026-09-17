import { describe, expect, it } from 'vitest';
import { parseOperationsSnapshot, readMatrix, readVector, unavailableSnapshot } from './operations';

describe('Prometheus response readers', () => {
  it('averages an aggregated vector response without trusting malformed samples', () => {
    expect(
      readVector({
        status: 'success',
        data: {
          resultType: 'vector',
          result: [{ value: [1, '4'] }, { value: [2, '6'] }, { value: [3, 'NaN'] }],
        },
      }),
    ).toBe(5);
  });

  it('keeps only valid range values for the traffic sparkline', () => {
    expect(
      readMatrix({
        status: 'success',
        data: {
          resultType: 'matrix',
          result: [{ values: [[1, '0.2'], [2, 'bad'], [3, '0.8']] }],
        },
      }),
    ).toEqual([0.2, 0.8]);
  });

  it('returns a visibly unavailable snapshot rather than synthetic metrics', () => {
    expect(unavailableSnapshot('2026-07-12T00:00:00.000Z')).toMatchObject({
      source: 'unavailable',
      traffic: { requestsPerSecond: null, points: [] },
      runtime: { backendUp: null, nodeReady: null, diskUsage: null, backupLastSuccessAt: null },
    });
  });

  it('normalizes a legacy public operations response as a remote snapshot', () => {
    expect(
      parseOperationsSnapshot(
        {
          source: 'live',
          updatedAt: '2026-07-12T09:34:04.980Z',
          traffic: { requestsPerSecond: 0.5, errorRate: null, p95Milliseconds: 21, points: [0.4, 0.5] },
          events: { kafkaEventsPerSecond: null, deadLetterEvents: null, sagaRunsPerSecond: 0 },
          runtime: { backendUp: true, runningPods: 17, cpuUsage: 0.1, memoryUsage: 0.3 },
        },
        'remote',
      ),
    ).toMatchObject({
      source: 'remote',
      runtime: { nodeReady: null, diskUsage: null, backupLastSuccessAt: null },
    });
  });
});
