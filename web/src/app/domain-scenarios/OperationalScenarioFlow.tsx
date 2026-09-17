'use client';

import { useRef } from 'react';
import { MermaidDiagrams } from '@/components/MermaidDiagrams';
import type { DomainScenarioRun } from './domainScenarioContract';

type OperationalSlug = 'coupon-race' | 'settlement-batch' | 'connection-pool' | 'n-plus-one';
type Flow = { readonly title: string; readonly summary: string; readonly source: string };

const FLOWS: Readonly<Record<string, Flow>> = {
  'coupon-race:BASELINE': flow('분리된 조회와 발급', '동시 요청이 같은 잔여 수량을 읽어 한정 수량을 초과합니다.', 'A[120 동시 요청] --> B[잔여 100 조회]\n  B --> C[각자 발급 INSERT]\n  C --> D[120건 발급]'),
  'coupon-race:CONDITIONAL_UPDATE': flow('DB 조건부 갱신', 'affected row가 1인 요청만 발급 성공으로 확정합니다.', 'A[120 요청] --> B{remaining > 0 UPDATE}\n  B -->|100건| C[발급 성공]\n  B -->|20건 0 rows| D[품절]'),
  'coupon-race:REDIS_LUA': flow('Redis 원자 발급', '수량 확인과 차감을 Lua 한 번으로 처리한 뒤 발급 원장을 대조합니다.', 'A[120 요청] --> B{Redis Lua}\n  B -->|허용 100| C[발급 queue]\n  B -->|초과 20| D[품절]\n  C --> E[(발급 원장)]'),
  'coupon-race:DUPLICATE_REQUEST': flow('사용자별 중복 제거', 'campaign·user key로 반복 요청을 최초 결과에 연결합니다.', 'A[120 요청] --> B{campaign user key}\n  B -->|고유 92| C[발급 원장]\n  B -->|중복 28| D[최초 결과]'),
  'settlement-batch:BASELINE_DUPLICATE': flow('실패 뒤 전체 재실행', '처리 위치 없이 같은 날짜를 다시 실행해 일부 거래가 중복됩니다.', 'A[10,000건 시작] --> B[7,500건 후 종료]\n  B --> C[전체 재실행]\n  C --> D[250건 중복]'),
  'settlement-batch:CHECKPOINT_RESUME': flow('Checkpoint 재개', '마지막 성공 cursor 이후의 미처리 범위만 선택합니다.', 'A[cursor 7,500] --> B[미처리 조회]\n  B --> C[2,500건 처리]\n  C --> D[10,000건 일치]'),
  'settlement-batch:IDEMPOTENT_UPSERT': flow('정산 key 멱등성', '거래·정산일 unique key가 전체 재실행의 중복 반영을 차단합니다.', 'A[동일 날짜 재실행] --> B{unique key}\n  B -->|기존 250| C[skip]\n  B -->|미처리| D[upsert]'),
  'settlement-batch:PARTIAL_RETRY': flow('실패 범위 선택 재처리', '실패 partition만 별도 worker로 처리한 뒤 전체 합계를 대조합니다.', 'A[실패 partition] --> B[부분 retry]\n  B --> C[합계 대조]\n  C --> D[정산 완료]'),
  'connection-pool:TX_EXTERNAL_CALL': flow('Transaction 안의 외부 대기', 'DB connection을 잡은 상태에서 네트워크를 기다려 pool이 고갈됩니다.', 'A[Transaction 시작] --> B[(Connection 점유)]\n  B --> C[느린 외부 API]\n  C -.-> D[pending 16]'),
  'connection-pool:BOUNDARY_SPLIT': flow('외부 I/O와 DB 경계 분리', '외부 결과를 받은 뒤 짧은 반영 구간에서만 connection을 사용합니다.', 'A[외부 API] --> B[결과 확인]\n  B --> C[짧은 Transaction]\n  C --> D[(Connection 반환)]'),
  'connection-pool:TIMEOUT': flow('Deadline으로 점유 제한', '느린 호출을 제한 시간에 종료하고 transaction 자원을 반환합니다.', 'A[HTTP 호출] --> B{connect read timeout}\n  B -->|정상| C[DB 반영]\n  B -->|초과| D[fail fast]'),
  'connection-pool:BULKHEAD': flow('외부 연동 Bulkhead', '제휴 호출 동시성을 pool보다 작은 별도 slot으로 격리합니다.', 'A[20 동시 요청] --> B{8 slots}\n  B -->|허용 8| C[Partner API]\n  B -->|초과 12| D[빠른 거절]\n  C --> E[(DB)]'),
  'n-plus-one:N_PLUS_ONE': flow('Lazy loading N+1', '목록 1회 뒤 주문별 연관 조회가 반복돼 SQL이 301회로 증가합니다.', 'A[주문 100건 SQL 1] --> B[상품 SQL 100]\n  B --> C[결제 배송 SQL 200]\n  C --> D[총 301 SQL]'),
  'n-plus-one:FETCH_JOIN': flow('Fetch join과 컬렉션 분리', 'to-one은 join하고 컬렉션은 batch query로 나눠 pagination 위험을 줄입니다.', 'A[주문 + to-one join] --> B[SQL 1]\n  B --> C[컬렉션 batch]\n  C --> D[총 SQL 2]'),
  'n-plus-one:PROJECTION': flow('목록 전용 Projection', '화면에 필요한 컬럼만 선택해 entity graph 없이 한 번에 응답합니다.', 'A[목록 조건] --> B[필요 컬럼 SELECT]\n  B --> C[DTO mapping]\n  C --> D[SQL 1]'),
  'n-plus-one:BATCH_FETCH': flow('연관 ID Batch fetch', '연관 ID를 묶어 query 수가 목록 건수에 비례하지 않도록 제한합니다.', 'A[주문 100건] --> B[연관 ID 수집]\n  B --> C[batch query]\n  C --> D[총 SQL 8]'),
};

