'use client';

import { useRef } from 'react';
import { MermaidDiagrams } from '@/components/MermaidDiagrams';
import type { DomainScenarioRun } from './domainScenarioContract';

const GIFT_CARD_FLOWS: Readonly<Record<string, { readonly title: string; readonly summary: string; readonly source: string }>> = {
  NORMAL: {
    title: '정상 상품권 사용',
    summary: '사용 요청과 차감 원장을 같은 처리 경계에서 확정하고 현재 잔액을 갱신합니다.',
    source: `flowchart LR
  A[50,000원 잔액] --> B[10,000원 사용]
  B --> C[-10,000원 원장]
  C --> D[(40,000원 잔액)]`,
  },
  DUPLICATE_RETRY: {
    title: '응답 유실 뒤 중복 재전송',
    summary: '같은 idempotency key가 다시 오면 추가 차감하지 않고 최초 사용 결과를 반환합니다.',
    source: `flowchart LR
  A[최초 사용 요청] --> B[-10,000원 원장]
  B -.->|응답 유실| C[동일 key 재전송]
  C --> D{처리 key 조회}
  D -->|기존 결과| E[추가 차감 없음]`,
  },
  CONCURRENT_USE: {
    title: '마지막 잔액 동시 사용',
    summary: '잔액을 직렬화하는 정책으로 두 요청 중 한 건만 마지막 10,000원을 사용합니다.',
    source: `flowchart LR
  A[사용 요청 A] --> C{잔액 10,000원}
  B[사용 요청 B] --> C
  C -->|먼저 확정| D[잔액 0원]
  C -->|나중 요청| E[잔액 부족]`,
  },
  TIMEOUT_RETRY: {
    title: 'Commit 이후 응답 유실',
    summary: '서버 차감은 완료됐지만 응답이 사라진 경우 같은 key로 기존 원장을 조회해 복구합니다.',
    source: `flowchart LR
  A[사용 요청] --> B[차감 Commit]
  B -.->|응답 유실| C[Client Timeout]
  C -->|동일 key 재시도| D[기존 원장 조회]
  D --> E[완료 결과 복구]`,
  },
  CANCEL: {
    title: '사용 취소와 역원장',
    summary: '기존 사용 기록을 삭제하지 않고 반대 금액의 취소 원장을 추가해 잔액을 복구합니다.',
    source: `flowchart LR
  A[-10,000원 사용 원장] --> B[취소 요청]
  B --> C[+10,000원 취소 원장]
  C --> D[(잔액 복구)]`,
  },
};

export function GiftCardScenarioFlow({ current, mode }: { readonly current: DomainScenarioRun | null; readonly mode: string }) {
  const scopeRef = useRef<HTMLElement>(null);
  const flow = GIFT_CARD_FLOWS[mode] ?? GIFT_CARD_FLOWS.NORMAL;

  return (
    <section className="domain-lab-panel partner-flow gift-card-flow" ref={scopeRef}>
      <header><span>STEPS</span><h2>잔액·원장 흐름</h2></header>
      <div className="partner-flow-heading"><strong>{flow.title}</strong><p>{flow.summary}</p></div>
      <div aria-label={`${flow.title}: ${flow.summary}`} className="mermaid" key={mode} role="img">{flow.source}</div>
      <MermaidDiagrams scopeRef={scopeRef} signal={`gift-card-flow:${mode}`} />
      {current && <GiftCardPolicyEvidence run={current} />}
    </section>
  );
}

function GiftCardPolicyEvidence({ run }: { readonly run: DomainScenarioRun }) {
  return (
    <section className="partner-exchange" aria-label="최근 상품권 정책 실행 증거">
      <header><span>LEDGER EVIDENCE</span><strong>PostgreSQL에 저장된 잔액 상태 전이 결과</strong></header>
      <dl>
        <div><dt>RESULT</dt><dd>{run.status}</dd><small>{run.mode}</small></div>
        <div><dt>BALANCE</dt><dd>{formatWon(run.beforeAmount)} → {formatWon(run.afterAmount)}</dd><small>현재 잔액 변화</small></div>
        <div><dt>PROTECTION</dt><dd>{protectionLabel(run.mode)}</dd><small>{run.steps.length}개 처리 단계</small></div>
        <div><dt>REQUEST KEY</dt><dd>{run.idempotencyKey}</dd><small>{run.runId}</small></div>
      </dl>
    </section>
  );
}

function formatWon(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function protectionLabel(mode: string): string {
  const labels: Readonly<Record<string, string>> = {
    NORMAL: '원장 차감',
    DUPLICATE_RETRY: '요청 멱등',
    CONCURRENT_USE: '잔액 직렬화',
    TIMEOUT_RETRY: '기존 결과 복구',
    CANCEL: '역원장',
  };
  return labels[mode] ?? '정책 실행';
}
