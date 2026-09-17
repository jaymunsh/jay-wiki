'use client';

import { useState } from 'react';

const ORDER_CODE_TABS = [
  {
    id: 'normal', label: '확정 전환', file: 'DomainScenarioEngine.java',
    reason: '주문 생성, 재고 예약, 결제 승인과 주문 확정의 정상 순서를 정책으로 고정합니다.',
    code: `case "NORMAL" -> result(
    "CONFIRMED",
    "주문·재고·결제 확정",
    1,
    0,
    key,
    step("ORDER_CREATED", "Order", "SUCCESS", "가격 snapshot과 주문을 만들었다."),
    step("STOCK_RESERVED", "Inventory", "SUCCESS", "마지막 재고 한 개를 예약했다."),
    step("PAYMENT_AUTHORIZED", "Payment", "SUCCESS", "결제를 승인했다."),
    step("ORDER_CONFIRMED", "Order", "SUCCESS", "주문을 확정했다.")
);`,
  },
  {
    id: 'race', label: '재고 경합', file: 'DomainScenarioEngine.java',
    reason: '마지막 재고에 동시에 도착한 주문은 한 건만 예약되고 나머지는 품절로 종료되는 정책을 표현합니다.',
    code: `case "LAST_STOCK_RACE" -> result(
    "ONE_CONFIRMED",
    "마지막 재고는 한 주문만 확보",
    1,
    0,
    key,
    step("TWO_ORDERS_CREATED", "Order", "WARNING", "주문 두 건이 도착했다."),
    step("STOCK_LOCKED", "PostgreSQL", "SUCCESS", "재고 갱신 경계를 직렬화했다."),
    step("FIRST_RESERVED", "Inventory", "SUCCESS", "첫 주문이 재고를 예약했다."),
    step("SECOND_REJECTED", "Inventory", "REJECTED", "두 번째 주문은 품절로 종료했다.")
);`,
  },
  {
    id: 'idempotency', label: 'Callback 멱등', file: 'DomainScenarioEngine.java',
    reason: '같은 payment ID의 결제 성공 callback이 반복돼도 주문과 재고를 추가 변경하지 않습니다.',
    code: `case "DUPLICATE_CALLBACK" -> result(
    "IDEMPOTENT",
    "중복 결제 callback을 한 번만 반영",
    1,
    0,
    key,
    step("CALLBACK_RECEIVED", "Payment", "SUCCESS", "첫 callback을 반영했다."),
    step("ORDER_CONFIRMED", "Order", "SUCCESS", "주문을 한 번 확정했다."),
    step("CALLBACK_DUPLICATED", "Payment", "WARNING", "같은 payment ID가 다시 도착했다."),
    step("DUPLICATE_IGNORED", "Order", "SUCCESS", "상태와 재고를 추가 변경하지 않았다.")
);`,
  },
  {
    id: 'compensation', label: '실패 보상', file: 'DomainScenarioEngine.java',
    reason: '주문 확정 실패 뒤 결제 취소와 재고 해제를 역순으로 수행해야 하는 보상 경계를 보여줍니다.',
    code: `case "CONFIRM_FAILURE" -> result(
    "COMPENSATED",
    "확정 실패 후 결제·재고 보상",
    1,
    1,
    key,
    step("STOCK_RESERVED", "Inventory", "SUCCESS", "재고를 예약했다."),
    step("PAYMENT_AUTHORIZED", "Payment", "SUCCESS", "결제를 승인했다."),
    step("CONFIRM_FAILED", "Order", "REJECTED", "주문 확정이 실패했다."),
    step("PAYMENT_CANCELLED", "Payment", "SUCCESS", "승인 결제를 취소했다."),
    step("STOCK_RELEASED", "Inventory", "SUCCESS", "예약 재고를 복원했다.")
);`,
  },
] as const;

type OrderCodeTabId = (typeof ORDER_CODE_TABS)[number]['id'];

export function OrderImplementationEvidence() {
  const [activeId, setActiveId] = useState<OrderCodeTabId>('normal');
  const active = ORDER_CODE_TABS.find((tab) => tab.id === activeId) ?? ORDER_CODE_TABS[0];

  return (
    <section className="partner-code order-code" aria-labelledby="order-code-title">
      <header><div><span>POLICY IMPLEMENTATION</span><h2 id="order-code-title">주문 상태 전이 핵심 코드</h2></div><p>실제 PG·재고 시스템이 아닌, 실행 가능한 정책 모델과 영속 실행 기록입니다.</p></header>
      <div className="partner-code-tabs order-code-tabs" role="tablist" aria-label="주문 구현 코드 선택">
        {ORDER_CODE_TABS.map((tab) => <button aria-selected={tab.id === activeId} className={tab.id === activeId ? 'active' : ''} id={`order-code-tab-${tab.id}`} key={tab.id} onClick={() => setActiveId(tab.id)} role="tab" type="button">{tab.label}</button>)}
      </div>
      <div aria-labelledby={`order-code-tab-${active.id}`} className="partner-code-body" role="tabpanel">
        <aside><span>SOURCE</span><strong>{active.file}</strong><p>{active.reason}</p></aside>
        <pre><code>{active.code}</code></pre>
      </div>
      <footer><span>deterministic policy engine</span><span>PostgreSQL run history</span><span>not a production transaction</span></footer>
      <OrderBoundaryTable />
    </section>
  );
}

function OrderBoundaryTable() {
  return (
    <section className="partner-production" aria-labelledby="order-boundary-title">
      <header><div><span>PRODUCTION BOUNDARY</span><h3 id="order-boundary-title">실서비스 주문 확정에 추가할 조건</h3></div><p>모델링한 정책과 실제 보장 수단을 구분합니다.</p></header>
      <div className="partner-production-table" role="table" aria-label="주문 확정 구현 경계">
        <div className="partner-production-row partner-production-head" role="row"><span role="columnheader">상태</span><span role="columnheader">영역</span><span role="columnheader">현재 모델</span><span role="columnheader">실서비스 보장 수단</span></div>
        <BoundaryRow area="재고 경합" current="한 주문만 예약되는 결과와 단계를 저장" next="조건부 UPDATE 또는 row lock, affected row 검증과 동시성 통합 테스트" />
        <BoundaryRow area="결제 멱등" current="중복 callback을 추가 반영하지 않는 정책" next="payment ID unique constraint, callback inbox와 원문 서명·replay 검증" />
        <BoundaryRow area="원자성" current="주문·재고·결제의 기대 순서를 모델링" next="주문·재고 local transaction, 외부 결제와 outbox 또는 Saga 경계 분리" />
        <BoundaryRow area="보상" current="결제 취소 뒤 재고 해제 순서를 기록" next="보상 자체의 멱등성, 재시도·DLQ·수동 reconciliation과 실패 alert" />
        <BoundaryRow area="예약 만료" current="10분 만료 뒤 재고 복구 결과를 모델링" next="중복 실행에 안전한 scheduler, 분산 lock, 처리 지연과 backlog metric" />
      </div>
    </section>
  );
}

function BoundaryRow({ area, current, next }: { readonly area: string; readonly current: string; readonly next: string }) {
  return <div className="partner-production-row" role="row"><span data-check="MODELED" role="cell">MODELED</span><strong role="cell">{area}</strong><p role="cell">{current}</p><p role="cell">{next}</p></div>;
}
