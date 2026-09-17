import Link from 'next/link';
import { DomainScenarioRunner } from '@/app/domain-scenarios/DomainScenarioRunner';
import {
  CONNECTION_POOL_CONFIG,
  COUPON_RACE_CONFIG,
  DATA_CORRECTION_CONFIG,
  PRIVACY_LIFECYCLE_CONFIG,
  SPREADSHEET_OPERATIONS_CONFIG,
  BUSINESS_METRICS_CONFIG,
  NOTIFICATION_DELIVERY_CONFIG,
  MAINTENANCE_MODE_CONFIG,
  IMAGE_UPLOAD_PIPELINE_CONFIG,
  GIFT_CARD_CONFIG,
  N_PLUS_ONE_CONFIG,
  ORDER_CONFIG,
  PARTNER_API_CONFIG,
  SETTLEMENT_BATCH_CONFIG,
  TRAFFIC_BURST_CONFIG,
  type DomainScenarioConfig,
} from '@/app/domain-scenarios/domainScenarioConfigs';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { AlertDrillPanel } from './AlertDrillPanel';
import { HpaRehearsalPanel } from './HpaRehearsalPanel';
import { ScenarioFlowDiagram } from './ScenarioFlowDiagram';
import { ScenarioProvenance } from './ScenarioProvenance';
import { ScenarioStoryRail } from './ScenarioStoryRail';
import { SCENARIO_GROUPS, type Scenario, type ScenarioId } from './scenarios';

/** 실행판이 이 페이지 안에 붙는 편. 나머지는 설명만 있거나 실제 화면이 따로 있다. */
const RUNNER_CONFIGS: Readonly<Record<string, DomainScenarioConfig>> = {
  'commerce-order-confirmation': ORDER_CONFIG,
  'traffic-burst-control': TRAFFIC_BURST_CONFIG,
  'coupon-race-condition': COUPON_RACE_CONFIG,
  'settlement-batch-retry': SETTLEMENT_BATCH_CONFIG,
  'connection-pool-exhaustion': CONNECTION_POOL_CONFIG,
  'jpa-n-plus-one': N_PLUS_ONE_CONFIG,
  'gift-card-consistency': GIFT_CARD_CONFIG,
  'partner-api-resilience': PARTNER_API_CONFIG,
  'operations-data-correction': DATA_CORRECTION_CONFIG,
  'privacy-data-lifecycle': PRIVACY_LIFECYCLE_CONFIG,
  'bulk-spreadsheet-operations': SPREADSHEET_OPERATIONS_CONFIG,
  'business-metrics-backoffice': BUSINESS_METRICS_CONFIG,
  'notification-delivery-operations': NOTIFICATION_DELIVERY_CONFIG,
  'maintenance-communication': MAINTENANCE_MODE_CONFIG,
  'image-upload-optimization': IMAGE_UPLOAD_PIPELINE_CONFIG,
};

/**
 * 시나리오 스물두 편이 모두 이 한 화면을 쓴다.
 *
 * 전에는 상세가 셋이었다 — 목록 안에서 열리는 인라인 상세, 도메인 실행판, 그리고
 * 한 번도 그려지지 않던 서술 페이지. 방문자는 같은 사례를 두 번, 서로 다른 모양으로
 * 읽었고 주소로 가리킬 수도 없었다.
 *
 * 절 순서는 읽는 사람이 묻는 순서다. 무슨 일이 있었나 → 왜 남겼나 → 어떻게 흐르나 →
 * 직접 해보기 → 무엇을 확인하나 → 무엇을 판단했나 → 더 읽을 것.
 */