export function OperationalScenarioFlow({ current, mode, slug }: { readonly current: DomainScenarioRun | null; readonly mode: string; readonly slug: OperationalSlug }) {
  const scopeRef = useRef<HTMLElement>(null);
  const selected = FLOWS[`${slug}:${mode}`] ?? Object.values(FLOWS)[0];
  return (
    <section className="domain-lab-panel partner-flow operational-flow" ref={scopeRef}>
      <header><span>STEPS</span><h2>문제와 개선 흐름</h2></header>
      <div className="partner-flow-heading"><strong>{selected.title}</strong><p>{selected.summary}</p></div>
      <div aria-label={`${selected.title}: ${selected.summary}`} className="mermaid" key={`${slug}:${mode}`} role="img">{selected.source}</div>
      <MermaidDiagrams scopeRef={scopeRef} signal={`operational-flow:${slug}:${mode}`} />
      {current && <OperationalEvidence run={current} slug={slug} />}
    </section>
  );
}

function OperationalEvidence({ run, slug }: { readonly run: DomainScenarioRun; readonly slug: OperationalSlug }) {
  const labels = metricLabels(slug);
  return (
    <section className="traffic-evidence" aria-label="최근 트러블슈팅 정책 분석 결과">
      <header><span>ANALYSIS SNAPSHOT</span><strong>PostgreSQL에 저장된 정책 실행 결과</strong></header>
      <dl>
        <Metric label={labels.before} value={String(run.beforeAmount)} />
        <Metric label={labels.after} value={String(run.afterAmount)} />
        <Metric label="P95" value={`${run.p95Ms} ms`} />
        <Metric label={labels.rejected} value={String(run.rejectedCount)} />
        <Metric label={labels.lag} value={String(run.queueLag)} />
        <Metric label="WORKERS" value={String(run.replicas)} />
        <Metric label="RECOVERY" value={`${run.recoverySeconds} s`} />
      </dl>
    </section>
  );
}

function flow(title: string, summary: string, body: string): Flow {
  return { title, summary, source: `flowchart LR\n  ${body}` };
}

function metricLabels(slug: OperationalSlug) {
  if (slug === 'coupon-race') return { before: 'LIMIT / REQUEST', after: 'ISSUED', rejected: 'REJECTED / DEDUP', lag: 'OVER ISSUE' };
  if (slug === 'settlement-batch') return { before: 'SOURCE', after: 'SETTLED', rejected: 'SKIPPED', lag: 'DUPLICATED' };
  if (slug === 'connection-pool') return { before: 'POOL SIZE', after: 'MAX ACTIVE', rejected: 'FAST FAIL', lag: 'PENDING' };
  return { before: 'ORDERS', after: 'SQL COUNT', rejected: 'REJECTED', lag: 'EXTRA QUERY' };
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
