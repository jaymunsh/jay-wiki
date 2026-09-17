import { NextResponse } from 'next/server';
import { parseOperationsSnapshot, readMatrix, readVector, unavailableSnapshot, type OperationsSnapshot } from '@/lib/operations';

export const dynamic = 'force-dynamic';

const PROMETHEUS_BASE = process.env.PROMETHEUS_INTERNAL_BASE;
const REMOTE_OPERATIONS_URL = process.env.OPERATIONS_REMOTE_URL;
const REQUEST_TIMEOUT_MS = 3_000;

const QUERIES = {
  requestsPerSecond: 'sum(rate(http_server_requests_seconds_count{job="jaywiki-backend"}[5m]))',
  errorRate:
    '(sum(rate(http_server_requests_seconds_count{job="jaywiki-backend",status=~"5.."}[5m])) / clamp_min(sum(rate(http_server_requests_seconds_count{job="jaywiki-backend"}[5m])), 0.001)) or vector(0)',
  p95Seconds:
    'histogram_quantile(0.95, sum(rate(http_server_requests_seconds_bucket{job="jaywiki-backend"}[5m])) by (le))',
  backendUp: 'up{job="jaywiki-backend"}',
  nodeReady: 'min(kube_node_status_condition{condition="Ready",status="true"})',
  runningPods: 'sum(kube_pod_status_phase{namespace=~"backend|frontend|data|obs",phase="Running"})',
  cpuUsage: '1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m]))',
  memoryUsage: '1 - avg(node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
  diskUsage:
    '1 - (node_filesystem_avail_bytes{mountpoint="/",fstype=~"ext4|xfs"} / node_filesystem_size_bytes{mountpoint="/",fstype=~"ext4|xfs"})',
  backupLastSuccessSeconds:
    'max(kube_job_status_completion_time{namespace="data",job_name=~"jaywiki-postgres-backup.*"} * on(namespace,job_name) group_left() (kube_job_status_succeeded{namespace="data",job_name=~"jaywiki-postgres-backup.*"} > 0))',
  kafkaEventsPerSecond: 'sum(rate(jaywiki_kafka_consumer_events_total[5m]))',
  deadLetterEvents: 'sum(jaywiki_kafka_consumer_events_total{status="DLQ"})',
  sagaRunsPerSecond: 'sum(rate(jaywiki_saga_runs_total[5m]))',
  trafficHistory: 'sum(rate(http_server_requests_seconds_count{job="jaywiki-backend"}[1m]))',
} as const;

function prometheusUrl(path: string, params: Record<string, string>): URL {
  const url = new URL(path, `${PROMETHEUS_BASE}/`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function isoTimestamp(seconds: number | null): string | null {
  if (seconds === null) return null;
  const value = new Date(seconds * 1_000);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function remoteOperationsUrl(): URL | null {
  if (!REMOTE_OPERATIONS_URL) return null;

  try {
    const url = new URL(REMOTE_OPERATIONS_URL);
    return url.protocol === 'https:' ? url : null;
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

async function query(path: '/api/v1/query' | '/api/v1/query_range', params: Record<string, string>): Promise<unknown> {
  const response = await fetch(prometheusUrl(path, params), {
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Prometheus ${path} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function scalar(expression: string): Promise<unknown> {
  return query('/api/v1/query', { query: expression });
}

function history(expression: string): Promise<unknown> {
  const end = Math.floor(Date.now() / 1_000);
  return query('/api/v1/query_range', {
    query: expression,
    start: String(end - 30 * 60),
    end: String(end),
    step: '120',
  });
}

async function loadPrometheusSnapshot(): Promise<OperationsSnapshot> {
  try {
    const [requestsPerSecond, errorRate, p95Seconds, backendUp, nodeReady, runningPods, cpuUsage, memoryUsage, diskUsage, backupLastSuccessSeconds, kafkaEventsPerSecond, deadLetterEvents, sagaRunsPerSecond, trafficHistory] =
      await Promise.all([
        scalar(QUERIES.requestsPerSecond),
        scalar(QUERIES.errorRate),
        scalar(QUERIES.p95Seconds),
        scalar(QUERIES.backendUp),
        scalar(QUERIES.nodeReady),
        scalar(QUERIES.runningPods),
        scalar(QUERIES.cpuUsage),
        scalar(QUERIES.memoryUsage),
        scalar(QUERIES.diskUsage),
        scalar(QUERIES.backupLastSuccessSeconds),
        scalar(QUERIES.kafkaEventsPerSecond),
        scalar(QUERIES.deadLetterEvents),
        scalar(QUERIES.sagaRunsPerSecond),
        history(QUERIES.trafficHistory),
      ]);

    const backend = readVector(backendUp);
    const node = readVector(nodeReady);
    const p95 = readVector(p95Seconds);
    return {
      source: 'live',
      updatedAt: new Date().toISOString(),
      traffic: {
        requestsPerSecond: readVector(requestsPerSecond),
        errorRate: readVector(errorRate),
        p95Milliseconds: p95 === null ? null : p95 * 1_000,
        points: readMatrix(trafficHistory),
      },
      events: {
        kafkaEventsPerSecond: readVector(kafkaEventsPerSecond),
        deadLetterEvents: readVector(deadLetterEvents),
        sagaRunsPerSecond: readVector(sagaRunsPerSecond),
      },
      runtime: {
        backendUp: backend === null ? null : backend >= 1,
        nodeReady: node === null ? null : node >= 1,
        runningPods: readVector(runningPods),
        cpuUsage: readVector(cpuUsage),
        memoryUsage: readVector(memoryUsage),
        diskUsage: readVector(diskUsage),
        backupLastSuccessAt: isoTimestamp(readVector(backupLastSuccessSeconds)),
      },
    };
  } catch (error) {
    console.warn('[operations] Prometheus summary is unavailable', error);
    return unavailableSnapshot();
  }
}

async function loadRemoteSnapshot(): Promise<OperationsSnapshot> {
  const url = remoteOperationsUrl();
  if (!url) return unavailableSnapshot();

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Remote operations returned ${response.status}`);

    const remoteSnapshot = parseOperationsSnapshot(await response.json());
    if (!remoteSnapshot || remoteSnapshot.source === 'unavailable') return unavailableSnapshot();
    return parseOperationsSnapshot(remoteSnapshot, 'remote') ?? unavailableSnapshot();
  } catch (error) {
    console.warn('[operations] Remote summary is unavailable', error);
    return unavailableSnapshot();
  }
}

async function loadSnapshot(): Promise<OperationsSnapshot> {
  return PROMETHEUS_BASE ? loadPrometheusSnapshot() : loadRemoteSnapshot();
}

export async function GET() {
  return NextResponse.json(await loadSnapshot(), {
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}
