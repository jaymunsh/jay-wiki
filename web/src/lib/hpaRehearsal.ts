export type HpaSource = 'local' | 'remote';

export type HpaPod = {
  readonly name: string;
  readonly phase: string;
  readonly ready: boolean;
  readonly restarts: number;
  readonly startedAt: string | null;
  readonly cpuMilli: number | null;
  readonly memoryMi: number | null;
  readonly image: string;
};

export type HpaEvent = { readonly phase: string; readonly at: string };

/** 부하 Job 이 스스로 센 값이다. 클러스터 지표가 아니라 요청을 보낸 쪽에서 나온다. */
export type HpaLoad = {
  readonly workers: number;
  readonly requests: number;
  readonly failed: number;
  readonly avgMs: number;
  readonly maxMs: number;
};

export type HpaView = {
  readonly source: HpaSource;
  readonly runId: string | null;
  readonly status: string;
  readonly live: boolean;
  readonly available: boolean;
  readonly canControl: boolean;
  readonly startedAt: string | null;
  readonly updatedAt: string;
  readonly cpuUtilization: number | null;
  readonly targetCpuUtilization: number;
  readonly desiredReplicas: number;
  readonly readyReplicas: number;
  readonly pods: readonly HpaPod[];
  readonly events: readonly HpaEvent[];
  readonly load: HpaLoad | null;
};

export function hpaThresholdPercent(targetCpuUtilization: number): number {
  return Math.max(0, Math.min(targetCpuUtilization, 100));
}

export function parseHpaView(value: unknown, source: HpaSource): HpaView | null {
  if (!isRecord(value) || typeof value.status !== 'string') return null;
  if (!Array.isArray(value.pods) || !Array.isArray(value.events)) return null;

  const pods = value.pods.map(parsePod);
  const events = value.events.map(parseEvent);
  if (pods.some((pod) => pod === null) || events.some((event) => event === null)) return null;

  const desiredReplicas = integer(value.desiredReplicas);
  const readyReplicas = integer(value.readyReplicas);
  const targetCpuUtilization = integer(value.targetCpuUtilization);
  if (desiredReplicas === null || readyReplicas === null || targetCpuUtilization === null) return null;

  return {
    source,
    runId: nullableString(value.runId),
    status: value.status,
    live: value.live === true,
    available: value.available === true,
    canControl: source === 'local' && value.canControl === true,
    startedAt: nullableString(value.startedAt),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    cpuUtilization: nullableNumber(value.cpuUtilization),
    targetCpuUtilization,
    desiredReplicas,
    readyReplicas,
    pods: pods as HpaPod[],
    events: events as HpaEvent[],
    load: parseLoad(value.load),
  };
}

export function unavailableHpaView(source: HpaSource): HpaView {
  return {
    source,
    runId: null,
    status: 'UNAVAILABLE',
    live: false,
    available: false,
    canControl: false,
    startedAt: null,
    updatedAt: new Date().toISOString(),
    cpuUtilization: null,
    targetCpuUtilization: 80,
    desiredReplicas: 0,
    readyReplicas: 0,
    pods: [],
    events: [],
    load: null,
  };
}

function parsePod(value: unknown): HpaPod | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.phase !== 'string') return null;
  const restarts = integer(value.restarts);
  if (restarts === null) return null;
  return {
    name: value.name,
    phase: value.phase,
    ready: value.ready === true,
    restarts,
    startedAt: nullableString(value.startedAt),
    cpuMilli: nullableNumber(value.cpuMilli),
    memoryMi: nullableNumber(value.memoryMi),
    image: typeof value.image === 'string' ? value.image : '',
  };
}

function parseLoad(value: unknown): HpaLoad | null {
  if (!isRecord(value)) return null;
  const workers = integer(value.workers);
  const requests = integer(value.requests);
  const failed = integer(value.failed);
  const avgMs = integer(value.avgMs);
  const maxMs = integer(value.maxMs);
  if (workers === null || requests === null || failed === null || avgMs === null || maxMs === null) return null;
  return { workers, requests, failed, avgMs, maxMs };
}

function parseEvent(value: unknown): HpaEvent | null {
  if (!isRecord(value) || typeof value.phase !== 'string' || typeof value.at !== 'string') return null;
  return { phase: value.phase, at: value.at };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : typeof value === 'string' ? value : null;
}
