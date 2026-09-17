'use client';

import { useRef } from 'react';
import { MermaidDiagrams } from '@/components/MermaidDiagrams';
import type { DomainScenarioRun } from './domainScenarioContract';

const ORDER_FLOWS: Readonly<Record<string, { readonly title: string; readonly summary: string; readonly source: string }>> = {
  NORMAL: {
    title: '정상 주문 확정',
    summary: '가격을 고정한 주문이 재고 예약과 결제 승인을 거쳐 확정됩니다.',
    source: `flowchart LR
  A[주문 생성] --> B[재고 예약]
  B --> C[결제 승인]
  C --> D[주문 확정]
  D --> E[(판매 재고 반영)]`,
  },
  LAST_STOCK_RACE: {
    title: '마지막 재고 경합',
    summary: '동시에 들어온 두 주문 가운데 한 주문만 마지막 재고를 예약합니다.',
    source: `flowchart LR
  A[주문 A] --> C{재고 1개}
  B[주문 B] --> C
  C -->|먼저 확보| D[예약 성공]
  C -->|나중 요청| E[품절 종료]`,
  },
  DUPLICATE_CALLBACK: {
    title: '중복 결제 Callback',
    summary: '같은 payment ID의 callback이 반복되어도 주문은 한 번만 확정됩니다.',
    source: `flowchart LR
  A[결제 Callback 1] --> B{payment ID}
  B -->|최초| C[주문 확정]
  D[결제 Callback 2] --> B
  B -->|중복| E[추가 변경 없음]`,
  },
  CONFIRM_FAILURE: {
    title: '주문 확정 실패와 보상',
    summary: '재고와 결제를 확보한 뒤 확정이 실패하면 역순으로 결제와 예약을 복구합니다.',
    source: `flowchart LR
  A[재고 예약] --> B[결제 승인]
  B --> C{주문 확정}
  C -->|실패| D[결제 취소]
  D --> E[재고 해제]
  E --> F[(보상 완료)]`,
  },
  RESERVATION_EXPIRED: {
    title: '미결제 예약 만료',
    summary: '결제 callback이 오지 않은 예약을 만료 처리해 판매 가능 재고로 되돌립니다.',
    source: `flowchart LR
  A[주문 생성] --> B[재고 예약]
  B -.->|결제 미수신| C[10분 만료]
  C --> D[예약 주문 취소]
  D --> E[(재고 복구)]`,
  },
};

export function OrderScenarioFlow({ current, mode }: { readonly current: DomainScenarioRun | null; readonly mode: string }) {
  const scopeRef = useRef<HTMLElement>(null);
  const flow = ORDER_FLOWS[mode] ?? ORDER_FLOWS.NORMAL;

  return (
    <section className="domain-lab-panel partner-flow order-flow" ref={scopeRef}>
      <header><span>STEPS</span><h2>주문 흐름</h2></header>
      <div className="partner-flow-heading"><strong>{flow.title}</strong><p>{flow.summary}</p></div>
      <div aria-label={`${flow.title}: ${flow.summary}`} className="mermaid" key={mode} role="img">{flow.source}</div>
      <MermaidDiagrams scopeRef={scopeRef} signal={`order-flow:${mode}`} />
      {current && <OrderPolicyEvidence run={current} />}
    </section>
  );
}

function OrderPolicyEvidence({ run }: { readonly run: DomainScenarioRun }) {
  return (
    <section className="partner-exchange" aria-label="최근 주문 정책 실행 증거">
      <header><span>POLICY EVIDENCE</span><strong>PostgreSQL에 저장된 상태 전이 결과</strong></header>
      <dl>
        <div><dt>ORDER STATE</dt><dd>{run.status}</dd><small>{run.mode}</small></div>
        <div><dt>INVENTORY</dt><dd>{run.beforeAmount} → {run.afterAmount}</dd><small>판매 가능 재고</small></div>
        <div><dt>PROTECTION</dt><dd>{protectionLabel(run.mode)}</dd><small>{run.steps.length}개 처리 단계</small></div>
        <div><dt>REQUEST KEY</dt><dd>{run.idempotencyKey}</dd><small>{run.runId}</small></div>
      </dl>
    </section>
  );
}

function protectionLabel(mode: string): string {
  const labels: Readonly<Record<string, string>> = {
    NORMAL: '확정 전환',
    LAST_STOCK_RACE: '경합 직렬화',
    DUPLICATE_CALLBACK: 'payment ID 멱등',
    CONFIRM_FAILURE: '역순 보상',
    RESERVATION_EXPIRED: '만료 회수',
  };
  return labels[mode] ?? '정책 실행';
}
