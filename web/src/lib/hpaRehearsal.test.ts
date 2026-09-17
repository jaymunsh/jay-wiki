import { describe, expect, it } from 'vitest';
import { hpaThresholdPercent, parseHpaView } from './hpaRehearsal';

const payload = {
  runId: 'run-1',
  status: 'SCALED_OUT',
  live: true,
  available: true,
  canControl: true,
  startedAt: '2026-07-14T00:00:00Z',
  updatedAt: '2026-07-14T00:00:10Z',
  cpuUtilization: 71,
  targetCpuUtilization: 60,
  desiredReplicas: 2,
  readyReplicas: 2,
  pods: [{ name: 'Pod 1', phase: 'Running', ready: true, restarts: 0, startedAt: null, cpuMilli: 120, memoryMi: 200, image: 'abc123' }],
  events: [{ phase: 'SCALED_OUT', at: '2026-07-14T00:00:10Z' }],
  load: { workers: 8, requests: 2400, failed: 3, avgMs: 41, maxMs: 820 },
};

describe('HPA rehearsal boundary', () => {
  it('always removes control capability from a remote public snapshot', () => {
    expect(parseHpaView(payload, 'remote')).toMatchObject({ source: 'remote', available: true, canControl: false });
  });

  it('keeps control capability only for the local trusted backend', () => {
    expect(parseHpaView(payload, 'local')).toMatchObject({ source: 'local', canControl: true });
  });

  it('rejects a malformed pod payload', () => {
    expect(parseHpaView({ ...payload, pods: [{ name: 'Pod 1' }] }, 'remote')).toBeNull();
  });

  it('keeps the measured load figures the job counted for itself', () => {
    expect(parseHpaView(payload, 'remote')?.load).toEqual({ workers: 8, requests: 2400, failed: 3, avgMs: 41, maxMs: 820 });
  });

  it('reads a run with no load figures yet as null instead of failing', () => {
    expect(parseHpaView({ ...payload, load: null }, 'remote')).toMatchObject({ load: null });
    expect(parseHpaView({ ...payload, load: { workers: 8 } }, 'remote')).toMatchObject({ load: null });
  });

  it('positions the chart threshold from the live HPA target', () => {
    expect(hpaThresholdPercent(80)).toBe(80);
    expect(hpaThresholdPercent(120)).toBe(100);
  });
});
