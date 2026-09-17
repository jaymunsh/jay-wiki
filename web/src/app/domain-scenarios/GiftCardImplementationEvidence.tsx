'use client';

import { useState } from 'react';

const GIFT_CARD_CODE_TABS = [
  {
    id: 'debit', label: '원장 차감', file: 'DomainScenarioEngine.java',
    reason: '정상 사용에서는 사용 요청 뒤 차감 원장과 확정 잔액이 한 번만 만들어지는 기대 순서를 고정합니다.',
    code: `case "NORMAL" -> result(
    "COMPLETED",
    "상품권 10,000원 사용 완료",
    50_000,
    40_000,
    key,
    step("ISSUED", "Gift card", "SUCCESS", "50,000원 상품권을 활성화했다."),
    step("USE_REQUESTED", "Commerce API", "SUCCESS", "10,000원 사용 요청을 받았다."),
    step("BALANCE_DEBITED", "Ledger", "SUCCESS", "원장에 -10,000원을 기록하고 잔액을 확정했다.")
);`,
  },
  {
    id: 'idempotency', label: '요청 멱등', file: 'DomainScenarioEngine.java',
    reason: '동일한 요청 key가 반복되면 두 번째 차감 대신 최초 처리 결과를 돌려주는 정책을 표현합니다.',
    code: `case "DUPLICATE_RETRY" -> result(
    "IDEMPOTENT",
    "동일 요청은 기존 결과를 반환",
    50_000,
    40_000,
    key,
    step("BALANCE_DEBITED", "Ledger", "SUCCESS",
        "idempotency key와 -10,000원 원장을 함께 기록했다."),
    step("RETRY_RECEIVED", "Client", "WARNING",
        "응답 유실로 같은 key를 다시 전송했다."),
    step("DUPLICATE_RETURNED", "Commerce API", "SUCCESS",
        "추가 차감 없이 첫 결과를 반환했다.")
);`,
  },
  {
    id: 'concurrency', label: '잔액 경합', file: 'DomainScenarioEngine.java',
    reason: '마지막 10,000원에 두 요청이 동시에 도착해도 먼저 확정된 한 건만 잔액을 변경하도록 모델링합니다.',
    code: `case "CONCURRENT_USE" -> result(
    "ONE_ACCEPTED",
    "마지막 유효 잔액은 한 요청만 사용",
    10_000,
    0,
    key,
    step("TWO_REQUESTS", "Clients", "WARNING",
        "10,000원 사용 요청 두 건이 동시에 도착했다."),
    step("BALANCE_LOCKED", "PostgreSQL", "SUCCESS",
        "잔액 갱신 경계를 한 transaction으로 직렬화했다."),
    step("FIRST_DEBITED", "Ledger", "SUCCESS", "첫 요청 원장을 확정했다."),
    step("SECOND_REJECTED", "Commerce API", "REJECTED", "두 번째 요청을 거절했다.")
);`,
  },
  {
    id: 'recovery', label: '응답 복구', file: 'DomainScenarioEngine.java',
    reason: '서버 commit 뒤 응답만 사라진 요청은 같은 key로 기존 원장을 찾아 완료 상태를 복구합니다.',
    code: `case "TIMEOUT_RETRY" -> result(
    "RECONCILED",
    "응답 유실 뒤 조회로 사용 결과 복구",
    50_000,
    40_000,
    key,
    step("BALANCE_DEBITED", "Ledger", "SUCCESS", "서버 transaction은 정상 commit됐다."),
    step("RESPONSE_LOST", "Network", "WARNING", "응답이 클라이언트에 도착하지 않았다."),
    step("RETRY_RECEIVED", "Commerce API", "WARNING", "같은 key로 재시도했다."),
    step("RESULT_RECOVERED", "Commerce API", "SUCCESS", "기존 원장에서 결과를 복구했다.")
);`,
  },
  {
    id: 'reversal', label: '취소 역원장', file: 'DomainScenarioEngine.java',
    reason: '사용 이력을 삭제하지 않고 원거래를 상쇄하는 반대 금액의 원장을 추가해 감사 가능성을 보존합니다.',
    code: `case "CANCEL" -> result(
    "CANCELLED",
    "사용 취소 후 잔액 복구",
    40_000,
    50_000,
    key,
    step("USE_FOUND", "Ledger", "SUCCESS", "취소 대상 사용 원장을 찾았다."),
    step("CANCEL_RECORDED", "Ledger", "SUCCESS", "+10,000원 취소 원장을 새로 기록했다."),
    step("BALANCE_RESTORED", "Gift card", "SUCCESS", "잔액을 50,000원으로 복구했다.")
);`,
  },
] as const;

