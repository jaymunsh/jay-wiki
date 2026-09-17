'use client';

import { useEffect, useState } from 'react';
import { formatKoreanTime } from '@/lib/dateTime';
import { parseOperationsSnapshot, type OperationsSnapshot } from '@/lib/operations';
import { GRAFANA_ORIGIN } from '@/lib/siteConfig';
import { Sparkline } from './Sparkline';

const POLL_INTERVAL_MS = 15_000;

function unavailable(updatedAt = new Date().toISOString()): OperationsSnapshot {
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

function format(value: number | null, suffix = '', digits = 1): string {
  return value === null ? '--' : `${value.toFixed(digits)}${suffix}`;
}

function formatPercent(value: number | null): string {
  return value === null ? '--' : `${(value * 100).toFixed(value * 100 < 1 ? 2 : 1)}%`;
}

function formatTime(value: string): string {
  return formatKoreanTime(value, { seconds: true });
}

/* 이 화면은 지표를 주기적으로 다시 그린다. 포매터를 그때마다 새로 만들지 않는다. */
const KOREAN_DATE_TIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatKoreanDateTime(value: string | null): string {
  if (!value) return '--';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '--' : KOREAN_DATE_TIME.format(parsed);
}

function grafanaExploreUrl(dataSource: 'loki' | 'tempo'): string {
  const url = new URL('/explore', GRAFANA_ORIGIN);
  const pane = dataSource === 'loki'
    ? {
        datasource: 'loki',
        queries: [{ refId: 'A', expr: '{namespace="backend"}' }],
        range: { from: 'now-1h', to: 'now' },
      }
    : {
        datasource: 'tempo',
        queries: [],
        range: { from: 'now-1h', to: 'now' },
      };
  url.searchParams.set('schemaVersion', '1');
  url.searchParams.set('panes', JSON.stringify({ [dataSource]: pane }));
  return url.toString();
}

const GRAFANA_DESTINATIONS = [
  { label: 'Metrics', href: GRAFANA_ORIGIN },
  { label: 'Logs', href: grafanaExploreUrl('loki') },
  { label: 'Traces', href: grafanaExploreUrl('tempo') },
] as const;

export function LiveOperations() {
  const [snapshot, setSnapshot] = useState<OperationsSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/operations', { cache: 'no-store' });
        if (!response.ok) throw new Error(`operations ${response.status}`);
        const next = parseOperationsSnapshot(await response.json());
        if (!next) throw new Error('operations response is invalid');
        if (active) setSnapshot(next);
      } catch {
        if (active) setSnapshot(unavailable());
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const current = snapshot ?? unavailable('');
  // 첫 응답 전에는 '연결 대기'가 아니라 '읽는 중'이다. 둘을 같은 말로 쓰면 죽은 화면처럼 보인다.
  const loading = snapshot === null;
  const statusLabel = loading
    ? 'PROMETHEUS 읽는 중'
    : current.source === 'live'
      ? 'PROMETHEUS LIVE'
      : current.source === 'remote'
        ? 'REMOTE · miniPC LIVE'
        : 'PROMETHEUS 연결 대기';
  const sourceLabel = current.source === 'remote' ? 'remote aggregate API' : 'Prometheus aggregate only';
  const backendLabel = current.runtime.backendUp === null ? '확인 대기' : current.runtime.backendUp ? '정상' : '확인 필요';
  const nodeLabel = current.runtime.nodeReady === null ? '확인 대기' : current.runtime.nodeReady ? 'Ready' : 'NotReady';

  return (
    <section className={`live-operations${loading ? ' is-loading' : ''}`} aria-labelledby="live-operations-title">
      <header className="live-operations-head">
        <div>
          <span>LIVE OPERATIONS</span>
          <h2 id="live-operations-title">운영 신호 요약</h2>
          <p>Prometheus에서 선별한 공개 요약입니다. 원본 대시보드, 로그와 trace는 인증된 Grafana에서 확인합니다.</p>
        </div>
        <div className={`operations-live-state ${current.source}`} aria-live="polite">
          <i aria-hidden="true" />
          <span>{statusLabel}</span>
          <time dateTime={current.updatedAt || undefined}>{current.updatedAt ? formatTime(current.updatedAt) : '--:--:--'}</time>
        </div>
      </header>

      <div className="operations-layout">
            <section className="operations-traffic" aria-labelledby="operations-traffic-title">
              <div className="operations-section-head">
                <div><span>TRAFFIC</span><h3 id="operations-traffic-title">요청 흐름</h3></div>
                <strong>{format(current.traffic.requestsPerSecond, ' req/s', 2)}</strong>
              </div>
              <Sparkline points={current.traffic.points} label="최근 30분 요청률 추이" />
              <div className="operations-stat-row">
                <Metric label="5xx 비율" value={formatPercent(current.traffic.errorRate)} tone={current.traffic.errorRate !== null && current.traffic.errorRate > 0 ? 'danger' : 'normal'} />
                <Metric label="p95 응답시간" value={format(current.traffic.p95Milliseconds, ' ms', 0)} />
                <Metric label="조회 범위" value="30 min" />
              </div>
            </section>

            <section className="operations-flow" aria-labelledby="operations-flow-title">
              <div className="operations-section-head"><div><span>EVENT FLOW</span><h3 id="operations-flow-title">Kafka · Saga</h3></div></div>
              <dl>
                <Metric label="소비 이벤트" value={format(current.events.kafkaEventsPerSecond, ' /s', 2)} />
                <Metric label="DLQ 누적" value={format(current.events.deadLetterEvents, '', 0)} tone={current.events.deadLetterEvents !== null && current.events.deadLetterEvents > 0 ? 'danger' : 'normal'} />
                <Metric label="Saga 실행" value={format(current.events.sagaRunsPerSecond, ' /s', 2)} />
              </dl>
            </section>

            <section className="operations-runtime" aria-labelledby="operations-runtime-title">
              <div className="operations-section-head"><div><span>RUNTIME</span><h3 id="operations-runtime-title">miniPC · k3s</h3></div></div>
              <dl>
                <Metric label="Node" value={nodeLabel} tone={current.runtime.nodeReady ? 'success' : current.runtime.nodeReady === false ? 'danger' : 'normal'} />
                <Metric label="Spring API" value={backendLabel} tone={current.runtime.backendUp ? 'success' : current.runtime.backendUp === false ? 'danger' : 'normal'} />
                <Metric label="Running Pod" value={format(current.runtime.runningPods, '', 0)} />
                <Metric label="CPU / Memory" value={`${formatPercent(current.runtime.cpuUsage)} / ${formatPercent(current.runtime.memoryUsage)}`} />
                <Metric label="Disk 사용량" value={formatPercent(current.runtime.diskUsage)} />
              </dl>
            </section>

            <section className="operations-recovery" aria-labelledby="operations-recovery-title">
              <div className="operations-section-head"><div><span>RECOVERY</span><h3 id="operations-recovery-title">백업 상태</h3></div></div>
              <dl>
                <Metric label="마지막 성공" value={formatKoreanDateTime(current.runtime.backupLastSuccessAt)} tone={current.runtime.backupLastSuccessAt ? 'success' : 'normal'} />
                <Metric label="정기 실행" value="03:17 KST" />
                <Metric label="보관 위치" value="PVC" />
              </dl>
            </section>
      </div>

      <footer className="live-operations-foot">
        <span>15초 간격 갱신 · {sourceLabel}</span>
        <div className="operations-grafana-links" aria-label="Grafana 세부 분석">
          {GRAFANA_DESTINATIONS.map((item) => (
            <a key={item.label} href={item.href} target="_blank" rel="noreferrer">
              {item.label} <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </footer>
    </section>
  );
}

function Metric({ label, value, tone = 'normal' }: { readonly label: string; readonly value: string; readonly tone?: 'normal' | 'success' | 'danger' }) {
  return <div className={`operations-metric ${tone}`}><dt>{label}</dt><dd>{value}</dd></div>;
}
