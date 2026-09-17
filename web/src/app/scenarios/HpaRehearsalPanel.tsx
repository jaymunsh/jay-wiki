'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { formatKoreanTime } from '@/lib/dateTime';
import { hpaThresholdPercent, type HpaLoad, type HpaPod, type HpaView } from '@/lib/hpaRehearsal';

const STATUS_LABELS: Readonly<Record<string, string>> = {
  IDLE: '대기', STARTING: 'Job 생성', LOADING: '부하 생성', SCALED_OUT: '2 Pod 확장',
  STABILIZING: '축소 안정화', COMPLETED: '완료', FAILED: '실패', CANCELLED: '취소',
  NO_SCALE: '확장 미발생',
  UNAVAILABLE: '로컬 연결 없음',
};

/** y축 눈금. 0 은 캔버스 아래 테두리가 대신한다. */
const SCALE_TICKS = [100, 75, 50, 25] as const;

/** 부하 세기. 16 은 백엔드가 가두는 상한과 같다. */
const WORKER_CHOICES = [2, 4, 8, 12, 16] as const;

export function HpaRehearsalPanel() {
  const [view, setView] = useState<HpaView | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const [workers, setWorkers] = useState(8);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/hpa-rehearsal', { cache: 'no-store' });
      if (!response.ok) throw new Error('HPA 상태를 읽지 못했습니다.');
      const payload = await response.json() as HpaView;
      setView(payload);
      if (payload.cpuUtilization !== null) {
        setSamples((current) => [...current.slice(-39), payload.cpuUtilization as number]);
      }
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'HPA 상태를 읽지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), view?.live ? 2_000 : 10_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load, view?.live]);

  async function control(method: 'POST' | 'DELETE') {
    setPending(true);
    setError('');
    try {
      const url = method === 'POST'
        ? `/api/bff/admin/rehearsals/hpa?workers=${workers}`
        : '/api/bff/admin/rehearsals/hpa';
      const response = await fetch(url, { method });
      const payload = await response.json().catch(() => null) as HpaView | { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload && 'error' in payload && payload.error ? payload.error : '리허설 요청에 실패했습니다.');
      }
      setView({ ...(payload as HpaView), source: 'local' });
      setSamples([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '리허설 요청에 실패했습니다.');
    } finally {
      setPending(false);
    }
  }

  const gradientId = useId().replace(/:/g, '');
  const points = useMemo(() => chartPoints(samples), [samples]);
  const status = view?.status ?? 'UNAVAILABLE';
  const targetCpuUtilization = view?.targetCpuUtilization ?? 80;

  return (
    <section className="hpa-console" aria-labelledby="hpa-console-title">
      <header className="hpa-console-head">
        <div>
          <span>LIVE HPA REHEARSAL</span>
          <h3 id="hpa-console-title">CPU 기준선과 Pod lifecycle</h3>
        </div>
        <div className="hpa-console-state" data-state={status}>
          <i aria-hidden="true" />
          <strong>{view?.source === 'remote' ? 'REMOTE · miniPC · ' : ''}{statusLabel(status, view?.source)}</strong>
        </div>
      </header>

      <div className="hpa-metrics" aria-label="HPA 핵심 지표">
        <Metric label="CPU" value={view?.cpuUtilization == null ? '--' : `${view.cpuUtilization}%`} />
        <Metric label="기준선" value={`${targetCpuUtilization}%`} />
        <Metric label="Ready" value={podCount(view?.readyReplicas ?? 0)} />
        <Metric label="Desired" value={podCount(view?.desiredReplicas ?? 0)} />
      </div>

      <div className="hpa-live-grid">
        <section className="hpa-chart" aria-label="CPU 사용률 추이">
          <header><strong>CPU utilization</strong><span>최근 {samples.length}개 표본</span></header>
          <div className="hpa-chart-canvas">
            <div className="hpa-chart-scale" aria-hidden="true">
              {SCALE_TICKS.map((tick) => <span key={tick} style={{ bottom: `${tick}%` }}><b>{tick}</b></span>)}
            </div>
            <span className="hpa-threshold" style={{ bottom: `${hpaThresholdPercent(targetCpuUtilization)}%` }}><b>{targetCpuUtilization}%</b></span>
            {samples.length > 1 ? (
              <svg aria-hidden="true" preserveAspectRatio="none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-2)" stopOpacity=".3" />
                    <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`M 0,100 L ${points.split(' ').join(' L ')} L 100,100 Z`} fill={`url(#${gradientId})`} />
                <polyline points={points} vectorEffect="non-scaling-stroke" />
              </svg>
            ) : <p>{view?.available
              ? 'CPU 표본을 기다리는 중입니다.'
              : view?.source === 'remote'
                ? 'miniPC의 공개 HPA snapshot을 확인하는 중입니다.'
                : 'Kubernetes 환경에서 실제 지표가 표시됩니다.'}</p>}
          </div>
          <LoadSummary load={view?.load ?? null} />
        </section>

        <section className="hpa-pods" aria-label="Spring API Pod 상태">
          <header><strong>Spring API Pods</strong><span>{view?.readyReplicas ?? 0}/{view?.desiredReplicas ?? 0} Ready</span></header>
          <div>
            {(view?.pods ?? []).map((pod) => <PodCard key={pod.name} pod={pod} />)}
            {view?.pods.length === 0 && <p className="hpa-empty">표시할 Pod 정보가 없습니다.</p>}
          </div>
        </section>
      </div>

      <div className="hpa-timeline" data-empty={(view?.events ?? []).length === 0} aria-label="HPA 실행 타임라인">
        {(view?.events ?? []).map((event) => (
          <div key={`${event.phase}-${event.at}`}><time>{formatTime(event.at)}</time><i /><span>{STATUS_LABELS[event.phase] ?? event.phase}</span></div>
        ))}
        {view?.events.length === 0 && <p>실행 기록이 아직 없습니다.</p>}
      </div>

      {view?.canControl && (
        <div className="hpa-controls">
          <button className="btn btn-primary" disabled={pending || view.live || !view.available} onClick={() => void control('POST')} type="button">
            {pending ? '처리 중' : 'HPA 리허설 실행'}
          </button>
          {view.live && <button className="btn" disabled={pending} onClick={() => void control('DELETE')} type="button">실행 취소</button>}
          <label className="hpa-workers">
            <span>워커</span>
            <select
              disabled={pending || view.live || !view.available}
              onChange={(event) => setWorkers(Number(event.target.value))}
              value={workers}
            >
              {WORKER_CHOICES.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
            </select>
          </label>
          <span>관리자 전용 · 180초 · 최대 2 Pods</span>
        </div>
      )}
      {error && <p className="hpa-error" role="alert">{error}</p>}
      <p className="hpa-boundary">같은 miniPC 안의 수평 확장이며, 노드 장애 고가용성을 의미하지 않습니다.</p>
    </section>
  );
}