type GiftCardCodeTabId = (typeof GIFT_CARD_CODE_TABS)[number]['id'];

export function GiftCardImplementationEvidence() {
  const [activeId, setActiveId] = useState<GiftCardCodeTabId>('debit');
  const active = GIFT_CARD_CODE_TABS.find((tab) => tab.id === activeId) ?? GIFT_CARD_CODE_TABS[0];

  return (
    <section className="partner-code gift-card-code" aria-labelledby="gift-card-code-title">
      <header><div><span>POLICY IMPLEMENTATION</span><h2 id="gift-card-code-title">상품권 잔액·원장 상태 전이 코드</h2></div><p>실제 발행사나 운영 원장이 아닌, 실행 가능한 정책 모델과 영속 실행 기록입니다.</p></header>
      <div className="partner-code-tabs" role="tablist" aria-label="상품권 구현 코드 선택">
        {GIFT_CARD_CODE_TABS.map((tab) => <button aria-selected={tab.id === activeId} className={tab.id === activeId ? 'active' : ''} id={`gift-card-code-tab-${tab.id}`} key={tab.id} onClick={() => setActiveId(tab.id)} role="tab" type="button">{tab.label}</button>)}
      </div>
      <div aria-labelledby={`gift-card-code-tab-${active.id}`} className="partner-code-body" role="tabpanel">
        <aside><span>SOURCE</span><strong>{active.file}</strong><p>{active.reason}</p></aside>
        <pre><code>{active.code}</code></pre>
      </div>
      <footer><span>deterministic policy engine</span><span>PostgreSQL run history</span><span>not a production ledger</span></footer>
      <GiftCardBoundaryTable />
    </section>
  );
}

function GiftCardBoundaryTable() {
  return (
    <section className="partner-production" aria-labelledby="gift-card-boundary-title">
      <header><div><span>PRODUCTION BOUNDARY</span><h3 id="gift-card-boundary-title">실서비스 상품권 원장에 추가할 보장</h3></div><p>현재 모델과 실제 정합성 수단을 구분합니다.</p></header>
      <div className="partner-production-table" role="table" aria-label="상품권 원장 구현 경계">
        <div className="partner-production-row partner-production-head" role="row"><span role="columnheader">상태</span><span role="columnheader">영역</span><span role="columnheader">현재 모델</span><span role="columnheader">실서비스 보장 수단</span></div>
        <BoundaryRow area="차감 원자성" current="차감 원장과 잔액 변경의 기대 순서를 저장" next="local transaction, 조건부 잔액 UPDATE와 affected row 검증" />
        <BoundaryRow area="요청 멱등" current="중복 key에 최초 결과를 반환하는 정책" next="상품권·요청 key unique constraint와 확정 응답 snapshot" />
        <BoundaryRow area="동시 사용" current="두 요청 중 한 건만 승인되는 결과를 모델링" next="row lock 또는 version 기반 낙관적 lock과 동시성 통합 테스트" />
        <BoundaryRow area="응답 유실" current="같은 key로 기존 결과를 복구하는 단계를 기록" next="상태 조회 API, retry-safe contract와 요청·응답 감사 로그" />
        <BoundaryRow area="사용 취소" current="삭제 대신 반대 금액의 취소 원장을 추가" next="원거래 참조 unique constraint, 취소 멱등성과 권한·감사 기록" />
      </div>
    </section>
  );
}

function BoundaryRow({ area, current, next }: { readonly area: string; readonly current: string; readonly next: string }) {
  return <div className="partner-production-row" role="row"><span data-check="MODELED" role="cell">MODELED</span><strong role="cell">{area}</strong><p role="cell">{current}</p><p role="cell">{next}</p></div>;
}
