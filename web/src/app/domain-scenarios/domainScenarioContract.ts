export type DomainScenarioStep = {
  readonly sequence: number;
  readonly action: string;
  readonly actor: string;
  readonly status: string;
  readonly detail: string;
};

export type DomainScenarioRun = {
  readonly runId: string;
  readonly scenario: string;
  readonly mode: string;
  readonly status: string;
  readonly headline: string;
  readonly beforeAmount: number;
  readonly afterAmount: number;
  readonly idempotencyKey: string;
  readonly httpStatus: number;
  readonly attemptCount: number;
  readonly elapsedMs: number;
  readonly p95Ms: number;
  readonly rejectedCount: number;
  readonly queueLag: number;
  readonly replicas: number;
  readonly recoverySeconds: number;
  readonly createdAt: string;
  readonly steps: readonly DomainScenarioStep[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: Record<string, unknown>, key: string): string | null {
  return typeof value[key] === 'string' ? value[key] : null;
}

function readNumber(value: Record<string, unknown>, key: string): number | null {
  return typeof value[key] === 'number' ? value[key] : null;
}

function parseStep(value: unknown): DomainScenarioStep | null {
  if (!isRecord(value)) return null;
  const sequence = readNumber(value, 'sequence');
  const action = readString(value, 'action');
  const actor = readString(value, 'actor');
  const status = readString(value, 'status');
  const detail = readString(value, 'detail');
  if (sequence === null || !action || !actor || !status || !detail) return null;
  return { sequence, action, actor, status, detail };
}

export function parseDomainScenarioRun(value: unknown): DomainScenarioRun | null {
  if (!isRecord(value)) return null;
  const runId = readString(value, 'runId');
  const scenario = readString(value, 'scenario');
  const mode = readString(value, 'mode');
  const status = readString(value, 'status');
  const headline = readString(value, 'headline');
  const beforeAmount = readNumber(value, 'beforeAmount');
  const afterAmount = readNumber(value, 'afterAmount');
  const idempotencyKey = readString(value, 'idempotencyKey');
  const httpStatus = readNumber(value, 'httpStatus');
  const attemptCount = readNumber(value, 'attemptCount');
  const elapsedMs = readNumber(value, 'elapsedMs');
  const p95Ms = readNumber(value, 'p95Ms') ?? 0;
  const rejectedCount = readNumber(value, 'rejectedCount') ?? 0;
  const queueLag = readNumber(value, 'queueLag') ?? 0;
  const replicas = readNumber(value, 'replicas') ?? 0;
  const recoverySeconds = readNumber(value, 'recoverySeconds') ?? 0;
  const createdAt = readString(value, 'createdAt');
  if (!runId || !scenario || !mode || !status || !headline || !idempotencyKey || !createdAt) return null;
  if (beforeAmount === null || afterAmount === null || httpStatus === null) return null;
  if (attemptCount === null || elapsedMs === null || !Array.isArray(value.steps)) return null;
  const steps = value.steps.map(parseStep);
  if (steps.some((step) => step === null)) return null;
  return {
    runId,
    scenario,
    mode,
    status,
    headline,
    beforeAmount,
    afterAmount,
    idempotencyKey,
    httpStatus,
    attemptCount,
    elapsedMs,
    p95Ms,
    rejectedCount,
    queueLag,
    replicas,
    recoverySeconds,
    createdAt,
    steps: steps.filter((step): step is DomainScenarioStep => step !== null),
  };
}
