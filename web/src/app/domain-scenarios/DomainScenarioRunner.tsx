'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatKoreanTime } from '@/lib/dateTime';
import { parseDomainScenarioRun, type DomainScenarioRun } from './domainScenarioContract';
import type { DomainScenarioConfig } from './domainScenarioConfigs';
import { PartnerImplementationEvidence } from './PartnerImplementationEvidence';
import { PartnerScenarioFlow } from './PartnerScenarioFlow';
import { OrderImplementationEvidence } from './OrderImplementationEvidence';
import { OrderScenarioFlow } from './OrderScenarioFlow';
import { GiftCardImplementationEvidence } from './GiftCardImplementationEvidence';
import { GiftCardScenarioFlow } from './GiftCardScenarioFlow';
import { TrafficBurstScenarioFlow } from './TrafficBurstScenarioFlow';
import { TrafficImplementationEvidence } from './TrafficImplementationEvidence';
import { OperationalScenarioFlow } from './OperationalScenarioFlow';
import { PracticeScenarioFlow } from './PracticeScenarioFlow';
import { SpreadsheetExportPanel } from './SpreadsheetExportPanel';

export function DomainScenarioRunner({ config }: { readonly config: DomainScenarioConfig }) {
  const [mode, setMode] = useState(config.modes[0]?.value ?? 'NORMAL');
  const [current, setCurrent] = useState<DomainScenarioRun | null>(null);
  const [recent, setRecent] = useState<readonly DomainScenarioRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeMode = useMemo(() => config.modes.find((item) => item.value === mode), [config.modes, mode]);

  useEffect(() => {
    let active = true;
    void loadRecent(config.slug).then((items) => {
      if (active) setRecent(items);
    });
    return () => {
      active = false;
    };
  }, [config.slug]);

  async function runScenario(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bff/domain-scenarios/${config.slug}/runs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const parsed = response.ok ? parseDomainScenarioRun(await response.json()) : null;
      if (!parsed) {
        setError('실행 결과를 읽지 못했습니다. 백엔드 상태를 확인하세요.');
        return;
      }
      setCurrent(parsed);
      setRecent(await loadRecent(config.slug));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '시나리오 실행 중 알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  function selectMode(nextMode: string): void {
    setMode(nextMode);
    setCurrent(null);
    setError(null);
  }

  function selectRecent(item: DomainScenarioRun): void {
    setMode(item.mode);
    setCurrent(item);
    setError(null);
  }

  return (
    <section className="scenario-runner" aria-labelledby="scenario-runner-title">
      <header className="scenario-runner-head">
        <div>
          <span>RUN</span>
          <h2 id="scenario-runner-title">직접 실행해 비교한다</h2>
          {/* 실행 배지(MOCK/LIVE)가 성격을 말하고, 여기서는 이 시나리오에 한정된 사실만 적는다. */}
          <p>{config.slug === 'partner-api'
            ? 'Spring이 FastAPI simulator와 실제 HTTP로 통신하고 PostgreSQL에 실행 증거를 남깁니다. 아래 HTTP status·attempts·elapsed는 이번 실행에서 측정한 값입니다.'
            : '아래 단계와 숫자는 실행 결과가 아니라 미리 정의한 흐름과 고정 입력입니다. 대안을 같은 기준으로 비교하려고 값을 고정했고, 실제 처리량이나 지연을 주장하지 않습니다.'}</p>
        </div>
        <div className="domain-lab-status" data-status={current?.status ?? 'READY'}>
          <span>RUN STATUS</span>
          <strong>{current?.status ?? 'READY'}</strong>
        </div>
      </header>

        <section className="domain-lab-grid">
          <section className="domain-lab-panel domain-lab-controls">
            <header><span>MODE</span><h2>실행 모드</h2></header>
            <div className="domain-lab-modes">
              {config.modes.map((item) => (
                <button aria-pressed={item.value === mode} className={item.value === mode ? 'active' : ''} disabled={loading} key={item.value} onClick={() => selectMode(item.value)} type="button">
                  <strong>{item.label}</strong><span>{item.description}</span>
                </button>
              ))}
            </div>
            <div className="domain-lab-mode-note"><span>선택</span><p>{activeMode?.description}</p></div>
            <button className="btn btn-primary domain-lab-run" disabled={loading} onClick={runScenario} type="button">
              {loading ? '실행 중' : '리허설 실행'}
            </button>
            {error && <p className="domain-lab-error">{error}</p>}
          </section>

          <section className="domain-lab-panel domain-lab-result">
            <header><span>RESULT</span><h2>상태 변화</h2></header>
            {current ? (
              <>
                <p className="domain-lab-headline">{current.headline}</p>
                {config.slug === 'partner-api' ? (
                  <div className="domain-lab-metrics">
                    <div><span>HTTP STATUS</span><strong>{current.httpStatus || 'TIMEOUT'}</strong></div>
                    <div><span>ATTEMPTS</span><strong>{current.attemptCount}</strong></div>
                    <div><span>ELAPSED</span><strong>{current.elapsedMs}ms</strong></div>
                  </div>
                ) : (
                  <div className="domain-lab-metrics">
                    <div><span>{activeMode?.beforeLabel ?? config.beforeLabel ?? 'BEFORE'} · {activeMode?.valueLabel ?? config.valueLabel}</span><strong>{formatValue(current.beforeAmount, activeMode?.valueUnit ?? config.valueUnit)}</strong></div>
                    <div><span>{activeMode?.afterLabel ?? config.afterLabel ?? 'AFTER'} · {activeMode?.valueLabel ?? config.valueLabel}</span><strong>{formatValue(current.afterAmount, activeMode?.valueUnit ?? config.valueUnit)}</strong></div>
                    <div><span>STEPS</span><strong>{current.steps.length}</strong></div>
                  </div>
                )}
                <p className="domain-lab-metric-note">
                  {config.slug === 'partner-api'
                    ? '이번 실행에서 측정한 값입니다.'
                    : '비교를 위한 고정 입력값입니다. 측정값이 아닙니다.'}
                </p>
                <dl className="domain-lab-meta">
                  <div><dt>run</dt><dd>{current.runId}</dd></div>
                  <div><dt>idempotency</dt><dd>{current.idempotencyKey}</dd></div>
                </dl>
              </>
            ) : <div className="domain-lab-empty">모드를 선택하고 리허설을 실행하세요.</div>}
          </section>
        </section>

        {config.slug === 'partner-api' && <PartnerScenarioFlow current={current} mode={mode} />}
        {config.slug === 'order-confirmation' && <OrderScenarioFlow current={current} mode={mode} />}
        {config.slug === 'gift-card' && <GiftCardScenarioFlow current={current} mode={mode} />}
        {config.slug === 'traffic-burst' && <TrafficBurstScenarioFlow current={current} mode={mode} />}
        {isOperationalSlug(config.slug) && <OperationalScenarioFlow current={current} mode={mode} slug={config.slug} />}
        {isPracticeSlug(config.slug) && <PracticeScenarioFlow current={current} mode={mode} slug={config.slug} />}
        {config.slug === 'spreadsheet-operations' && <SpreadsheetExportPanel />}

        <section className="domain-lab-panel domain-lab-timeline">
          <header><span>TIMELINE</span><h2>처리 타임라인</h2></header>
          {current ? <ol>{current.steps.map((step) => (
            <li data-status={step.status} key={step.sequence}>
              <span className="domain-lab-sequence">{String(step.sequence).padStart(2, '0')}</span>
              <div><small>{step.actor}</small><strong>{step.action}</strong><p>{step.detail}</p></div>
              <em>{step.status}</em>
            </li>
          ))}</ol> : <div className="domain-lab-empty">실행 결과가 타임라인으로 표시됩니다.</div>}
        </section>

        {config.slug === 'partner-api' && <PartnerImplementationEvidence />}
        {config.slug === 'order-confirmation' && <OrderImplementationEvidence />}
        {config.slug === 'gift-card' && <GiftCardImplementationEvidence />}
        {config.slug === 'traffic-burst' && <TrafficImplementationEvidence />}

        {/* 라벨이 없어서 뒤에 오는 JUDGEMENT 와 구별이 안 됐다. 제목+문단 3열이라 모양까지 같다.
            원리는 어디서나 통하는 일반론이고 판단은 이 프로젝트가 고른 것이라, 층위가 다르다는 걸
            머리글이 말해 줘야 한다. */}
        <div className="domain-lab-explain">
          <section aria-labelledby="principle-title">
            <header className="domain-lab-explain-head">
              <span>PRINCIPLE</span>
              <h2 id="principle-title">이 리허설이 보여주는 원리</h2>
            </header>
            <div className="domain-lab-principles">
              {config.principles.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}
            </div>
          </section>
          {/* 원리·판단과 달리 이건 읽는 사람이 자기 코드에 던지는 질문이다. 그래서 남긴다. */}
          <section className="domain-lab-checklist"><div><span>REVIEW CHECKLIST</span><h2>실무에서 다시 확인할 조건</h2></div><ul>{config.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
        </div>

        <section className="domain-lab-panel domain-lab-recent">
          <header><span>HISTORY</span><h2>최근 실행</h2></header>
          <div>{recent.map((item) => <button data-status={item.status} key={item.runId} onClick={() => selectRecent(item)} type="button"><strong>{item.status}</strong><span>{item.mode}</span><time>{formatTime(item.createdAt)}</time></button>)}{recent.length === 0 && <div className="domain-lab-empty">최근 실행이 없습니다.</div>}</div>
        </section>
    </section>
  );
}

function formatValue(value: number, unit: string): string {
  if (unit === '원') return `${value.toLocaleString('ko-KR')}원`;
  if (unit === '개') return `${value}개`;
  if (unit === 'RPS') return `${value} RPS`;
  if (unit === '건') return `${value.toLocaleString('ko-KR')}건`;
  if (unit === '회') return `${value.toLocaleString('ko-KR')}회`;
  if (unit === 'MB') return `${value.toLocaleString('ko-KR')} MB`;
  if (unit === 'ms') return `${value.toLocaleString('ko-KR')} ms`;
  if (unit === 'KB') return value >= 1_024 ? `${(value / 1_024).toFixed(1)} MB` : `${value.toLocaleString('ko-KR')} KB`;
  return value === 1 ? '확정' : '미확정';
}

type OperationalSlug = 'coupon-race' | 'settlement-batch' | 'connection-pool' | 'n-plus-one';
export type PracticeSlug = 'data-correction' | 'privacy-lifecycle' | 'spreadsheet-operations' | 'business-metrics' | 'notification-delivery' | 'maintenance-mode' | 'image-upload-pipeline';

function isOperationalSlug(slug: DomainScenarioConfig['slug']): slug is OperationalSlug {
  return ['coupon-race', 'settlement-batch', 'connection-pool', 'n-plus-one'].includes(slug);
}

function isPracticeSlug(slug: DomainScenarioConfig['slug']): slug is PracticeSlug {
  return ['data-correction', 'privacy-lifecycle', 'spreadsheet-operations', 'business-metrics', 'notification-delivery', 'maintenance-mode', 'image-upload-pipeline'].includes(slug);
}


function formatTime(value: string): string {
  return formatKoreanTime(value);
}

async function loadRecent(slug: DomainScenarioConfig['slug']): Promise<readonly DomainScenarioRun[]> {
  const response = await fetch(`/api/bff/domain-scenarios/${slug}/runs?size=8`, { cache: 'no-store' });
  if (!response.ok) return [];
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload.map(parseDomainScenarioRun).filter((item): item is DomainScenarioRun => item !== null);
}
