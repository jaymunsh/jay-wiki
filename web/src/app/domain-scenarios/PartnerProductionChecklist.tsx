const CHECKS = [
  {
    status: 'IMPLEMENTED',
    area: '연결과 Pool',
    current: 'pool 20, acquire 300ms, idle 20s, connect 300ms',
    next: 'host별 pool 격리, pending queue 상한, keep-alive와 eviction을 부하 기준으로 조정',
  },
  {
    status: 'PARTIAL',
    area: 'Timeout budget',
    current: 'response 700ms, 전체 block 상한 4s',
    next: 'DNS·TLS handshake·write·read·전체 업무 deadline을 분리하고 하위 호출에 남은 budget 전달',
  },
  {
    status: 'PARTIAL',
    area: '오류와 재시도',
    current: '429 Retry-After, 5xx 최대 횟수, timeout 미확정 분류',
    next: '멱등 요청만 재시도하고 jitter, retry budget, bulkhead와 Circuit Breaker 도입 조건 정의',
  },
  {
    status: 'PARTIAL',
    area: '응답과 자원',
    current: 'status 확인 후 response body release',
    next: '최대 body 크기, codec memory, streaming, charset와 계약 schema 하위 호환성 검증',
  },
  {
    status: 'PARTIAL',
    area: '신뢰 경계',
    current: 'callback HMAC, timestamp와 correlation ID 검증',
    next: 'outbound request 서명, secret rotation, replay 저장소, mTLS와 인증서 만료 대응',
  },
  {
    status: 'NEXT',
    area: '관측과 운영',
    current: 'status, attempts, elapsed와 처리 step을 PostgreSQL에 기록',
    next: '저카디널리티 metric, trace 전파, body 마스킹 log, SLO와 partner별 alert 기준 연결',
  },
] as const;

export function PartnerProductionChecklist() {
  return (
    <section className="partner-production" aria-labelledby="partner-production-title">
      <header>
        <div><span>PRODUCTION CHECKPOINTS</span><h3 id="partner-production-title">Timeout 밖에서 확인할 외부 연동 조건</h3></div>
        <p>현재 구현과 운영 확장 조건을 구분합니다.</p>
      </header>
      <div className="partner-production-table" role="table" aria-label="외부 API 실무 체크포인트">
        <div className="partner-production-row partner-production-head" role="row">
          <span role="columnheader">상태</span><span role="columnheader">영역</span><span role="columnheader">현재 구현</span><span role="columnheader">운영 확장 조건</span>
        </div>
        {CHECKS.map((check) => (
          <div className="partner-production-row" key={check.area} role="row">
            <span data-check={check.status} role="cell">{check.status}</span>
            <strong role="cell">{check.area}</strong>
            <p role="cell">{check.current}</p>
            <p role="cell">{check.next}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
