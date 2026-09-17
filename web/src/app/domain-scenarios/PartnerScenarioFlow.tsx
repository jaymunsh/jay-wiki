'use client';

import { useRef } from 'react';
import { MermaidDiagrams } from '@/components/MermaidDiagrams';
import type { DomainScenarioRun } from './domainScenarioContract';

const FLOWS: Readonly<Record<string, { readonly title: string; readonly summary: string; readonly source: string }>> = {
  NORMAL: {
    title: '정상 승인 흐름',
    summary: '요청과 응답을 같은 correlation ID로 연결하고 승인 상태를 저장합니다.',
    source: `flowchart LR
  A[Commerce API] -->|서명 요청| B[Spring WebClient]
  B -->|POST approve| C[FastAPI partner]
  C -->|200 APPROVED| B
  B -->|응답 검증| D[(PostgreSQL)]`,
  },
  TIMEOUT_CALLBACK: {
    title: '응답 유실과 Callback 복구',
    summary: 'timeout을 실패로 단정하지 않고 미확정으로 둔 뒤, 별도 callback을 검증해 확정합니다.',
    source: `flowchart LR
  A[Spring WebClient] -->|승인 요청| B[FastAPI partner]
  B -.->|read timeout| C[상태 미확정]
  B -->|지연 callback| D[Webhook]
  D -->|HMAC + timestamp| E{검증}
  E -->|유효| F[(APPROVED 저장)]`,
  },
  RATE_LIMIT: {
    title: '429 제한 재시도',
    summary: '즉시 반복 호출하지 않고 Retry-After를 존중한 뒤 한 번만 다시 시도합니다.',
    source: `flowchart LR
  A[Spring WebClient] -->|1차 요청| B[FastAPI partner]
  B -->|429 + Retry-After| C[1초 Backoff]
  C -->|2차 요청| B
  B -->|200 APPROVED| D[(성공 저장)]`,
  },
  SERVER_ERROR: {
    title: '500 재시도 종료',
    summary: '일시 오류를 제한 횟수만 재시도하고, 모두 실패하면 성공 상태로 변경하지 않습니다.',
    source: `flowchart LR
  A[Spring WebClient] -->|승인 요청| B[FastAPI partner]
  B -->|HTTP 500| C{시도 횟수}
  C -->|3회 미만| A
  C -->|3회 도달| D[RETRY EXHAUSTED]
  D -->|상태 유지| E[(PostgreSQL)]`,
  },
  BAD_SIGNATURE: {
    title: '위조 Callback 차단',
    summary: '승인을 주장하는 callback도 원문 서명이 일치하지 않으면 업무 상태를 변경하지 않습니다.',
    source: `flowchart LR
  A[FastAPI partner] -->|위조 callback| B[Webhook]
  B -->|원문 HMAC 검증| C{서명 일치}
  C -->|아니오| D[REJECTED]
  D -->|상태 변경 차단| E[(PostgreSQL)]`,
  },
};

export function PartnerScenarioFlow({ current, mode }: { readonly current: DomainScenarioRun | null; readonly mode: string }) {
  const scopeRef = useRef<HTMLElement>(null);
  const flow = FLOWS[mode] ?? FLOWS.NORMAL;

  return (
    <section className="domain-lab-panel partner-flow" ref={scopeRef}>
      <header><span>STEPS</span><h2>요청 흐름</h2></header>
      <div className="partner-flow-heading">
        <strong>{flow.title}</strong>
        <p>{flow.summary}</p>
      </div>
      <div aria-label={`${flow.title}: ${flow.summary}`} className="mermaid" key={mode} role="img">
        {flow.source}
      </div>
      <MermaidDiagrams scopeRef={scopeRef} signal={`partner-flow:${mode}`} />
      {current && <PartnerExchangeEvidence run={current} />}
    </section>
  );
}

function PartnerExchangeEvidence({ run }: { readonly run: DomainScenarioRun }) {
  const backoff = run.steps.find((step) => step.action === 'BACKOFF_APPLIED')?.detail;
  const callback = callbackResult(run);

  return (
    <section className="partner-exchange" aria-label="최근 HTTP 전송 증거">
      <header><span>LAST EXCHANGE</span><strong>민감값을 제외한 실제 실행 증거</strong></header>
      <dl>
        <div><dt>REQUEST</dt><dd>POST /partner/approve?mode={run.mode}</dd><small>{run.runId}</small></div>
        <div><dt>RESPONSE</dt><dd>{run.httpStatus || 'TIMEOUT'}</dd><small>{run.elapsedMs}ms</small></div>
        <div><dt>RETRY</dt><dd>{run.attemptCount} attempt{run.attemptCount > 1 ? 's' : ''}</dd><small>{backoff ?? '추가 대기 없음'}</small></div>
        <div><dt>CALLBACK</dt><dd>{callback.label}</dd><small>{callback.detail}</small></div>
      </dl>
    </section>
  );
}

function callbackResult(run: DomainScenarioRun): { readonly label: string; readonly detail: string } {
  if (run.steps.some((step) => step.action === 'SIGNATURE_VERIFIED')) {
    return { label: 'VERIFIED', detail: 'HMAC + timestamp 통과' };
  }
  if (run.steps.some((step) => step.action === 'SIGNATURE_INVALID')) {
    return { label: 'REJECTED', detail: '상태 변경 차단' };
  }
  if (run.steps.some((step) => step.action === 'CALLBACK_MISSING')) {
    return { label: 'MISSING', detail: '대기 시간 내 미수신' };
  }
  return { label: 'N/A', detail: 'callback 미사용' };
}
