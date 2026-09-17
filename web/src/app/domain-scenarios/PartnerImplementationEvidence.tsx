'use client';

import { useState } from 'react';
import { PartnerProductionChecklist } from './PartnerProductionChecklist';

const CODE_TABS = [
  {
    id: 'webclient',
    label: 'WebClient 커스터마이징',
    file: 'PartnerWebClientFactory.java',
    reason: '기본 WebClient를 그대로 생성하지 않고 Reactor Netty pool, connect/read timeout, connector와 공통 request filter를 외부 연동 경계에 고정합니다.',
    code: `ConnectionProvider pool = ConnectionProvider.builder("partner-api")
    .maxConnections(20)
    .pendingAcquireTimeout(Duration.ofMillis(300))
    .maxIdleTime(Duration.ofSeconds(20))
    .build();

HttpClient client = HttpClient.create(pool)
    .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 300)
    .responseTimeout(Duration.ofMillis(700));

return WebClient.builder()
    .baseUrl(baseUrl)
    .clientConnector(new ReactorClientHttpConnector(client))
    .filter((request, next) -> next.exchange(
        ClientRequest.from(request)
            .header("X-Client", "jay-wiki")
            .build()))
    .build();`,
  },
  {
    id: 'gateway',
    label: 'Gateway 래퍼',
    file: 'PartnerApiClient.java',
    reason: 'WebClient의 fluent API를 업무 코드에 노출하지 않고 제휴 승인 계약과 실행 결과를 하나의 gateway로 감쌉니다.',
    code: `public class PartnerApiClient {
    private final WebClient webClient;
    private final String callbackUrl;

    public PartnerApiClient(WebClient webClient, String callbackUrl) {
        this.webClient = webClient;
        this.callbackUrl = callbackUrl;
    }

    private Mono<Response> invoke(String correlationId, String mode) {
        ApprovalRequest request = new ApprovalRequest(correlationId, callbackUrl);
        return webClient.post()
            .uri(builder -> builder.path("/partner/approve")
                .queryParam("mode", mode).build())
            .header("X-Correlation-ID", correlationId)
            .bodyValue(request)
            .exchangeToMono(response -> {
                String retryAfter = response.headers().asHttpHeaders()
                    .getFirst("Retry-After");
                long retryAfterMs = retryAfter == null
                    ? 0
                    : Long.parseLong(retryAfter) * 1_000;
                return response.releaseBody().thenReturn(new Response(
                    response.statusCode().value(), false, retryAfterMs));
            });
    }
}`,
  },
  {
    id: 'policy',
    label: '오류 분류',
    file: 'PartnerApiClient.java',
    reason: '429와 5xx만 제한적으로 재시도하고 read timeout은 거래 실패가 아닌 미확정으로 반환합니다.',
    code: `for (int attempt = 1; attempt <= maximumAttempts; attempt++) {
    response = invoke(correlationId, mode)
        .block(Duration.ofSeconds(4));

    if (response.statusCode() < 400) break;
    if (response.statusCode() == 429) {
        pause(response.retryAfterMs());
    }
}

if (response.timeout()) {
    return new Result(Status.TIMEOUT, attempts, 0, elapsedMs);
}`,
  },
  {
    id: 'callback',
    label: 'Callback 검증',
    file: 'PartnerCallbackController.java',
    reason: 'callback body를 신뢰하지 않고 원문 HMAC, timestamp와 correlation ID를 검증한 뒤 상태를 전달합니다.',
    code: `boolean signatureValid = signatureValid(body, signature)
    && Math.abs(Instant.now().getEpochSecond() - payload.timestamp()) <= 300;

registry.complete(
    payload.correlationId(),
    new CallbackResult(signatureValid, payload.status())
);`,
  },
  {
    id: 'fastapi',
    label: 'FastAPI Simulator',
    file: 'partner_simulator/main.py',
    reason: 'FastAPI는 업무 판단을 하지 않고 실제 지연·429·500·위조 callback만 재현합니다.',
    code: `match mode:
    case ScenarioMode.TIMEOUT_CALLBACK:
        async with anyio.create_task_group() as tasks:
            tasks.start_soon(send_callback, request, SignatureMode.VALID)
            await anyio.sleep(2.5)

    case ScenarioMode.RATE_LIMIT:
        if attempt_store.increment(request.correlation_id) == 1:
            raise HTTPException(
                status_code=429,
                headers={"Retry-After": "1"},
            )`,
  },
] as const;

type CodeTabId = (typeof CODE_TABS)[number]['id'];

export function PartnerImplementationEvidence() {
  const [activeId, setActiveId] = useState<CodeTabId>('webclient');
  const active = CODE_TABS.find((tab) => tab.id === activeId) ?? CODE_TABS[0];

  return (
    <section className="partner-code" aria-labelledby="partner-code-title">
      <header>
        <div>
          <span>IMPLEMENTATION EVIDENCE</span>
          <h2 id="partner-code-title">실행 경로의 핵심 코드</h2>
        </div>
        <p>전체 reactive 전환이 아니라 외부 HTTP 경계와 DB transaction을 분리한 구현입니다.</p>
      </header>
      <div className="partner-code-tabs" role="tablist" aria-label="구현 코드 선택">
        {CODE_TABS.map((tab) => (
          <button
            aria-selected={tab.id === activeId}
            className={tab.id === activeId ? 'active' : ''}
            id={`partner-code-tab-${tab.id}`}
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div aria-labelledby={`partner-code-tab-${active.id}`} className="partner-code-body" role="tabpanel">
        <aside>
          <span>SOURCE</span>
          <strong>{active.file}</strong>
          <p>{active.reason}</p>
        </aside>
        <pre><code>{active.code}</code></pre>
      </div>
      <footer>
        <span>Spring MVC + bounded WebClient</span>
        <span>FastAPI controlled failure</span>
        <span>PostgreSQL evidence</span>
      </footer>
      <div className="partner-client-evolution">
        <article>
          <span>CURRENT · IMPLEMENTED</span>
          <h3>WebClient를 외부 연동 정책에 맞게 커스터마이징</h3>
          <p>Reactor Netty connection pool과 timeout, 공통 header filter, 오류 분류와 제한 재시도를 구성하고 PartnerApiClient가 업무 경계를 감쌉니다.</p>
        </article>
        <article>
          <span>REFERENCE · MODERN OPTION</span>
          <h3>최근에는 @HttpExchange로 계약을 선언할 수도 있다</h3>
          <p>인터페이스에 endpoint 계약을 선언하고 WebClient 기반 proxy를 생성할 수 있습니다. 다만 pool, timeout, 인증과 retry 정책은 여전히 하부 client 설정이 필요합니다.</p>
        </article>
      </div>
      <PartnerProductionChecklist />
    </section>
  );
}
