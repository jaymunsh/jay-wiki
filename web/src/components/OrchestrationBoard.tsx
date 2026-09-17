'use client';

import { useState } from 'react';

type AreaId = 'all' | 'edge' | 'workloads' | 'data' | 'observability' | 'delivery';

type DetailState = 'current' | 'next';
type Node = { readonly label: string; readonly asset?: string };
type Area = { readonly id: Exclude<AreaId, 'all'>; readonly label: string; readonly nodes: readonly Node[] };
// owns 는 이 프로세스가 '지금' 실제로 저장하는 데이터다. 화면에는 지금 사실만 둔다 —
// "앞으로 이렇게 바꿀 예정"은 안 하면 거짓말이 되고, 그건 설계 문서에 적을 몫이다.
type InspectorDetail = { readonly name: string; readonly description: string; readonly state: DetailState; readonly owns?: string };
type AreaSummary = { readonly title: string; readonly description: string; readonly flow: string; readonly proof: string; readonly details: readonly InspectorDetail[] };

const AREAS = [
  { id: 'edge', label: 'Public edge', nodes: [{ label: 'Browser', asset: 'googlechrome' }, { label: 'Cloudflare Tunnel', asset: 'cloudflare' }] },
  { id: 'workloads', label: 'Workloads', nodes: [{ label: 'Next.js web', asset: 'nextjs' }, { label: 'Spring Boot', asset: 'spring' }, { label: 'FastAPI payment-api', asset: 'fastapi' }, { label: 'FastAPI shipping-api', asset: 'fastapi' }, { label: 'FastAPI partner-simulator', asset: 'fastapi' }] },
  { id: 'data', label: 'Data & events', nodes: [{ label: 'PostgreSQL portfolio', asset: 'postgresql' }, { label: 'PostgreSQL pg-services', asset: 'postgresql' }, { label: 'Redis', asset: 'redis' }, { label: 'Kafka', asset: 'kafka' }, { label: 'OpenSearch', asset: 'opensearch' }, { label: 'MinIO', asset: 'minio' }] },
  { id: 'observability', label: 'Observability', nodes: [{ label: 'OTel Collector', asset: 'opentelemetry' }, { label: 'Prometheus', asset: 'prometheus' }, { label: 'Loki' }, { label: 'Tempo' }, { label: 'Grafana', asset: 'grafana' }] },
  { id: 'delivery', label: 'Delivery & recovery', nodes: [{ label: 'GitHub Actions', asset: 'githubactions' }, { label: 'GHCR', asset: 'github' }, { label: 'self-hosted runner', asset: 'githubactions' }, { label: 'backup CronJob', asset: 'kubernetes' }, { label: 'Cloudflare R2', asset: 'cloudflare' }] },
] as const satisfies readonly Area[];

