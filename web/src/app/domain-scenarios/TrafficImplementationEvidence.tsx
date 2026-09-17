'use client';

import { useState } from 'react';

const TABS = [
  { id: 'limit', label: '빠른 제한', reason: '처리 용량을 넘는 입력은 비싼 업무 로직 전에 종료하는 정책을 모델링합니다.', code: `case "RATE_LIMIT" -> trafficResult(
    "SHED", "초과 요청을 빠르게 제한",
    600, 220, key,
    180, 380, 0, 1, 0,
    step("TOKEN_CHECKED", "Redis", "SUCCESS", "허용 요청 예산을 확인했다."),
    step("EXCESS_REJECTED", "BFF", "REJECTED", "380건을 429로 종료했다."),
    step("CAPACITY_PROTECTED", "Spring API", "SUCCESS", "220 RPS로 보호했다.")
);` },
  { id: 'buffer', label: 'Kafka 버퍼', reason: '입력과 소비 속도를 분리하고 lag와 backlog 해소 시간을 결과로 남깁니다.', code: `case "QUEUE_BUFFER" -> trafficResult(
    "BUFFERED", "Kafka가 순간 입력을 버퍼링",
    600, 240, key,
    210, 0, 360, 1, 90,
    step("EVENT_BUFFERED", "Kafka", "SUCCESS", "접수 이벤트를 topic에 기록했다."),
    step("CONSUMER_DRAINING", "Order consumer", "WARNING", "lag 360이 생겼다."),
    step("BACKLOG_DRAINED", "Kafka", "SUCCESS", "90초 뒤 backlog를 해소했다.")
);` },
  { id: 'dedupe', label: '중복 제거', reason: '동일 구매 key가 폭주해도 고유 요청만 주문·DB 경계로 전달하는 정책입니다.', code: `case "DUPLICATE_BURST" -> trafficResult(
    "DEDUPED", "중복 주문을 처리 경계 앞에서 차단",
    600, 180, key,
    150, 420, 0, 1, 0,
    step("KEY_CHECKED", "Redis", "SUCCESS", "요청 key를 조회했다."),
    step("DUPLICATES_REUSED", "Order API", "SUCCESS", "420건은 최초 결과를 재사용했다."),
    step("UNIQUE_PROCESSED", "PostgreSQL", "SUCCESS", "고유 요청 180건만 처리했다.")
);` },
  { id: 'recovery', label: 'Backlog 복구', reason: '입력 종료 뒤 처리량과 replica 변화가 lag를 얼마나 빨리 해소하는지 비교합니다.', code: `case "RECOVERY" -> trafficResult(
    "RECOVERED", "확장 뒤 backlog를 제한 시간 안에 해소",
    0, 360, key,
    95, 0, 0, 2, 45,
    step("INPUT_STOPPED", "Load model", "SUCCESS", "추가 입력을 중단했다."),
    step("REPLICA_SCALED", "HPA", "SUCCESS", "replica를 1개에서 2개로 늘렸다."),
    step("LAG_DRAINED", "Kafka", "SUCCESS", "45초 뒤 lag 0을 확인했다.")
);` },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function TrafficImplementationEvidence() {
  const [activeId, setActiveId] = useState<TabId>('limit');
  const active = TABS.find((tab) => tab.id === activeId) ?? TABS[0];
  return (
    <section className="partner-code traffic-code" aria-labelledby="traffic-code-title">
      <header><div><span>POLICY IMPLEMENTATION</span><h2 id="traffic-code-title">트래픽 제어 분석 모델의 핵심 분기</h2></div><p>실제 부하 실측이 아닌, 동일 입력에서 정책 차이를 재현하는 결정론적 Spring 모델입니다.</p></header>
      <div className="partner-code-tabs traffic-code-tabs" role="tablist" aria-label="트래픽 정책 코드 선택">
        {TABS.map((tab) => <button aria-selected={tab.id === activeId} className={tab.id === activeId ? 'active' : ''} id={`traffic-tab-${tab.id}`} key={tab.id} onClick={() => setActiveId(tab.id)} role="tab" type="button">{tab.label}</button>)}
      </div>
      <div aria-labelledby={`traffic-tab-${active.id}`} className="partner-code-body" role="tabpanel">
        <aside><span>SOURCE</span><strong>DomainScenarioEngine.java</strong><p>{active.reason}</p></aside>
        <pre><code>{active.code}</code></pre>
      </div>
      <footer><span>bounded synthetic input</span><span>PostgreSQL run history</span><span>not a load-test benchmark</span></footer>
      <TrafficBoundaryTable />
    </section>
  );
}

function TrafficBoundaryTable() {
  return (
    <section className="partner-production" aria-labelledby="traffic-boundary-title">
      <header><div><span>PRODUCTION BOUNDARY</span><h3 id="traffic-boundary-title">실제 대용량 트래픽 검증으로 확장할 조건</h3></div><p>정책 모델과 실측 증거를 분리합니다.</p></header>
      <div className="partner-production-table" role="table" aria-label="트래픽 처리 구현 경계">
        <div className="partner-production-row partner-production-head" role="row"><span role="columnheader">상태</span><span role="columnheader">영역</span><span role="columnheader">현재 모델</span><span role="columnheader">실측 단계</span></div>
        <Boundary area="부하 입력" current="서버에 고정된 600 RPS 분석값" next="격리 환경의 k6 단계 부하와 실행 파라미터·원본 결과 보존" />
        <Boundary area="Admission" current="429 제한과 중복 제거 정책 비교" next="Redis Lua/token bucket 원자성, 사용자·IP·상품별 quota 검증" />
        <Boundary area="Backpressure" current="처리량 차이를 lag와 회복 시간으로 기록" next="실제 Kafka consumer lag, partition 처리량과 rebalance 관측" />
        <Boundary area="Autoscaling" current="replica 1→2 복구 결과 모델링" next="CPU 외 queue lag 기반 scaling, stabilization과 자원 상한 검증" />
        <Boundary area="성능 분석" current="p95와 backlog 해소 시간을 함께 비교" next="p50·p95·p99, 오류율, saturation과 반복 실행 신뢰구간" />
      </div>
    </section>
  );
}

function Boundary({ area, current, next }: { readonly area: string; readonly current: string; readonly next: string }) {
  return <div className="partner-production-row" role="row"><span data-check="MODELED" role="cell">MODELED</span><strong role="cell">{area}</strong><p role="cell">{current}</p><p role="cell">{next}</p></div>;
}
