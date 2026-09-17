'use client';

import { useRef } from 'react';
import { MermaidDiagrams } from '@/components/MermaidDiagrams';
import type { DomainScenarioRun } from './domainScenarioContract';

const TRAFFIC_FLOWS: Readonly<Record<string, { readonly title: string; readonly summary: string; readonly source: string }>> = {
  BASELINE: { title: '동기 직접 처리 포화', summary: '순간 입력 전체가 API와 DB connection 경로로 들어가 p95와 backlog가 함께 증가합니다.', source: `flowchart LR
  A[600 RPS] --> B[Spring API]
  B --> C[(PostgreSQL)]
  C --> D[220 RPS 처리]
  B -.-> E[대기 380]` },
  RATE_LIMIT: { title: '처리 용량 앞단 보호', summary: 'Redis token 확인으로 허용량만 전달하고 초과 요청은 빠르게 429로 종료합니다.', source: `flowchart LR
  A[600 RPS] --> B{Redis budget}
  B -->|허용 220| C[Spring API]
  B -->|초과 380| D[HTTP 429]
  C --> E[(PostgreSQL)]` },
  QUEUE_BUFFER: { title: '입력과 소비 속도 분리', summary: '접수 이벤트를 Kafka에 보존하고 Consumer가 처리 가능한 속도로 backlog를 해소합니다.', source: `flowchart LR
  A[600 RPS] --> B[Order intake]
  B --> C[(Kafka topic)]
  C -->|240 RPS| D[Consumer]
  C -.-> E[lag 360]` },
  SLOW_CONSUMER: { title: '느린 의존성과 lag 누적', summary: '외부 의존성이 느려지면 입력을 잃지는 않지만 Consumer lag와 복구 시간이 커집니다.', source: `flowchart LR
  A[(Kafka)] --> B[Consumer]
  B -->|120 RPS| C[느린 알림 API]
  A -.-> D[lag 480]
  D --> E[240초 복구]` },
  DUPLICATE_BURST: { title: '중복 요청 조기 제거', summary: '사용자·상품·요청 key를 확인해 고유 주문만 DB 처리 경로로 보냅니다.', source: `flowchart LR
  A[600 요청] --> B{Redis key}
  B -->|고유 180| C[Order API]
  B -->|중복 420| D[최초 결과 재사용]
  C --> E[(PostgreSQL)]` },
  RECOVERY: { title: '입력 종료 뒤 backlog 복구', summary: '추가 입력을 멈추고 Consumer를 두 개로 확장해 lag를 제한 시간 안에 0으로 만듭니다.', source: `flowchart LR
  A[입력 중단] --> B[HPA 1 → 2]
  B --> C[360 RPS 처리]
  C --> D[lag 0]
  D --> E[45초 정상화]` },
};

export function TrafficBurstScenarioFlow({ current, mode }: { readonly current: DomainScenarioRun | null; readonly mode: string }) {
  const scopeRef = useRef<HTMLElement>(null);
  const flow = TRAFFIC_FLOWS[mode] ?? TRAFFIC_FLOWS.BASELINE;
  return (
    <section className="domain-lab-panel partner-flow traffic-flow" ref={scopeRef}>
      <header><span>STEPS</span><h2>트래픽 처리 흐름</h2></header>
      <div className="partner-flow-heading"><strong>{flow.title}</strong><p>{flow.summary}</p></div>
      <div aria-label={`${flow.title}: ${flow.summary}`} className="mermaid" key={mode} role="img">{flow.source}</div>
      <MermaidDiagrams scopeRef={scopeRef} signal={`traffic-flow:${mode}`} />
      {current && <TrafficEvidence run={current} />}
    </section>
  );
}

function TrafficEvidence({ run }: { readonly run: DomainScenarioRun }) {
  return (
    <section className="traffic-evidence" aria-label="최근 트래픽 정책 분석 결과">
      <header><span>ANALYSIS SNAPSHOT</span><strong>PostgreSQL에 저장된 고정 입력 정책 결과</strong></header>
      <dl>
        <Metric label="INPUT" value={`${run.beforeAmount} RPS`} />
        <Metric label="PROCESSED" value={`${run.afterAmount} RPS`} />
        <Metric label="P95" value={`${run.p95Ms} ms`} />
        <Metric label="SHED / DEDUP" value={`${run.rejectedCount}`} />
        <Metric label="QUEUE LAG" value={`${run.queueLag}`} />
        <Metric label="REPLICAS" value={`${run.replicas}`} />
        <Metric label="RECOVERY" value={`${run.recoverySeconds} s`} />
      </dl>
    </section>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