const AREA_SUMMARIES: Readonly<Record<AreaId, AreaSummary>> = {
  all: {
    title: 'k3s control plane', description: '한 대의 miniPC에서 서비스, 상태 저장소, 관측과 CronJob을 조율합니다.',
    flow: 'public edge → k3s → service · state · telemetry → recovery', proof: 'Deployment · Service · StatefulSet · PVC · CronJob',
    details: [{ name: 'Scheduler', description: '워크로드를 원하는 상태로 배치하고 재시작합니다.', state: 'current' }, { name: 'Service & DNS', description: '서비스 간 내부 통신 경계를 유지합니다.', state: 'current' }, { name: 'StatefulSet & PVC', description: 'PostgreSQL, Kafka 등 상태 저장소를 보존합니다.', state: 'current' }],
  },
  edge: {
    title: 'Public edge', description: '외부 요청은 Cloudflare Tunnel을 통과해 Next.js BFF 경계로 들어옵니다.',
    flow: 'browser → Cloudflare Tunnel → Next.js BFF → internal services', proof: 'HTTPS ingress · BFF 경계',
    details: [{ name: 'Browser', description: '사용자는 공개 웹 화면만 직접 요청합니다.', state: 'current' }, { name: 'Cloudflare Tunnel', description: '공인 인바운드를 miniPC 내부 서비스로 연결합니다.', state: 'current' }],
  },
  workloads: {
    title: 'Workloads', description: '결제와 배송은 데이터까지 나뉘었습니다. 각자 자기 DB에 쓰고, Spring은 그 결과를 이벤트로 전해 듣습니다.',
    flow: 'Next.js → Spring(주문·재고를 저장) → payment-api·shipping-api(각자 자기 DB에 저장) → 이벤트로 Spring에 사본', proof: '프로세스 분리 O · 독립 배포 O · 데이터 소유권 결제·배송 O',
    details: [
      { name: 'Next.js web', description: '화면 렌더링과 BFF 경계를 담당합니다.', state: 'current', owns: '없음. 아무 데이터도 저장하지 않습니다.' },
      { name: 'Spring Boot', description: '위키, 인증, 게시판과 운영 도메인 API를 처리합니다.', state: 'current', owns: 'portfolio DB에 주문·재고·사가 기록을 저장합니다. 결제와 배송은 더 이상 여기 없고, 화면에 쓰는 사본만 이벤트로 받아 둡니다.' },
      { name: 'FastAPI payment-api', description: 'Saga 결제 흐름의 좁은 참여자로 동작합니다.', state: 'current', owns: 'pg-services의 payment DB에 결제와 아웃박스를 저장합니다. 여기가 결제의 원본이고, Spring은 이벤트로 전해 들은 사본만 봅니다.' },
      { name: 'FastAPI shipping-api', description: 'Saga 배송 흐름의 좁은 참여자로 동작합니다.', state: 'current', owns: 'pg-services의 shipping DB에 배송 접수와 아웃박스를 저장합니다. shipping_svc 계정은 payment DB에 붙을 수 없습니다.' },
      { name: 'FastAPI partner-simulator', description: '외부 협력사 API 역할입니다. 콜백을 늦추거나 서명을 틀리게 주어 재시도와 타임아웃 경로를 실제로 겪게 합니다.', state: 'current', owns: '없음. 파트너 API 리허설 전용이라 주문 흐름과는 무관합니다.' },
    ],
  },
  data: {
    title: 'Data & events', description: 'PostgreSQL이 두 대입니다. 결제와 배송은 두 번째 인스턴스에 있고, 모놀리스는 NetworkPolicy에 막혀 그쪽에 패킷이 닿지 않습니다.',
    flow: 'portfolio(위키·게시판·주문·재고) · pg-services(결제·배송) — 사이는 Kafka 이벤트로만 이어진다', proof: '계정 권한 + NetworkPolicy 두 겹',
    details: [
      { name: 'PostgreSQL portfolio', description: '위키 본문, revision, 계정과 게시판의 원본 데이터입니다.', state: 'current', owns: '위키·게시판·계정에 더해 주문·재고. 결제와 배송은 빠졌고, 화면용 사본만 이벤트로 받아 둡니다.' },
      { name: 'PostgreSQL pg-services', description: '모놀리스가 붙을 수 없는 두 번째 인스턴스입니다.', state: 'current', owns: '결제와 배송의 원본. DB마다 계정이 다르고, NetworkPolicy가 payment-api·shipping-api와 백업 CronJob 외의 파드를 아예 거부합니다.' },
      { name: 'Redis', description: '캐시, 조회수, 채팅 정원과 대기열 같은 단기 상태를 둡니다.', state: 'current', owns: '사라져도 되는 것만. 같은 주문이 두 번 들어가는 걸 막는 키는 여기가 아니라 postgres에 둡니다.' },
      { name: 'Kafka', description: 'Outbox, fan-out, retry와 DLQ 이벤트 흐름을 분리합니다.', state: 'current', owns: '이벤트를 잠깐 나릅니다. 결제·배송 이벤트는 프로세스를 실제로 건너 Spring의 사본을 채웁니다.' },
      { name: 'OpenSearch', description: '대량 검색과 nori 분석기를 위한 검색 인덱스입니다.', state: 'current' },
      { name: 'MinIO', description: '동일 홈랩 안에서 기술 로고와 오브젝트 자산을 제공합니다.', state: 'current' },
    ],
  },
  observability: {
    title: 'Observability', description: '메트릭, 로그, trace를 서로 다른 경로로 모아 Grafana에서 교차 확인합니다.',
    // 셋이 한 경로로 흐르지 않는다. OTel 파이프라인에는 traces 하나만 켜져 있고,
    // 메트릭은 Prometheus 가 직접 긁고 로그는 promtail 이 나른다. 한 줄로 줄이면 사실과 어긋난다.
    flow: 'trace → OTel Collector → Tempo · 메트릭 → Prometheus · 로그 → promtail → Loki · 셋 → Grafana', proof: 'OTel · Prometheus · Loki · Tempo · Grafana',
    details: [{ name: 'OTel Collector', description: 'trace를 받아 Tempo로 넘깁니다. 메트릭과 로그는 이 경로를 지나지 않습니다.', state: 'current' }, { name: 'Prometheus', description: '메트릭과 알림용 시계열 데이터를 보관합니다.', state: 'current' }, { name: 'Loki', description: '서비스 로그를 레이블 기준으로 조회합니다.', state: 'current' }, { name: 'Tempo', description: '요청 trace를 보관해 장애 경로를 추적합니다.', state: 'current' }, { name: 'Grafana', description: '메트릭, 로그, trace를 한 화면에서 교차 확인합니다.', state: 'current' }],
  },
  delivery: {
    title: 'Delivery & recovery', description: '이미지 생성, 배포 실행, 롤백 가능한 태그, 백업을 서로 다른 책임으로 나눕니다.',
    flow: 'git push → Actions test/build → GHCR SHA image → miniPC runner → kubectl rollout → smoke test', proof: 'GitHub Actions · GHCR · CronJob · R2',
    details: [{ name: 'GitHub Actions', description: 'push를 받아 테스트, Docker build와 image push 워크플로를 시작합니다.', state: 'current' }, { name: 'GHCR', description: 'GHCR은 GitHub Container Registry입니다. SHA 태그의 컨테이너 이미지를 보관하고 k3s가 pull secret으로 가져갑니다.', state: 'current' }, { name: 'self-hosted runner', description: 'miniPC에 설치된 GitHub job 실행기입니다. 내부에서 kubectl 배포와 public smoke test를 수행합니다.', state: 'current' }, { name: 'backup CronJob', description: 'PostgreSQL dump와 sha256 파일을 매일 만들고 8일차부터 지웁니다. 복원 리허설은 정기 실행이 아니라 사람이 스크립트로 돌립니다.', state: 'current' }, { name: 'Cloudflare R2', description: 'miniPC 장애까지 대비하는 외부 S3 호환 백업 복제 Phase B입니다.', state: 'next' }],
  },
};

