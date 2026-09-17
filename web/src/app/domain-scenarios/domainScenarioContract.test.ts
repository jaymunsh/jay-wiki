import { describe, expect, it } from 'vitest';

import { parseDomainScenarioRun } from './domainScenarioContract';

describe('domain scenario contract', () => {
  it('parses a persisted rehearsal response when every required field is present', () => {
    const parsed = parseDomainScenarioRun({
      runId: 'gift-card_1',
      scenario: 'gift-card',
      mode: 'DUPLICATE_RETRY',
      status: 'IDEMPOTENT',
      headline: '동일 요청은 기존 결과를 반환',
      beforeAmount: 50000,
      afterAmount: 40000,
      idempotencyKey: 'gc-1',
      httpStatus: 200,
      attemptCount: 1,
      elapsedMs: 42,
      p95Ms: 180,
      rejectedCount: 380,
      queueLag: 0,
      replicas: 1,
      recoverySeconds: 0,
      createdAt: '2026-07-15T12:00:00+09:00',
      steps: [
        { sequence: 1, action: 'USE_REQUESTED', actor: 'Commerce API', status: 'SUCCESS', detail: '요청 접수' },
      ],
    });

    expect(parsed?.status).toBe('IDEMPOTENT');
    expect(parsed?.elapsedMs).toBe(42);
    expect(parsed?.p95Ms).toBe(180);
    expect(parsed?.rejectedCount).toBe(380);
    expect(parsed?.steps[0]?.actor).toBe('Commerce API');
  });

  it('rejects a response with an incomplete step instead of rendering partial evidence', () => {
    const parsed = parseDomainScenarioRun({
      runId: 'gift-card_1',
      scenario: 'gift-card',
      mode: 'NORMAL',
      status: 'COMPLETED',
      headline: '완료',
      beforeAmount: 50000,
      afterAmount: 40000,
      idempotencyKey: 'gc-1',
      createdAt: '2026-07-15T12:00:00+09:00',
      steps: [{ sequence: 1, action: 'USE_REQUESTED' }],
    });

    expect(parsed).toBeNull();
  });
});