function LoadSummary({ load }: { readonly load: HpaLoad | null }) {
  if (load === null) {
    return <p className="hpa-load" data-empty="true">부하 Job 이 집계를 내보내면 보낸 건수와 응답 시간이 표시됩니다.</p>;
  }
  return (
    <p className="hpa-load">
      워커 {load.workers} · 보낸 요청 {load.requests.toLocaleString('ko-KR')}건
      {load.failed > 0 && <> · 실패 {load.failed.toLocaleString('ko-KR')}건</>}
      {' '}· 평균 {load.avgMs}ms · 최대 {load.maxMs}ms
    </p>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function PodCard({ pod }: { readonly pod: HpaPod }) {
  return (
    <article className="hpa-pod" data-ready={pod.ready}>
      <header><strong>{pod.name}</strong><span>{pod.ready ? 'Ready' : pod.phase}</span></header>
      <dl>
        <div><dt>CPU</dt><dd>{pod.cpuMilli == null ? '--' : `${pod.cpuMilli}m`}</dd></div>
        <div><dt>Memory</dt><dd>{pod.memoryMi == null ? '--' : `${pod.memoryMi}Mi`}</dd></div>
        <div><dt>Restart</dt><dd>{pod.restarts}</dd></div>
        <div><dt>Started</dt><dd>{pod.startedAt ? formatTime(pod.startedAt) : '--'}</dd></div>
      </dl>
      {pod.image && <code>{pod.image}</code>}
    </article>
  );
}

function podCount(count: number) {
  return `${count} ${count === 1 ? 'Pod' : 'Pods'}`;
}

function chartPoints(samples: readonly number[]) {
  return samples.map((value, index) => {
    const x = samples.length === 1 ? 0 : index / (samples.length - 1) * 100;
    return `${x.toFixed(2)},${Math.max(0, 100 - Math.min(value, 100)).toFixed(2)}`;
  }).join(' ');
}

function formatTime(value: string) {
  return formatKoreanTime(value, { seconds: true });
}

function statusLabel(status: string, source: HpaView['source'] | undefined) {
  if (status === 'UNAVAILABLE' && source === 'remote') return '연결 없음';
  return STATUS_LABELS[status] ?? status;
}