const ASSET_BASE = '/api/assets/portfolio/stack';

export function OrchestrationBoard() {
  const [selectedArea, setSelectedArea] = useState<AreaId>('all');
  const selectedSummary = AREA_SUMMARIES[selectedArea];

  return (
    <section className="orchestration-board" aria-labelledby="orchestration-title">
      <header className="orchestration-head">
        <div>
          <span>ORCHESTRATION MAP</span>
          <h2 id="orchestration-title">miniPC 위에서 k3s가 전체 스택을 오케스트레이션한다</h2>
        </div>
        <p>전체 흐름을 먼저 보고, 영역을 클릭해 필요한 설명만 엽니다.</p>
      </header>

      <div className="orchestration-world" data-selected={selectedArea}>
        <Zone area={AREAS[0]} selectedArea={selectedArea} onSelect={setSelectedArea} />
        <span className="orchestration-outer-flow flow-ingress" aria-hidden="true"><b>HTTPS</b><i>→</i></span>
        <div className="orchestration-cluster">
          <div className="orchestration-cluster-label"><span>miniPC · HOME LAB</span><b><img alt="" onError={(event) => { event.currentTarget.hidden = true; }} src={`${ASSET_BASE}/kubernetes.svg`} />k3s control plane</b><small>schedules workloads · services · PVC · CronJob</small></div>
          <div className="orchestration-stage">
            <span className="system-arrow arrow-service" aria-hidden="true">service →</span><span className="system-arrow arrow-state" aria-hidden="true">state / event →</span><span className="system-arrow arrow-telemetry" aria-hidden="true">↓ telemetry ↓</span>
            <button aria-pressed={selectedArea === 'all'} className="orchestration-core" onClick={() => setSelectedArea('all')} type="button"><strong>k3s</strong><b>reconcile loop</b><div><i>frontend</i><i>backend</i><i>data</i><i>obs</i></div></button>
            {AREAS.slice(1, 4).map((area) => <Zone area={area} key={area.id} selectedArea={selectedArea} onSelect={setSelectedArea} />)}
          </div>
        </div>
        <span className="orchestration-outer-flow flow-delivery" aria-hidden="true"><b>deploy</b><i>→</i></span>
        <Zone area={AREAS[4]} selectedArea={selectedArea} onSelect={setSelectedArea} />
      </div>
      <section className="orchestration-inspector" aria-live="polite">
        <div className="orchestration-inspector-summary">
          <span>SELECTED AREA</span><h3>{selectedSummary.title}</h3><p>{selectedSummary.description}</p>
          <code>{selectedSummary.flow}</code><b>{selectedSummary.proof}</b>
        </div>
        <div className="orchestration-inspector-details">
          {selectedSummary.details.map((detail) => <div className="orchestration-inspector-detail" key={detail.name}><strong>{detail.name}</strong><p>{detail.description}</p>{detail.owns && <dl className="orchestration-ownership"><dt>저장하는 데이터</dt><dd>{detail.owns}</dd></dl>}{detail.state === 'next' && <em>next</em>}</div>)}
        </div>
      </section>
    </section>
  );
}

function StackNode({ node }: { readonly node: Node }) {
  return <span className="orchestration-node">{node.asset && <img alt="" onError={(event) => { event.currentTarget.hidden = true; }} src={`${ASSET_BASE}/${node.asset}.svg`} />}<b>{node.label}</b></span>;
}

function Zone({ area, selectedArea, onSelect }: { readonly area: Area; readonly selectedArea: AreaId; readonly onSelect: (area: Exclude<AreaId, 'all'>) => void }) {
  return <button aria-pressed={selectedArea === area.id} className={`orchestration-zone zone-${area.id} ${selectedArea === 'all' || selectedArea === area.id ? 'is-active' : 'is-muted'}`} onClick={() => onSelect(area.id)} type="button"><span>{area.label}</span><div>{area.nodes.map((node) => <StackNode key={node.label} node={node} />)}</div></button>;
}
