export type OperationsSource = 'live' | 'remote' | 'unavailable';

export type OperationsSnapshot = {
  readonly source: OperationsSource;
  readonly updatedAt: string;
  readonly traffic: {
    readonly requestsPerSecond: number | null;
    readonly errorRate: number | null;
    readonly p95Milliseconds: number | null;
    readonly points: readonly number[];
  };
  readonly events: {
    readonly kafkaEventsPerSecond: number | null;
    readonly deadLetterEvents: number | null;
    readonly sagaRunsPerSecond: number | null;
  };
  readonly runtime: {
    readonly backendUp: boolean | null;
    readonly nodeReady: boolean | null;
    readonly runningPods: number | null;
    readonly cpuUsage: number | null;
    readonly memoryUsage: number | null;
    readonly diskUsage: number | null;
    readonly backupLastSuccessAt: string | null;
  };
};

type PrometheusValue = [number, string];

type PrometheusVector = {
  readonly status: 'success';
  readonly data: {
    readonly resultType: 'vector';
    readonly result: readonly { readonly value: PrometheusValue }[];
  };
};

type PrometheusMatrix = {
  readonly status: 'success';
  readonly data: {
    readonly resultType: 'matrix';
    readonly result: readonly { readonly values: readonly PrometheusValue[] }[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function operationsSource(value: unknown): OperationsSource | null {
  if (value === 'live' || value === 'remote' || value === 'unavailable') return value;
  return null;
}

function nullableNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableBoolean(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key];
  return typeof value === 'boolean' ? value : null;
}

function nullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function numberArray(record: Record<string, unknown>, key: string): readonly number[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function numericValue(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPrometheusValue(value: unknown): value is PrometheusValue {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'string';
}

export function readVector(payload: unknown): number | null {
  if (!isRecord(payload) || payload.status !== 'success' || !isRecord(payload.data) || payload.data.resultType !== 'vector') {
    return null;
  }

  const result = payload.data.result;
  if (!Array.isArray(result) || result.length === 0) return null;

  const values = result.flatMap((sample) => {
    if (!isRecord(sample) || !isPrometheusValue(sample.value)) return [];
    const value = numericValue(sample.value[1]);
    return value === null ? [] : [value];
  });

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function readMatrix(payload: unknown): readonly number[] {
  if (!isRecord(payload) || payload.status !== 'success' || !isRecord(payload.data) || payload.data.resultType !== 'matrix') {
    return [];
  }

  const result = payload.data.result;
  if (!Array.isArray(result) || result.length === 0) return [];

  const samples = result[0];
  if (!isRecord(samples) || !Array.isArray(samples.values)) return [];

  return samples.values.flatMap((sample) => {
    if (!isPrometheusValue(sample)) return [];
    const value = numericValue(sample[1]);
    return value === null ? [] : [value];
  });
}

export function parseOperationsSnapshot(payload: unknown, sourceOverride?: OperationsSource): OperationsSnapshot | null {
  if (!isRecord(payload)) return null;

  const source = sourceOverride ?? operationsSource(payload.source);
  const updatedAt = payload.updatedAt;
  const traffic = payload.traffic;
  const events = payload.events;
  const runtime = payload.runtime;
  if (
    source === null ||
    typeof updatedAt !== 'string' ||
    !isRecord(traffic) ||
    !isRecord(events) ||
    !isRecord(runtime)
  ) {
    return null;
  }

  return {
    source,
    updatedAt,
    traffic: {
      requestsPerSecond: nullableNumber(traffic, 'requestsPerSecond'),
      errorRate: nullableNumber(traffic, 'errorRate'),
      p95Milliseconds: nullableNumber(traffic, 'p95Milliseconds'),
      points: numberArray(traffic, 'points'),
    },
    events: {
      kafkaEventsPerSecond: nullableNumber(events, 'kafkaEventsPerSecond'),
      deadLetterEvents: nullableNumber(events, 'deadLetterEvents'),
      sagaRunsPerSecond: nullableNumber(events, 'sagaRunsPerSecond'),
    },
    runtime: {
      backendUp: nullableBoolean(runtime, 'backendUp'),
      nodeReady: nullableBoolean(runtime, 'nodeReady'),
      runningPods: nullableNumber(runtime, 'runningPods'),
      cpuUsage: nullableNumber(runtime, 'cpuUsage'),
      memoryUsage: nullableNumber(runtime, 'memoryUsage'),
      diskUsage: nullableNumber(runtime, 'diskUsage'),
      backupLastSuccessAt: nullableString(runtime, 'backupLastSuccessAt'),
    },
  };
}

export function unavailableSnapshot(updatedAt = new Date().toISOString()): OperationsSnapshot {
  return {
    source: 'unavailable',
    updatedAt,
    traffic: { requestsPerSecond: null, errorRate: null, p95Milliseconds: null, points: [] },
    events: { kafkaEventsPerSecond: null, deadLetterEvents: null, sagaRunsPerSecond: null },
    runtime: {
      backendUp: null,
      nodeReady: null,
      runningPods: null,
      cpuUsage: null,
      memoryUsage: null,
      diskUsage: null,
      backupLastSuccessAt: null,
    },
  };
}

export type { PrometheusMatrix, PrometheusVector };