export function ScenarioDetail({ scenario }: { readonly scenario: Scenario }) {
  const id = scenario.id as ScenarioId;
  const runner = RUNNER_CONFIGS[scenario.id];
  const panel = id === 'hpa-scaleout' ? 'hpa' : id === 'alert-chain-drill' ? 'alert' : null;
  // 실행이 이 페이지 밖에 있는 편. 데모 화면과 위키 글이 여기에 해당한다.
  const away = !runner && !panel && !scenario.route.startsWith('/scenarios');
  const group = SCENARIO_GROUPS.find((item) => (item.scenarioIds as readonly string[]).includes(scenario.id));
  // 같은 글이 observability 와 wiki 양쪽에 적힌 편이 있다. 주소로 한 번만 남긴다.
  const links = [...new Map([
    ...scenario.observability.filter((item) => item.href !== scenario.route),
    ...scenario.wiki.map((item) => ({ label: item.label, href: `/wiki/${item.slug}` })),
  ].map((item) => [item.href, item])).values()];

  // 실행판이 이 페이지 안에 붙는 편. 이때만 절 순서가 달라진다.
  const inPage = Boolean(runner || panel);

  const rail = [
    { id: 'case', label: '사례' },
    { id: 'why', label: '왜' },
    ...(scenario.flow ? [{ id: 'flow', label: '흐름' }] : []),
    // 실행판이 여기 있으면 누르는 순서를 먼저 읽고 누른다.
    ...(inPage
      ? [{ id: 'verify', label: '순서' }, { id: 'run', label: '실행' }, { id: 'evidence', label: '신호' }]
      : [...(away ? [{ id: 'run', label: '실행' }] : []), { id: 'verify', label: '검증' }]),
    { id: 'judgement', label: '판단' },
    ...(links.length > 0 ? [{ id: 'links', label: '더 읽기' }] : []),
  ];

  const runbook = (
    <section className="scenario-panel">
      <span>RUNBOOK</span>
      <h2>{inPage ? '이 순서로 눌러 본다' : '검증 순서'}</h2>
      <ol className="scenario-steps">
        {scenario.runbook.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </section>
  );

  const evidence = (
    <section className="scenario-panel">
      <span>EVIDENCE</span>
      <h2>확인할 신호</h2>
      <div className="scenario-signal-list">
        {scenario.signals.map((signal) => (
          <span key={signal.label}>
            {signal.label}
            {signal.metric && <code>{signal.metric}</code>}
          </span>
        ))}
      </div>
    </section>
  );

  return (
    <>
      <Header />
      <main className="scenario-narrative-page" id="main-content">
        <nav aria-label="현재 위치" className="scenario-story-breadcrumb">
          <Link href="/scenarios">시나리오</Link>
          <span aria-hidden="true">›</span>
          <strong>{group?.title ?? '사례'}</strong>
        </nav>

        <header className="scenario-story-hero">
          <div className="eyebrow">{scenario.eyebrow}</div>
          <h1>{scenario.title}</h1>
          {/* summary 는 목록 카드가 쓴다. 히어로는 그 다음 질문에 답하는 proof 를 받는다. */}
          <p>{scenario.proof}</p>
          {/* 배지 뜻은 목록 페이지 맨 위 범례가 설명한다. 여기서 설명까지 펼치면
              230px 칸에 문단이 세로로 갇혀 히어로만 두 배로 길어진다. */}
          <ScenarioProvenance compact scenarioId={id} />
        </header>

        {/* 스물두 편이 같은 뼈대라 이 줄이 어느 편에서든 같은 자리를 가리킨다.
            페이지가 길어도 무엇이 남았는지, 어디까지 읽었는지가 여기서 보인다. */}
        <ScenarioStoryRail items={rail} />

        <section aria-labelledby="case-title" className="scenario-case-study" id="case">
          <header>
            <span>CASE</span>
            <h2 id="case-title">{scenario.caseStudy.title}</h2>
          </header>
          {/* 세 칸이 나란히 놓인 사실이 아니라 차례로 읽는 세 박자다. 번호와 화살표가
              그 순서를 말한다 — 화살표는 위 FLOW MAP 이 쓰는 것과 같은 표식이다. */}
          <div>
            {[
              { key: 'situation', label: '상황', text: scenario.caseStudy.situation },
              { key: 'risk', label: '위험', text: scenario.caseStudy.risk, tone: 'danger' },
              { key: 'verify', label: '검증', text: scenario.caseStudy.verification, tone: 'success' },
            ].map((beat, index) => (
              <article data-tone={beat.tone} key={beat.key}>
                {index > 0 && <em aria-hidden="true" className="scenario-case-connector">→</em>}
                <span><b>{String(index + 1).padStart(2, '0')}</b>{beat.label}</span>
                <p>{beat.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* PROOF 칸이 있었는데 히어로가 같은 proof 를 그려서 한 화면에 두 번 나왔다.
            히어로에 두고 여기는 objective 한 칸만 남긴다. */}
        <section aria-labelledby="why-title" className="scenario-story-purpose" id="why">
          <div>
            <span>WHY</span>
            <h2 id="why-title">왜 이 사례를 남겼나</h2>
            <p>{scenario.objective}</p>
          </div>
        </section>

        {scenario.flow && <div id="flow"><ScenarioFlowDiagram flow={scenario.flow} /></div>}

        {/* 실행판이 이 페이지 안에 있으면 누르는 순서가 실행판보다 먼저 와야 한다.
            전에는 뒤에 있어서, 다 눌러 본 뒤에 "이 순서로 누르라"를 읽었다.
            실행이 밖에 있는 편은 그대로 둔다 — 거긴 Grafana 등 다른 화면에서 따라하는
            절차라 실행 버튼보다 뒤가 맞다. */}
        {inPage && (
          <section aria-label="실행 순서" className="scenario-story-grid" data-single="true" id="verify">
            {runbook}
          </section>
        )}

        {(runner || panel || away) && (
          <div className="scenario-story-run" id="run">
            {runner && <DomainScenarioRunner config={runner} />}
            {panel === 'hpa' && <HpaRehearsalPanel />}
            {panel === 'alert' && <AlertDrillPanel />}
            {away && (
              <section className="scenario-story-away">
                <div>
                  <span>OPEN</span>
                  <h2>직접 눌러 보는 곳</h2>
                  <p>이 사례의 실행 화면은 따로 있습니다. 설명을 다 읽고 열어도 되고 먼저 열어도 됩니다.</p>
                </div>
                <Link className="btn btn-primary" href={scenario.route}>{scenario.routeLabel}</Link>
              </section>
            )}
          </div>
        )}

        {inPage ? (
          <section aria-label="확인할 신호" className="scenario-story-grid" data-single="true" id="evidence">
            {evidence}
          </section>
        ) : (
          <section aria-label="검증" className="scenario-story-grid" id="verify">
            {runbook}
            {evidence}
          </section>
        )}

        {/* 번호를 붙이지 않는다. 차례로 밟는 절차가 아니라 각각 독립된 판단이라,
            번호를 달면 없는 순서를 있는 것처럼 읽힌다. */}
        <section aria-labelledby="judgement-title" className="scenario-story-boundary" id="judgement">
          <header>
            <span>JUDGEMENT</span>
            <h2 id="judgement-title">무엇을 판단했나</h2>
          </header>
          <ul>
            {scenario.retrospectives.map((item) => <li key={item}><p>{item}</p></li>)}
          </ul>
        </section>

        {links.length > 0 && (
          <section aria-labelledby="links-title" className="scenario-story-links" id="links">
            <div>
              <span>MORE</span>
              <h2 id="links-title">이어서 볼 것</h2>
            </div>
            <div>
              {links.map((item) => (
                <Link className="btn" href={item.href} key={`${item.label}-${item.href}`}>{item.label}</Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
