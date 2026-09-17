import { GRAFANA_ORIGIN } from '@/lib/siteConfig';

export type Scenario = {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly route: string;
  readonly routeLabel: string;
  readonly objective: string;
  readonly proof: string;
  readonly caseStudy: ScenarioCaseStudy;
  readonly flow?: ScenarioFlow;
  readonly signals: readonly ScenarioSignal[];
  readonly runbook: readonly string[];
  readonly observability: readonly ObservabilityLink[];
  readonly wiki: readonly ScenarioWikiLink[];
  /**
   * 개수는 편마다 다르다(5~8). 한때 "정확히 여섯"으로 맞춘 적이 있는데, 3열 그리드에
   * 빈 칸을 안 남기려고 문장을 합치다 사실이 잘려 나갔다. 제약을 글이 아니라 레이아웃에
   * 뒀다 — 마지막 줄이 덜 차면 그 줄의 칸이 늘어난다(scenarios.css 의 span 규칙).
   */
  readonly retrospectives: readonly string[];
};

/**
 * 지표 이름을 그대로 두면 개발 지식이 적은 사람에게는 읽히지 않는다.
 * 사람 말이 앞이고 원문은 뒤에 작게 붙인다. 원문이 없는 신호는 label 만 둔다.
 */
export type ScenarioSignal = {
  readonly label: string;
  readonly metric?: string;
};

export type ScenarioCaseStudy = {
  readonly title: string;
  readonly situation: string;
  readonly risk: string;
  readonly verification: string;
};

export type ScenarioFlow = {
  readonly label: string;
  readonly steps: readonly ScenarioFlowStep[];
};

export type ScenarioFlowStep = {
  readonly label: string;
  readonly detail: string;
  readonly tone?: 'warning' | 'success';
};

export type ObservabilityLink = {
  readonly label: string;
  readonly href: string;
};

export type ScenarioWikiLink = {
  readonly label: string;
  readonly slug: string;
};

export type ScenarioProvenanceKind = 'work-reconstructed' | 'portfolio-operated' | 'policy-model';

export type ScenarioProvenance = {
  readonly kind: ScenarioProvenanceKind;
  readonly label: string;
  readonly description: string;
};

/**
 * 출처(provenance)와 별개의 축이다. 출처는 "이 문제를 어디서 가져왔나"를 말하고,
 * 실행 성격은 "화면에서 보는 단계와 숫자가 실측인가"를 말한다.
 * 둘을 한 축으로 합치면 실무에서 가져온 문제인데 실행은 아닌 경우를 표현할 수 없다.
 */
export type ScenarioExecutionKind = 'live' | 'scripted';

export type ScenarioExecution = {
  readonly kind: ScenarioExecutionKind;
  readonly label: string;
  readonly description: string;
};

export const SCENARIOS = [
  {
    id: 'saga-observability',
    eyebrow: 'Loki / Tempo',
    title: 'Saga 실패 요청 추적',
    summary: '결제사는 내 DB에 없으니 ROLLBACK을 외쳐도 듣지 않는다. 취소 대신 반대 작업으로 되돌린다. 결제·배송이 각자 DB를 든 별도 프로세스라, 보상이 셋에 걸쳐 도는 것을 본다.',
    route: '/saga/order',
    routeLabel: 'Saga 실행 화면',
    objective: '여러 서비스에 걸친 거래는 하나의 트랜잭션으로 묶을 수 없다. 어디서 멈췄고 어디까지 되돌렸는지를 한 화면에서 읽을 수 있게 만든다.',
    proof: '결제는 됐는데 배송이 실패하면? 결제 기록을 지우는 게 아니라 취소 기록을 새로 남긴다. 돈은 이미 움직였고 그 사실은 회계에서 사라지면 안 된다.',
    caseStudy: {
      title: '결제 승인 뒤 배송 생성이 실패한 주문',
      situation: '주문과 결제 승인까지 끝났는데 배송 서비스가 오류를 냈다. 결제는 이미 카드사에 승인이 나간 상태다.',
      risk: '그대로 두면 고객은 돈을 냈는데 물건은 안 오고, 재고 한 개는 아무도 못 사는 상태로 묶인다. 되돌리려 해도 결제사는 내 트랜잭션 밖에 있다.',
      verification: '배송 실패를 일부러 내고 결제 취소와 재고 해제가 역순으로 도는지, 서로 다른 프로세스의 로그가 같은 trace ID로 이어지는지 본다.',
    },
    flow: {
      label: '실패 요청의 보상 경로',
      steps: [
        { label: 'ORDER_CREATED', detail: 'Spring order' },
        { label: 'PAYMENT_AUTHORIZED', detail: 'FastAPI payment-api' },
        { label: 'SHIPPING_REQUESTED', detail: 'FastAPI shipping-api, 409', tone: 'warning' },
        { label: 'PAYMENT_CANCELLED', detail: 'payment compensation', tone: 'success' },
        { label: 'INVENTORY_RELEASED', detail: 'stock compensation', tone: 'success' },
        { label: 'ORDER_FAILED', detail: 'Spring order' },
      ],
    },
    signals: [
      { label: '주문 API 구간', metric: 'Spring /api/saga/orders span' },
      { label: '결제 승인 구간', metric: 'payment-api /payments/authorize span' },
      { label: '결제 취소 구간', metric: 'payment-api /payments/{payment_id}/cancel span' },
      { label: '배송 접수 구간', metric: 'shipping-api /shipments span' },
      { label: '로그와 구간을 잇는 추적 ID', metric: 'trace_id' },
      { label: '보상 실행 횟수', metric: 'saga compensation counter' },
      { label: '화면이 결제 상태를 들은 시각', metric: 'tb_payment_projection.observed_at' },
    ],
    runbook: [
      'Saga 화면에서 배송 실패를 선택하고 실행한다.',
      '결과 타임라인에서 PAYMENT_CANCELLED와 INVENTORY_RELEASED 보상 단계를 확인한다.',
      'Grafana Explore에서 같은 trace_id로 Loki 로그와 Tempo span을 교차 확인한다.',
      'Service Graph에서 jaywiki가 jaywiki-payment-api와 jaywiki-shipping-api를 부르는 관계를 확인한다.',
      '화면의 결제·배송 칸이 기준 시각과 함께 표시되는지 본다. 원본이 아니라 이벤트로 받은 사본이다.',
    ],
    observability: [
      { label: 'Grafana', href: GRAFANA_ORIGIN },
      { label: 'Saga 실험실', href: '/saga/order' },
    ],
    wiki: [
      { label: 'Loki/Tempo 추적 글', slug: 'observability-loki-tempo-grafana' },
      { label: 'Saga와 Outbox 설계 글', slug: 'saga-kafka-outbox-order' },
      { label: '결제·배송 소유권을 뗀 기록', slug: 'msa-data-ownership-split' },
      { label: '아웃박스가 프로세스를 건넌 시점', slug: 'kafka-that-never-crossed-a-process' },
    ],
    retrospectives: [
      '롤백은 없던 일로 만들고 보상은 반대 작업을 새로 실행한다. 승인과 취소가 둘 다 남아야 나중에 "왜 취소됐나"를 설명할 수 있다.',
      '2PC를 쓰지 않은 이유는 조정자가 죽으면 참여자들이 자원을 잠근 채 무한정 기다리기 때문이다. 외부 결제사가 그 프로토콜을 지원해 줄 리도 없다.',
      '재고를 available과 reserved 두 칸으로 나누면 "얼마를 돌려놔야 하는지"를 따로 기억할 필요가 없다. 상태 자체가 답을 갖는다.',
      '처음에는 saga 전체를 하나의 @Transactional로 감쌌는데, 그러면 예외가 통째로 롤백돼서 보상이 실행될 일이 없었다. 단계마다 커밋해야 보상이 의미를 갖는다.',
      '경계를 나눈 대가로 원자성을 잃는다. 결제 호출 중에 죽으면 중단된 saga가 남고, 그걸 찾아 정리하는 복구 절차는 아직 없다.',
    ],
  },
  {
    id: 'kafka-dlq',
    eyebrow: 'Kafka',
    title: '주문 이벤트 fan-out과 DLQ',
    summary: 'DB에 저장하고 Kafka에 보내는 사이에서 서버가 죽으면 이벤트가 사라진다. 두 시스템에 원자적으로 쓸 방법은 없다. 실패를 일부러 내서 재시도 뒤 별도 대기열로 빠지는 것을 본다.',
    objective: '메시지 큐를 "비동기 처리"로만 설명하지 않는다. 유실을 막는 구조, 실패를 격리하는 방식, 그 대가로 감수하는 중복까지 함께 본다.',
    route: '/kafka/order',
    routeLabel: 'Kafka 실행 화면',
    proof: '알림이 안 간다고 주문을 못 받아야 할까? 주문 저장과 이벤트 기록을 같은 트랜잭션에 넣고, 발행은 별도 릴레이가 맡는다. 계속 실패하는 메시지는 DLQ로 옮겨 뒤를 흐르게 한다.',
    caseStudy: {
      title: '주문은 저장됐지만 알림 Consumer가 계속 실패한 상황',
      situation: '같은 주문 이벤트를 재고·알림·집계 consumer가 각자 받아 처리하는데, 알림 쪽만 계속 오류를 낸다.',
      risk: 'Kafka는 파티션 안에서 순서를 보장한다. 그래서 실패한 메시지 하나가 오프셋을 못 넘기면 그 뒤 메시지가 전부 막힌다. 독이 든 알약 하나가 줄 전체를 세운다.',
      verification: '주문과 이벤트가 같은 트랜잭션으로 저장되는지, 릴레이가 발행하는지, 일시 실패는 재시도로 풀리고 영구 실패는 DLQ로 빠지는지 순서대로 본다.',
    },
    flow: {
      label: '주문 이벤트의 격리 경로',
      steps: [
        { label: 'ORDER_SAVED', detail: 'PostgreSQL transaction' },
        { label: 'OUTBOX_RELAY', detail: 'publish after commit' },
        { label: 'TOPIC FAN-OUT', detail: 'independent consumers' },
        { label: 'RETRY', detail: 'notification failure', tone: 'warning' },
        { label: 'DLQ', detail: 'operator review queue', tone: 'success' },
      ],
    },
    signals: [
      { label: '주문 이벤트 발행 수', metric: 'jaywiki.kafka.orders' },
      { label: 'outbox 에 쌓인 건수', metric: 'jaywiki.kafka.outbox.events' },
      { label: 'consumer 가 받은 건수', metric: 'jaywiki.kafka.consumer.events' },
      { label: '지금 처리 중인 메시지', metric: 'jaywiki.kafka.consumer.processing' },
      { label: 'DLQ 알림 발화', metric: 'JaywikiKafkaDlqObserved' },
    ],
    runbook: [
      'Kafka 화면에서 계속 실패 모드를 선택하고 주문 이벤트를 생성한다.',
      'notification consumer가 재시도 후 DLQ로 이동하는지 확인한다.',
      'Prometheus/Grafana에서 orders, consumer, DLQ 지표가 증가하는지 본다.',
      'DLQ 알림 규칙이 실제로 firing 되는지 본다. 2026-08-19 운영 실측은 DLQ 도착에서 75초 안이었다.',
    ],
    observability: [
      { label: 'Grafana', href: GRAFANA_ORIGIN },
      { label: 'Kafka 실험실', href: '/kafka/order' },
    ],
    wiki: [
      { label: 'Saga와 Outbox 설계 글', slug: 'saga-kafka-outbox-order' },
      { label: '운영에서 재시도와 DLQ 를 잰 기록', slug: 'kafka-dlq-rehearsal' },
      { label: '알림으로 오는 것과 아직 안 오는 것', slug: 'alerting-inventory-and-gaps' },
      { label: 'CI/CD와 runner 글', slug: 'cicd-ghcr-runner' },
    ],
    retrospectives: [
      '이벤트를 같은 DB의 outbox 테이블에 주문과 함께 저장하면 두 시스템 문제가 한 시스템 문제로 바뀐다. 발행은 별도 릴레이가 나중에 한다.',
      '대신 발행 성공 뒤 상태 갱신 전에 죽으면 같은 이벤트를 또 보낸다. 유실은 아무도 모르지만 중복은 코드로 막을 수 있어서 이쪽을 택했다.',
      'consumer group이 다르면 같은 메시지를 각자 받고, 같으면 나눠 받는다. 오프셋이 group마다 따로라 알림이 막혀도 재고는 계속 간다.',
      'DLQ는 실패를 없애는 곳이 아니라 실패를 가둬서 나머지를 살리는 곳이다. 병을 고치는 게 아니라 번지는 걸 막는다.',
      '릴레이가 행을 잠그지 않으면 인스턴스가 둘일 때 같은 이벤트를 중복 발행한다. 선점(claim)으로 고쳤고, 선점만 하고 죽는 경우를 위해 타임아웃 회수를 뒀다.',
    ],
  },
  {
    id: 'redis-chat-queue',
    eyebrow: 'Redis / WebSocket',
    title: '랜덤채팅 정원과 대기열',
    summary: '서버가 두 대가 되는 순간 각자 다른 참가자 목록을 갖는다. 정원 3인 방에 6명이 들어가도 아무도 모른다. 가상 유저를 넣어 정원 초과분이 대기열로 가고 퇴장 시 승급되는 것을 본다.',
    route: '/chat',
    routeLabel: '채팅 실행 화면',
    objective: '여러 인스턴스가 공유해야 하는 상태는 프로세스 밖에 있어야 한다. 그리고 상태만 밖으로 빼는 걸로는 부족하다는 것까지 보여준다.',
    proof: '정원이 찬 방에 새 사용자가 들어오면? 참가자는 SET, 대기열은 입장 시각을 점수로 넣은 ZSET에 둔다. 순번을 O(log N)에 뽑을 수 있어야 "당신은 3번째입니다"를 보여줄 수 있다.',
    caseStudy: {
      title: '정원이 찬 채팅방에 새로운 사용자가 접속한 상황',
      situation: '정원 3명이 찬 방에 네 번째 사용자가 들어오고, 잠시 뒤 기존 참여자 한 명이 브라우저를 그냥 닫는다.',
      risk: '브라우저를 닫으면 "나간다"는 신호가 서버에 오지 않는다. 그 사람은 유령으로 자리를 계속 차지하고, 대기자는 하염없이 기다린다.',
      verification: '대기 순번이 입장 순서대로 매겨지는지, 퇴장 시 맨 앞이 자동 승급되는지, heartbeat가 끊긴 유령이 정리되는지 확인한다.',
    },
    flow: {
      label: '정원 초과 사용자의 승급 경로',
      steps: [
        { label: 'CONNECT', detail: 'WebSocket session' },
        { label: 'CAPACITY CHECK', detail: 'members SET' },
        { label: 'QUEUE', detail: 'Redis ZSET', tone: 'warning' },
        { label: 'LEAVE / TTL', detail: 'seat released' },
        { label: 'PROMOTE', detail: 'first waiter', tone: 'success' },
      ],
    },
    signals: [
      { label: '방 참가자 목록', metric: 'members SET' },
      { label: '대기열과 순번', metric: 'queue ZSET' },
      { label: '입·퇴장 이벤트 기록', metric: 'events STREAM' },
      { label: '살아 있다는 신호의 만료', metric: 'heartbeat TTL' },
      { label: '메시지 전송 제한', metric: 'message rate limit' },
    ],
    runbook: [
      '채팅 화면에서 가상 유저를 5명 추가한다.',
      '입장 3명, 대기열 3명이 되는지 확인한다.',
      '한 명을 퇴장시켜 대기 1번이 자동 승급되는지 본다.',
      'Redis debug view에서 members, queue, events를 비교한다.',
    ],
    observability: [
      { label: '채팅 실험실', href: '/chat' },
    ],
    wiki: [
      { label: 'Redis 채팅 대기열 글', slug: 'redis-random-chat-queue' },
    ],
    retrospectives: [
      '대기열을 LIST로 해도 FIFO는 되지만 "내 순번"을 알려면 전체를 훑어야 한다. 중간 이탈이 잦은 대기열에서는 ZSET이 맞다.',
      '"나갔다"는 신호를 기다리는 대신 "살아 있다"는 신호가 끊긴 걸 감지하도록 뒤집었다. TTL 키를 쓰면 만료를 직접 관리할 필요도 없다.',
      '이건 Kubernetes liveness probe나 Kafka consumer 세션 타임아웃과 같은 원리다. 신호가 안 오는 것 자체를 신호로 삼는다.',
      '상태는 Redis에 뒀는데 잠금은 synchronized로 JVM 안에 있었다. Pod가 둘이면 둘 다 "자리 있음"을 보고 정원이 깨진다. 확인과 입장을 Lua 한 스크립트로 묶어 고쳤다.',
      '데이터를 공유 저장소에 두면 됐다고 생각하기 쉬운데, 읽고 판단하고 쓰는 구간의 원자성은 별개 문제다.',
    ],
  },
  {
    id: 'search-compare',
    eyebrow: 'OpenSearch',
    title: 'LIKE, tsvector, nori 검색 비교',
    summary: '같은 검색어를 세 방식으로 실제 10만 건에 던지고 시간을 잰다. 이 화면의 숫자는 매번 다르다 — 실측이기 때문이다. OpenSearch를 내려도 검색이 유지되는지도 함께 본다.',
    route: '/board/search',
    routeLabel: '검색 비교 화면',
    objective: '"검색엔진이 좋다"가 아니라 언제 필요하고 언제 과한지를 가른다. 별도 클러스터를 띄우는 값을 하는지가 판단 기준이다.',
    proof: '"검색"으로 검색하면 "검색을 최적화했다"가 나올까? 한국어는 조사가 계속 붙는 교착어라 공백으로만 자르면 다른 단어가 된다. 형태소 분석기가 필요한 이유가 여기 있다.',
    caseStudy: {
      title: '띄어쓰기와 조사 때문에 원하는 문서를 찾지 못한 검색',
      situation: '사용자는 "검색"이라고 쳤는데 문서에는 "검색을"이라고 적혀 있다. 사람 눈에는 같은 말인데 시스템에는 다른 문자열이다.',
      risk: 'LIKE는 앞에 %가 붙으면 인덱스를 못 써서 10만 행을 전부 훑고, 단어 개념이 없어 "스프링"으로 "오프스프링"까지 걸린다. 그렇다고 검색엔진을 무작정 붙이면 클러스터와 색인 동기화라는 운영 비용이 생긴다.',
      verification: '같은 10만 건에 같은 검색어를 던져 세 방식의 결과 수와 걸린 시간을 나란히 본다.',
    },
    flow: {
      label: '동일 검색어의 세 가지 실행 경로',
      steps: [
        { label: 'QUERY', detail: 'same keyword' },
        { label: 'LIKE', detail: 'substring scan' },
        { label: 'TSVECTOR', detail: 'PostgreSQL FTS' },
        { label: 'NORI', detail: 'Korean analyzer' },
        { label: 'COMPARE', detail: 'quality + latency', tone: 'success' },
      ],
    },
    signals: [
      { label: '방식별 응답 시간' },
      { label: '검색어가 걸린 부분 표시', metric: 'OpenSearch highlight' },
      { label: '자동완성이 타는 대체 경로', metric: 'prefix LIKE fallback' },
      { label: 'OpenSearch 를 껐을 때의 동작', metric: 'replicas 0 / 1' },
    ],
    runbook: [
      '검색 비교 화면에서 nori 확인용 쿼리를 입력한다.',
      'LIKE, tsvector, OpenSearch 결과 수와 snippet을 비교한다.',
      'OpenSearch를 제어판에서 내렸을 때 fallback이 유지되는지 확인한다.',
      '검색엔진을 왜 별도로 두는지 위키 글로 정리한다.',
    ],
    observability: [
      { label: '검색 비교', href: '/board/search' },
      { label: '관리자 서비스 제어판', href: '/admin/services' },
    ],
    wiki: [
      { label: '10만 검색 비교 글', slug: 'search-comparison-100k' },
      { label: 'CI/CD와 runner 글', slug: 'cicd-ghcr-runner' },
    ],
    retrospectives: [
      'LIKE가 느린 건 인덱스를 못 써서다. B-tree는 사전처럼 앞에서부터 찾는데, 앞이 와일드카드면 사전을 처음부터 끝까지 읽는 것과 같다.',
      'tsvector는 저장할 때 미리 단어로 쪼개 역색인을 만든다. 다만 PostgreSQL에 한국어 사전이 없어 simple 설정을 쓰므로 조사를 떼지 못한다.',
      'nori는 "검색을"을 명사 "검색"과 조사 "을"로 분해하고 조사를 버린다. 색인할 때와 검색할 때 같은 분석기를 써야 매칭된다.',
      '자동완성은 앞이 고정된 prefix 검색이라 LIKE로도 인덱스를 탄다. 방식마다 맞는 자리가 다르다.',
      '색인은 DB의 사본이라 어긋날 수 있다. SQL로 직접 지웠더니 검색에는 남아 있는 유령 문서를 실제로 겪었다.',
    ],
  },
  {
    id: 'hpa-scaleout',
    eyebrow: 'k3s / HPA',
    title: '부하에 반응하는 Pod 자동 확장',
    summary: '오토스케일링은 부하를 걸어 보기 전까지 YAML 파일일 뿐이다. 진짜 부하를 만들어 replica가 2→3→2로 움직이는 걸 본다. CPU가 80% 기준선을 넘는 순간을 지켜본다.',
    route: '/monitoring',
    routeLabel: '모니터링 열기',
    objective: '설정값 하나하나에 판단이 들어 있다. 확장은 즉시, 축소는 5분을 기다리게 한 이유까지 화면에서 읽히게 만든다.',
    proof: 'CPU가 기준선을 넘으면? Pod가 늘어난다. 그런데 "CPU 80%"의 기준은 코어가 아니라 Pod에 요청한 CPU다. 그걸 안 잡으면 분모가 없어서 HPA는 아무것도 하지 않는다.',
    caseStudy: {
      title: '짧은 트래픽 증가로 Spring API CPU가 기준선을 넘은 상황',
      situation: '평소 Pod 두 개로 도는 API에 검색 요청이 몰려 CPU가 목표치를 넘었다. 사람이 늘리면 알람 확인부터 Pod 준비까지 15분이 걸린다.',
      risk: '확장이 늦으면 사용자가 에러를 보고, 축소가 성급하면 늘렸다 줄였다를 반복하며 매번 기동 비용을 낸다. 그리고 병목이 DB라면 Pod를 늘릴수록 DB가 더 빨리 죽는다.',
      verification: '부하 Pod가 실제로 CPU를 올리는지, desired와 ready replica 사이의 지연이 얼마인지, 부하가 끝난 뒤 안정화 구간을 거쳐 최소 개수인 2로 돌아오는지 본다.',
    },
    flow: {
      label: 'HPA reconcile 흐름',
      steps: [
        { label: '1 POD READY', detail: 'steady state' },
        { label: 'LOAD JOB', detail: '8 workers · 180s', tone: 'warning' },
        { label: 'CPU > 80%', detail: 'metrics-server' },
        { label: 'SCALE 1 → 2', detail: 'second Pod ready', tone: 'success' },
        { label: 'SCALE 2 → 1', detail: '300s stabilization', tone: 'success' },
      ],
    },
    signals: [
      { label: '지금 CPU 와 목표치', metric: 'HPA current / target' },
      { label: '원하는 Pod 수와 실제 준비된 수', metric: 'desired / ready replicas' },
      { label: 'Pod 준비·재시작·자원', metric: 'ready · restarts · cpu · memory' },
      { label: '부하 Job 상태', metric: 'active / succeeded / failed' },
      { label: '보낸 건수와 응답 시간', metric: 'requests · failed · avg / max ms' },
      { label: '늘어난 시각과 줄어든 시각' },
    ],
    runbook: [
      '관리자로 로그인해 HPA 리허설 실행 버튼을 누른다.',
      '워커 수를 고르면 Kubernetes Job이 180초 동안 검색 API에 부하를 생성한다.',
      'CPU가 80% 기준선을 넘고 세 번째 Pod가 Ready가 되는지 확인한다.',
      '부하 종료 뒤 300초 안정화 구간을 거쳐 replica가 2로 복귀하는지 본다.',
    ],
    observability: [
      { label: '모니터링', href: '/monitoring' },
      { label: 'Grafana', href: GRAFANA_ORIGIN },
    ],
    wiki: [
      { label: 'k3s manifest 경계', slug: 'k3s-manifest-boundaries' },
      { label: '파드 둘에서 세션과 부하를 실측한 기록', slug: 'session-crossed-three-pods' },
      { label: 'miniPC k3s 배포 구조', slug: 'minipc-k3s-cloudflare' },
    ],
    retrospectives: [
      '확장은 stabilization 0초, 축소는 300초로 비대칭이다. 확장이 늦으면 사용자가 손해를 보고 축소가 늦으면 비용만 조금 더 든다. 불확실하면 손해가 작은 쪽으로 기운다.',
      '축소에 창을 두지 않으면 늘렸다 줄였다를 반복하는 진동이 생긴다. 매번 JVM 워밍업 비용을 다시 낸다.',
      'HPA는 CPU가 병목일 때만 답이다. 병목이 DB면 Pod를 늘릴수록 커넥션 요구가 늘어 DB가 먼저 무너진다.',
      'HPA를 켜고 나서야 이 서비스가 수평 확장을 못 견딘다는 걸 알았다. 채팅 정원 제어는 JVM 잠금이었고 Outbox 릴레이는 행을 안 잠갔다. 둘 다 Pod가 하나로 돌던 동안에는 멀쩡했다.',
      '수평 확장은 인프라 설정이 아니라 애플리케이션 설계 문제다. 상태를 밖으로 뺐다고 끝이 아니라 잠금도 밖에 있어야 한다.',
      '같은 miniPC 안에서 Pod가 늘어나는 것이므로 노드 장애 고가용성 증거는 아니다. 폭도 좁아서 minReplicas 2, maxReplicas 3이다.',
    ],
  },
  {
    id: 'backup-restore',
    eyebrow: 'Backup',
    title: 'PostgreSQL 백업과 외부 복제',
    summary: '백업은 복원해보기 전까지 백업이 아니다. 최신 dump를 실제로 임시 DB에 복원해 원본과 건수를 대조한다. sha256 으로 파일이 상하지 않았는지 먼저 보고, 원본은 읽기만 한다.',
    route: '/wiki/postgres-backup-restore',
    routeLabel: '백업·복원 리허설 글',
    objective: '백업 이야기는 RPO와 RTO 두 숫자로 시작해야 한다. 얼마나 잃어도 되는지, 얼마나 빨리 돌아와야 하는지를 먼저 정한다.',
    proof: '백업 파일이 있으면 안심해도 될까? 파일이 손상됐거나, 복원 명령을 아무도 모르거나, 세 시간이 걸린다면 그건 백업이 아니다. 전부 미리 해보면 알 수 있는 것들이다.',
    caseStudy: {
      title: 'miniPC 저장장치 장애로 운영 DB를 읽을 수 없는 상황',
      situation: '매일 03시 17분에 dump가 생성되고 sha256도 함께 남는다. 그런데 그 파일이 운영 DB와 같은 장치에 있다.',
      risk: '장치가 통째로 고장 나면 원본과 백업을 함께 잃는다. 3-2-1 규칙에서 "최소 하나는 다른 장소에"를 못 지키고 있는 상태다.',
      verification: 'checksum을 검증하고 임시 DB에 실제로 복원한 뒤 핵심 테이블 건수를 원본과 비교한다. 원본은 읽기만 하고 복원은 항상 새 임시 DB로만 한다.',
    },
    flow: {
      label: '백업 생성부터 복원 검증까지',
      steps: [
        { label: 'PG_DUMP', detail: 'CronJob' },
        { label: 'CHECKSUM', detail: 'sha256' },
        { label: 'OFF-SITE', detail: 'external copy' },
        { label: 'RESTORE', detail: 'temporary DB', tone: 'warning' },
        { label: 'VERIFY', detail: 'schema + row count', tone: 'success' },
      ],
    },
    signals: [
      { label: '매일 도는 백업 작업', metric: 'jaywiki-postgres-backup CronJob' },
      { label: '만들어진 덤프 파일', metric: 'portfolio-*.dump' },
      { label: '파일 손상 검사값', metric: 'portfolio-*.dump.sha256' },
      { label: '덤프 안에 무엇이 들었는지', metric: 'pg_restore --list' },
      { label: '복원한 DB 의 테이블 건수', metric: 'restore rehearsal row count' },
    ],
    runbook: [
      'backup CronJob이 최신 dump와 sha256을 만들었는지 확인한다.',
      'scripts/rehearse-postgres-restore.sh 로 sha256 검증과 임시 DB 복원을 한 번에 실행한다.',
      '임시 DB의 핵심 테이블 row count를 원본과 비교한다.',
      'Phase B에서는 같은 파일을 R2로 복제하고 R2에서 다시 내려받아 복구한다.',
    ],
    observability: [
      { label: '백업·복원 리허설 글', href: '/wiki/postgres-backup-restore' },
      { label: 'CI/CD와 runner 글', href: '/wiki/cicd-ghcr-runner' },
    ],
    wiki: [
      { label: '백업/복원 리허설', slug: 'postgres-backup-restore' },
    ],
    retrospectives: [
      '하루 한 번 dump라 RPO가 최대 24시간이다. 위키 글은 시드 파일에도 있고 게시판은 데모 데이터라 감당 가능하다고 판단했다.',
      'format을 custom으로 쓰는 이유는 압축보다 테이블 단위 선택 복원과 병렬 복원이 가능해서다. 실수로 테이블 하나 날렸을 때 전체를 되돌릴 필요가 없다.',
      'sha256을 같이 만드는 이유는 파일 손상이 조용히 일어나기 때문이다. 장애 상황에서 처음 알면 안 된다.',
      '테이블 필터를 두지 않아 새 테이블이 자동으로 포함된다. 블로그 테이블이 생겼을 때 설정을 하나도 안 고쳐도 백업 대상이 됐다.',
      '리허설이 사고를 내면 안 되므로 복원은 항상 타임스탬프가 붙은 새 DB로만 하고, 스크립트가 끝나면 어떤 경로로든 임시 자원을 정리한다.',
      '백업은 마지막 방어선이지 첫 번째가 아니다. 잘못된 UPDATE는 백업으로 돌려도 그 사이 정상 거래까지 함께 사라진다.',
    ],
  },
  {
    id: 'alert-chain-drill',
    eyebrow: 'Prometheus / Alertmanager',
    title: '오류 한 건이 휴대폰까지 가는 길',
    summary: '500 한 건은 비율 알림의 문턱을 못 넘는다. 트래픽이 적은 사이트에서는 사고가 그대로 묻힌다. 오류를 일부러 내서 지표와 로그 중 어느 쪽이 먼저 잡고 텔레그램까지 가는지 본다.',
    route: '/wiki/silent-500-alert-gap',
    routeLabel: '알림이 울리지 않은 500 기록',
    objective: '알림은 켜 두는 것이 아니라 도착을 확인해야 끝난다. 규칙을 쓰고 문구를 다듬어도 그것이 실제로 휴대폰까지 가는지는 사고가 한 번 나기 전까지 알 수 없다.',
    proof: '규칙 파일에 한글로 정성껏 쓴 문구가 알림에 한 글자도 안 실린 적이 있다. 템플릿이 uri 라벨 유무로 갈래를 나눴는데 그 갈래가 annotations 를 읽지 않아서였다. 문구를 쓴 것과 그 문구가 도착하는 것은 다른 일이다.',
    caseStudy: {
      title: '오류는 났는데 알림이 울리지 않은 관리자 저장 실패',
      situation: '관리자 화면이 발행일을 잘못된 형식으로 보내 저장이 막혔다. 서버는 500 을 냈고 지표에도 남았다.',
      risk: '5xx 알림이 비율 규칙 하나뿐이라 500 한 건은 문턱을 못 넘었다. 트래픽이 적은 사이트에서는 사고가 나도 비율이 안 움직여서, 관리자가 저장 한 번 못 한 일이 아무에게도 안 알려진다.',
      verification: '오류를 종류별로 일부러 내고, 지표와 로그 양쪽이 규칙을 통과해 텔레그램까지 도착하는지 본다. 도착 시각과 문구를 눈으로 대조한다.',
    },
    flow: {
      label: '오류 한 건이 알림이 되는 경로',
      steps: [
        { label: 'DRILL', detail: 'forced error' },
        { label: 'METRIC · LOG', detail: 'uri별 증가 / trace_id', tone: 'warning' },
        { label: 'RULE', detail: '10분 창, 건수' },
        { label: 'ALERTMANAGER', detail: 'group · inhibit' },
        { label: 'TELEGRAM', detail: '도착 확인', tone: 'success' },
      ],
    },
    signals: [
      { label: '응답 코드별 요청 수', metric: 'http_server_requests_seconds_count' },
      { label: '아무 핸들러도 안 잡은 예외', metric: 'status=500 로그' },
      { label: '로그와 구간을 잇는 추적 ID', metric: 'trace_id' },
      { label: '규칙이 발화한 시각' },
      { label: '휴대폰에 도착까지 걸린 초' },
      { label: '지표 알림이 로그 알림에 묶였는지' },
    ],
    runbook: [
      '드릴 종류를 고르고 실행한다. 500·400 은 한 번, 403 은 5분 안에 10건, p95 는 2분 넘게 이어져야 규칙이 판단한다.',
      '지표와 로그 중 어느 쪽이 먼저 규칙을 통과했는지 본다.',
      '텔레그램에 도착한 문구에서 규칙 이름·에러코드·경로·trace_id 를 확인한다.',
      '같은 사고를 둘이 잡았으면 로그 알림만 오고 지표 알림은 억제됐는지 본다.',
    ],
    observability: [
      { label: '알림 열다섯과 아직 오지 않는 둘', href: '/wiki/alerting-inventory-and-gaps' },
      { label: '오류는 났는데 알림이 울리지 않았다', href: '/wiki/silent-500-alert-gap' },
    ],
    wiki: [
      { label: '알림이 울리지 않은 500', slug: 'silent-500-alert-gap' },
      { label: '알림 열다섯과 오지 않는 둘', slug: 'alerting-inventory-and-gaps' },
      { label: '알림 체계 밖의 판정자', slug: 'watchdog-outside-the-cluster' },
    ],
    retrospectives: [
      '비율 규칙 하나로는 트래픽이 적은 사이트를 못 지킨다. 건수 규칙을 따로 뒀고, uri 를 함께 실어 어느 API 인지 알림에서 바로 읽히게 했다.',
      'increase() 를 쓰면 그 API 에서 처음 나는 5xx 를 0으로 센다. 시계열이 값 1로 태어나 창 안의 첫 표본과 마지막 표본이 같기 때문이다. 지금 값에서 10분 전 값을 빼되 그때 없던 시계열은 0으로 두는 식으로 바꿨다.',
      '단발을 무시할지 말지는 규칙마다 다르다. 500 한 건은 사고지만 403 한 건은 남이 문을 두드린 것이라, 403 은 5분에 10건이 5분간 이어질 때만 본다.',
      'repeat_interval 을 group_interval 과 같게 두면 주기가 두 배가 된다. 묶음은 group_interval 눈금에서만 깨어나고, 직전 통보가 눈금보다 조금 뒤에 끝나면 다음 눈금에서 간발로 건너뛴다.',
      '알림 체계가 죽었다는 것은 그 체계 밖에서만 알 수 있다. 조건 없이 항상 firing 하는 규칙을 클러스터 밖 healthchecks.io 로 보내고, 그 신호가 끊기면 저쪽이 자기 채널로 알린다.',
      '이 드릴을 관리자로 막은 이유는 부하가 아니다. 예외 하나 던지는 것이라 제일 가볍다. 알림은 되돌릴 수 없고 사람을 깨우며, 5xx 지표는 운영 판단에 쓰는 숫자다.',
      '드릴이 덮는 것은 텔레그램까지 오는 규칙 열다섯 중 다섯이다. 노드 메모리·디스크·백업 Job 실패·pod 재시작·백엔드 다운은 애플리케이션이 만드는 사고가 아니라 여기서 낼 수 없다. 그중 백업 Job 실패 규칙은 아직 한 번도 검증되지 않았다 — kube_job_failed 시계열이 실패한 Job 에만 생겨서, 실패가 한 번 나기 전까지는 조회해도 비어 있다.',
    ],
  },
  {
    id: 'traffic-burst-control',
    eyebrow: 'Traffic / Backpressure',
    title: '이벤트 트래픽 폭주 제어',
    summary: '들어오는 양이 처리하는 양을 넘으면 초과분은 사라지지 않는다. 버리거나, 미루거나, 아니면 다 같이 죽는다. 같은 폭주를 여러 모드로 흘려 초과 요청이 어디에 남는지 비교한다.',
    route: '/domain-scenarios/traffic-burst',
    routeLabel: '트래픽 리허설',
    objective: '"대용량 처리"를 최대 RPS 숫자로 포장하지 않는다. 넘칠 때 무엇을 포기할 것인지가 실제 설계 결정이다.',
    proof: '아무 대비도 안 하면 어떻게 될까? 초과분이 전부 서버 안으로 들어와 자원을 나눠 갖고, 감당 가능했던 요청까지 같이 느려진다. 일부가 실패하는 게 아니라 전부 실패한다.',
    caseStudy: {
      title: '한정 상품 판매 시작과 동시에 몰린 주문 요청',
      situation: '초당 600건이 들어오는데 서버는 220건을 처리한다. 매초 380건이 어딘가에 쌓인다. 게다가 그중 상당수는 같은 사람의 중복 클릭이다.',
      risk: '아무것도 정하지 않으면 시스템은 자동으로 "다 같이 느려지기"를 택한다. 그리고 전부 타임아웃되면 재시도가 몰려 부하가 더 커진다.',
      verification: '직접 처리, 빠른 거절, 큐 버퍼링, 느린 소비자, 중복 제거, 확장 복구를 같은 입력으로 나란히 비교한다.',
    },
    flow: {
      label: '폭주 입력을 제어하고 복구하는 경로',
      steps: [
        { label: 'BURST', detail: 'bounded input', tone: 'warning' },
        { label: 'ADMISSION', detail: 'rate + dedupe' },
        { label: 'BUFFER', detail: 'Kafka topic' },
        { label: 'CONSUME', detail: 'bounded throughput' },
        { label: 'RECOVER', detail: 'lag → 0', tone: 'success' },
      ],
    },
    signals: [
      { label: '초당 들어온 수와 처리한 수', metric: 'incoming / processed RPS' },
      { label: '응답 시간 상위 5%', metric: 'p95 latency' },
      { label: '거절·중복으로 걸러진 수', metric: '429 · dedupe' },
      { label: '큐에 밀려 있는 양', metric: 'kafka consumer lag' },
      { label: 'Pod 수 변화', metric: 'replicas' },
      { label: '밀린 것이 0 이 되기까지' },
    ],
    runbook: [
      '직접 처리 모드에서 입력과 처리량 차이, p95와 backlog를 기준선으로 확인한다.',
      '빠른 제한과 Kafka 버퍼 모드에서 초과 요청과 lag가 어디에 남는지 비교한다.',
      '느린 Consumer와 중복 폭주에서 처리량 저하와 조기 제거 효과를 확인한다.',
      '복구 모드에서 replica 확장 뒤 lag가 0이 되는 시간을 최근 실행에 남긴다.',
    ],
    observability: [
      { label: '트래픽 리허설', href: '/domain-scenarios/traffic-burst' },
      { label: '모니터링', href: '/monitoring' },
      { label: 'Grafana', href: GRAFANA_ORIGIN },
    ],
    wiki: [
      { label: 'Kafka Outbox 설계', slug: 'saga-kafka-outbox-order' },
      { label: 'k3s manifest 경계', slug: 'k3s-manifest-boundaries' },
    ],
    retrospectives: [
      '사용자에게는 30초 기다리다 실패하는 것보다 0.1초 만에 실패를 아는 게 낫다. 그동안 자원도 안 쓰고, 기다린 만큼 화도 덜 난다.',
      '거절은 최대한 앞단에서 해야 의미가 있다. DB 커넥션까지 잡은 뒤에 거절하면 이미 자원을 다 쓴 것이다.',
      '큐는 순간 폭주를 흡수할 뿐 지속적인 처리량 부족은 해결하지 못한다. 평균 입력이 평균 처리량보다 크면 lag은 무한히 쌓인다.',
      '큐를 쓰면 응답은 빨라지고 완료는 느려진다. 응답 시간만 보면 개선된 것처럼 보이므로 완료까지의 시간을 따로 재야 한다.',
      '폭주의 상당수는 중복 클릭이다. 성능 문제로 보이지만 실제로는 멱등성 설계로 푸는 문제다.',
      '실행 파라미터를 서버에 고정해 공개 사이트가 임의 부하 도구가 되지 않게 했다.',
    ],
  },
  {
    id: 'gift-card-consistency',
    eyebrow: 'Gift card / Idempotency',
    title: '상품권 사용 정합성',
    summary: '잔액을 컬럼 하나로 들면 "왜 4만 원이죠?"에 답할 수 없다. 현재 값만 있고 과정이 없기 때문이다. 중복 재전송과 동시 사용을 일으켜 잔액이 한 번만 바뀌는지 타임라인으로 본다.',
    route: '/domain-scenarios/gift-card',
    routeLabel: '상품권 리허설',
    objective: '돈을 다루는 잔액에서 원장 방식과 멱등키가 왜 선택이 아니라 전제인지 보여준다.',
    proof: '같은 사용 요청이 두 번 오면? 멱등키에 UNIQUE 제약을 걸고, "먼저 조회해서 없으면 삽입"이 아니라 "일단 삽입하고 걸리면 기존 결과 반환"으로 간다. 먼저 조회하면 두 요청이 동시에 "없다"를 보는 순간이 생긴다.',
    caseStudy: {
      title: '사용은 완료됐지만 응답을 받지 못한 상품권 결제',
      situation: '10,000원 차감은 서버에서 정상 커밋됐는데 응답이 고객에게 도착하지 못했다. 고객 화면에는 아무 일도 안 일어난 것처럼 보인다.',
      risk: '고객이 다시 누르면 잔액이 두 번 빠진다. 그리고 취소를 잔액 덮어쓰기로 처리하면 "언제 얼마가 왜 빠졌는지"를 나중에 아무도 설명할 수 없다.',
      verification: '같은 멱등키 재전송, 마지막 잔액 경합, 응답 유실 뒤 결과 복구, 그리고 취소가 삭제가 아니라 반대 부호 원장으로 남는지 확인한다.',
    },
    flow: {
      label: '상품권 잔액 변경 경계',
      steps: [
        { label: 'REQUEST', detail: 'idempotency key' },
        { label: 'BALANCE CHECK', detail: 'available amount' },
        { label: 'LEDGER APPEND', detail: 'single transition' },
        { label: 'RETRY', detail: 'reuse first result', tone: 'warning' },
        { label: 'AUDITABLE', detail: 'balance + ledger', tone: 'success' },
      ],
    },
    signals: [
      { label: '변경 전후 잔액' },
      { label: '같은 요청임을 알아보는 키', metric: 'idempotency key' },
      { label: '원장에 쌓인 거래 단계' },
      { label: '중복 요청으로 판정된 건' },
      { label: '취소로 남은 반대 부호 원장' },
    ],
    runbook: [
      '정상 사용으로 기준 상태 전이를 확인한다.',
      '중복 재전송과 동시 사용 모드를 실행해 잔액이 한 번만 변경되는 결과를 비교한다.',
      '응답 유실과 취소 모드에서 조회·복구 경로를 타임라인으로 확인한다.',
      '최근 실행에서 같은 결과가 PostgreSQL에 남는지 확인한다.',
    ],
    observability: [{ label: '상품권 리허설', href: '/domain-scenarios/gift-card' }],
    wiki: [],
    retrospectives: [
      '원장은 현재 값이 아니라 변동 이력을 저장한다. 취소도 기존 행을 지우지 않고 반대 부호 행을 추가해서 승인과 취소가 둘 다 남는다.',
      '조회 성능을 위해 잔액 캐시 컬럼을 함께 두되, 원본은 원장이다. 주기적으로 합계와 대조해 어긋나면 알람을 띄운다.',
      '"먼저 조회 후 없으면 삽입"은 동시 요청에서 뚫린다. 확인을 애플리케이션이 하지 말고 UNIQUE 제약이 하게 해야 한다.',
      'CHECK 제약으로 잔액이 음수가 될 수 없게 막아 두면 어떤 코드 경로로 와도 데이터가 안 깨진다. 마지막 방어선은 애플리케이션이 아니라 DB에 둔다.',
      '멱등키는 클라이언트가 만들어야 한다. 서버가 만들면 재전송할 때 또 새 키가 생겨 다른 요청이 된다.',
      '타임아웃 재시도가 여기서는 안전한 이유는 내가 멱등을 보장하기 때문이다. 외부 제휴사를 부를 때와 판단이 갈리는 지점이다.',
    ],
  },
  {
    id: 'partner-api-resilience',
    eyebrow: 'HTTP / Callback',
    title: '외부 제휴 API 장애 대응',
    summary: '로컬 호출은 성공 아니면 예외다. 네트워크 너머는 성공·실패·모름 셋이고, 그 "모름"이 모든 걸 어렵게 만든다. 실패 유형별로 재시도와 확정 경로가 어떻게 달라지는지 비교한다.',
    route: '/domain-scenarios/partner-api',
    routeLabel: '외부 API 리허설',
    objective: '네 가지 실패를 같은 실패로 취급하면 반드시 하나는 틀린 대응을 하게 된다. 구별 기준은 "상대가 나에게 뭘 알려줬는가"다.',
    proof: '응답이 안 오면 재시도하면 될까? 상대가 이미 처리했는데 응답만 유실됐을 수 있다. 그러면 결제가 두 번 된다. 멱등 보장이 없으면 재시도하면 안 된다.',
    caseStudy: {
      title: '승인 응답이 사라진 제휴 상품권 발행 요청',
      situation: '제휴사에 발행을 요청했는데 응답이 오지 않았다. 요청이 도달도 못 한 건지, 처리는 됐는데 회신만 유실된 건지 내 쪽에서는 구별할 수 없다.',
      risk: '그냥 다시 보내면 중복 발행된다. 그렇다고 callback을 그대로 믿으면, 주소만 알면 누구나 두드릴 수 있으니 위조 요청에 주문이 성공 처리된다.',
      verification: 'timeout은 재시도하지 않고 callback으로 확정하는지, 429는 Retry-After를 지키는지, 5xx는 제한된 횟수만 시도하는지, 서명이 틀린 callback이 상태를 못 바꾸는지 본다.',
    },
    flow: {
      label: '외부 응답의 최종 확정 경로',
      steps: [
        { label: 'SIGNED REQUEST', detail: 'correlation ID' },
        { label: 'CLASSIFY', detail: 'timeout · 429 · 5xx' },
        { label: 'BACKOFF', detail: 'bounded retry', tone: 'warning' },
        { label: 'CALLBACK', detail: 'signature check' },
        { label: 'RECONCILE', detail: 'final state', tone: 'success' },
      ],
    },
    signals: [
      { label: '응답을 넷 중 무엇으로 분류했나', metric: 'timeout · 429 · 5xx · ok' },
      { label: '재시도한 횟수', metric: 'retry count' },
      { label: 'callback 서명 검증 결과', metric: 'HMAC signature' },
      { label: '요청과 회신을 잇는 식별자', metric: 'correlation ID' },
      { label: '최종 확정 상태' },
    ],
    runbook: [
      '정상 승인과 timeout callback을 실행해 동기·비동기 확정 차이를 비교한다.',
      'HTTP 429와 500 모드에서 backoff와 circuit 단계가 다른지 확인한다.',
      '서명 오류 callback이 상태를 변경하지 못하는지 확인한다.',
      '최근 실행에서 실패도 운영 판단 근거로 남는지 본다.',
    ],
    observability: [{ label: '외부 API 리허설', href: '/domain-scenarios/partner-api' }],
    wiki: [],
    retrospectives: [
      '멱등성은 편의 기능이 아니라 재시도를 허락하는 권한이다. 상대가 보장하지 않으면 타임아웃에 재시도하면 안 된다.',
      '429는 상대가 재시도 시점을 알려주는 유일한 실패다. Retry-After를 무시하면 나는 또 실패하고 상대는 더 아파진다.',
      '5xx에 무한 재시도하면 상대 장애가 내 스레드를 묶어 내 장애가 된다. 제한 재시도와 빠른 포기가 그 전파를 끊는다.',
      'callback은 방향이 반대라 누구나 호출할 수 있다. 공유 비밀키로 HMAC을 계산해 맞는지 보고, 틀리면 상태를 안 바꾸고 감사 기록만 남긴다.',
      '서명은 위조를 막지만 재전송은 못 막는다. timestamp를 서명 대상에 넣고 시간창을 검사하거나 correlation ID를 한 번만 쓰게 해야 한다.',
      '서킷 브레이커는 아직 없다. 5xx에서 하는 건 재시도 소진 뒤 fail-fast고, 화면에도 그대로 표시한다.',
      '상대 시뮬레이터를 별도 서비스로 띄워 실제 HTTP로 통신한다. 응답 시간과 시도 횟수는 이번 실행의 실측값이다.',
    ],
  },
  {
    id: 'coupon-race-condition',
    eyebrow: 'Coupon / Concurrency',
    title: '선착순 쿠폰 발급 경합',
    summary: '선착순은 모두가 같은 행 하나를 노린다. 그래서 일반적인 락 전략이 전부 잘 안 통한다. 동시 요청을 쏟아 초과 발급을 재현하고 조건부 갱신과 Redis 스크립트 결과를 비교한다.',
    route: '/scenarios/coupon-race-condition',
    routeLabel: '쿠폰 발급 리허설',
    objective: '총량을 지키는 것과 1인 1매를 지키는 것은 다른 방어다. 하나만 하면 반드시 구멍이 생긴다.',
    proof: '쿠폰 100장에 요청 120개가 오면? 낙관적 락은 거의 전부 충돌해 재시도가 폭증하고, 비관적 락은 전부 한 줄로 대기한다. 조건을 SQL 안에 넣으면 락 대기도 재시도도 없다.',
    caseStudy: {
      title: '100장 쿠폰에 동시에 도착한 120개 요청',
      situation: '120개 요청이 거의 같은 순간에 "아직 100장 남았네"를 읽는다. 그리고 각자 발급을 기록한다.',
      risk: '수량을 넘겨 120장이 나간다. 설령 수량을 맞춰도 그중 28건이 같은 사람의 중복 클릭이었다면 누군가는 세 장을 받고 누군가는 못 받는다. 총량은 맞는데 불공정하다.',
      verification: '조건부 UPDATE의 갱신 행 수, Redis Lua의 원자성, 그리고 캠페인·사용자 조합 UNIQUE가 1인 1매를 따로 지키는지 비교한다.',
    },
    flow: { label: '동시 발급의 제한 경로', steps: [
      { label: 'BURST', detail: '120 concurrent requests' },
      { label: 'ATOMIC LIMIT', detail: 'DB update / Redis Lua' },
      { label: 'DEDUP', detail: 'campaign-user key' },
      { label: 'LEDGER', detail: 'issue record' },
      { label: 'RECONCILE', detail: 'stock vs ledger', tone: 'success' },
    ] },
    signals: [
      { label: '들어온 요청 수' },
      { label: '발급에 성공한 수' },
      { label: '품절로 거절된 수' },
      { label: '중복 클릭으로 걸러진 수' },
      { label: '남은 재고와 발급 원장의 차이' },
    ],
    runbook: ['조회 후 발급 모드에서 초과 발급을 확인한다.', '조건부 UPDATE와 Redis Lua 결과를 비교한다.', '중복 요청이 최초 발급 결과로 수렴하는지 본다.', '재고와 발급 원장을 대조한다.'],
    observability: [{ label: '쿠폰 발급 리허설', href: '/scenarios/coupon-race-condition' }],
    wiki: [],
    retrospectives: [
      '조건부 UPDATE가 안전한 이유는 DB가 그 행을 잠근 채 확인과 갱신을 한 번에 하기 때문이다. 애플리케이션은 갱신 행 수가 1인지 0인지만 보면 된다.',
      'Redis Lua가 원자적인 이유는 Redis가 명령을 단일 스레드로 처리하고 스크립트 전체를 하나의 명령처럼 실행하기 때문이다. 그래서 스크립트는 짧아야 한다.',
      '수만 건이 넘어가면 Redis를 게이트로 세워 DB를 보호한다. 대신 두 곳이 어긋날 수 있어 발급 후 대조가 필요하다.',
      '총량 정확성과 1인 1매 정확성은 다른 방어다. 후자는 캠페인·사용자 UNIQUE로 지키고, 여기서도 "먼저 조회"가 아니라 제약이 판단해야 한다.',
      '대기열 방식도 있지만 선착순은 즉시성이 경험의 핵심이라 게이트 방식이 맞다고 봤다.',
    ],
  },
  {
    id: 'settlement-batch-retry',
    eyebrow: 'Batch / Idempotency',
    title: '정산 배치 재실행과 부분 복구',
    summary: '온라인 요청은 성공 아니면 실패지만 배치에는 "1만 건 중 7,500건까지 하고 죽은" 부분 성공이 있다. 중간에 죽은 배치를 다시 돌려 완료 건을 건너뛰고 건수와 금액이 맞는지 대조한다.',
    route: '/scenarios/settlement-batch-retry',
    routeLabel: '정산 배치 리허설',
    objective: '정확성·성능·검증의 역할을 가른다. 체크포인트는 성능 최적화지 정확성 보장이 아니다.',
    proof: '전체를 한 트랜잭션으로 묶으면 되지 않을까? 락이 오래 걸리고 로그가 폭증하며, 한 건 실패로 9,999건을 되돌리는 건 낭비다. 청크로 나눠 커밋하는 순간 부분 성공은 필연이 된다.',
    caseStudy: { title: '7,500건 처리 후 종료된 일 정산 배치', situation: '10,000건 중 7,500건을 반영한 시점에 프로세스가 죽었다. 같은 정산일을 다시 돌려야 한다.', risk: '그냥 처음부터 다시 돌리면 이미 끝난 7,500건이 중복 정산된다. 돈이 두 번 나가는 것이다.', verification: '거래·정산일 UNIQUE로 중복이 막히는지, 체크포인트가 시간을 줄이는지, 실패 구간만 골라 재처리되는지, 마지막에 원본과 합계가 맞는지 본다.' },
    flow: { label: '배치 재실행의 복구 경로', steps: [
      { label: 'PARTIAL RUN', detail: '7,500 / 10,000' },
      { label: 'CHECKPOINT', detail: 'cursor / partition' },
      { label: 'IDEMPOTENT WRITE', detail: 'trade-date unique' },
      { label: 'RETRY', detail: 'failed range only' },
      { label: 'RECONCILE', detail: 'count and amount', tone: 'success' },
    ] },
    signals: [
      { label: '원본 거래 건수' },
      { label: '정산을 마친 건수' },
      { label: '어디까지 했는지 표시', metric: 'checkpoint cursor' },
      { label: '이미 했다고 건너뛴 수', metric: 'ON CONFLICT DO NOTHING' },
      { label: '원본과 정산의 합계 차이' },
    ],
    runbook: ['전체 재실행에서 중복 반영 위험을 확인한다.', 'checkpoint 이후부터 재개한다.', 'unique key가 완료 건을 건너뛰는지 확인한다.', '건수와 금액 합계를 대조한다.'],
    observability: [{ label: '정산 배치 리허설', href: '/scenarios/settlement-batch-retry' }], wiki: [],
    retrospectives: [
      '체크포인트만으로는 부족하다. 7,500건을 커밋하고 체크포인트를 갱신하기 직전에 죽으면 그 구간이 중복 처리된다. 갱신 자체가 또 하나의 쓰기라서 그렇다.',
      '정확성은 멱등 upsert가 책임진다. UNIQUE 제약에 ON CONFLICT DO NOTHING이면 몇 번을 돌려도 결과가 같다.',
      '멱등키 범위를 어떻게 잡느냐가 곧 재실행 가능 범위다. 거래ID만 잡으면 정당한 재정산도 못 하고, 너무 넓으면 중복이 샌다.',
      '구간을 나누면 실패한 구간만 병렬로 재처리할 수 있다. 독립 처리 가능한 단위로 쪼개면 병렬화와 실패 격리가 동시에 온다.',
      '배치가 예외 없이 끝났다는 건 아무것도 증명하지 않는다. 원본 거래와 건수·합계를 대조해야 비로소 "맞다"가 된다.',
      '대조에서 불일치가 나면 자동 보정하지 않는다. 확정을 보류하고 사람에게 올린다. 돈은 잘못된 자동 복구의 피해가 훨씬 크다.',
    ],
  },
  {
    id: 'connection-pool-exhaustion',
    eyebrow: 'HikariCP / Transaction',
    title: 'DB Connection Pool 고갈',
    summary: '외부 API를 트랜잭션 안에서 기다리면 커넥션을 쥔 채 아무 일도 안 한다. 3초 중 97%가 그렇다. 느린 외부 호출로 풀 고갈을 재현하고 경계 분리 뒤 점유가 얼마나 주는지 비교한다.',
    route: '/scenarios/connection-pool-exhaustion', routeLabel: 'Connection Pool 리허설',
    objective: '성능 문제의 대부분은 일을 많이 해서가 아니라 자원을 오래 쥐고 있어서 생긴다. 특히 일하지 않으면서 쥐고 있는 경우가 최악이다.',
    proof: '커넥션 풀을 늘리면 되지 않을까? PostgreSQL은 커넥션마다 프로세스를 띄운다. 수백 개가 되면 DB가 먼저 무너진다. 병목을 없애는 게 아니라 더 나쁜 곳으로 옮기는 것이다.',
    caseStudy: { title: '느린 제휴 API가 DB connection을 모두 점유한 주문 요청', situation: '트랜잭션을 열고 결제 API 응답을 3초 기다린다. 실제 DB 작업은 100ms인데 커넥션 점유는 3.1초다.', risk: '동시 요청 20개면 풀이 빈다. 그러면 결제와 아무 상관 없는 게시판 조회까지 커넥션을 못 받아 죽는다. 결제사 한 곳이 느려졌을 뿐인데 전체가 무너진다.', verification: '경계를 분리했을 때 점유 시간이 얼마나 줄어드는지, timeout이 상한을 걸어 주는지, bulkhead가 나머지 요청을 지켜 주는지 비교한다.' },
    flow: { label: '자원 고갈과 격리 경로', steps: [
      { label: 'REQUEST', detail: 'concurrent traffic' }, { label: 'EXTERNAL I/O', detail: 'slow partner', tone: 'warning' },
      { label: 'TX BOUNDARY', detail: 'short DB section' }, { label: 'BULKHEAD', detail: 'bounded slots' },
      { label: 'POOL RECOVERY', detail: 'connection returned', tone: 'success' },
    ] },
    signals: [
      { label: '쓰는 중인 커넥션과 노는 커넥션', metric: 'hikaricp active / idle' },
      { label: '커넥션을 기다리는 스레드', metric: 'pending threads' },
      { label: '못 받고 포기한 수', metric: 'acquire timeout' },
      { label: '외부 API 응답 시간 상위 5%', metric: 'partner p95' },
      { label: 'bulkhead 가 거절한 수' },
    ],
    runbook: ['transaction 내부 외부 호출에서 pool 고갈을 확인한다.', '경계 분리 뒤 max active를 비교한다.', 'timeout으로 점유 시간을 제한한다.', 'bulkhead가 DB pool보다 작은지 확인한다.'],
    observability: [{ label: 'Connection Pool 리허설', href: '/scenarios/connection-pool-exhaustion' }], wiki: [],
    retrospectives: [
      '근본 해법은 경계 분리다. 외부 호출을 트랜잭션 밖으로 빼면 점유가 3.1초에서 100ms로 줄어든다. 같은 커넥션 수로 훨씬 많은 요청을 받는다.',
      '대신 원자성을 잃는다. 경계 분리는 공짜가 아니라 원자성을 보상으로 바꾸는 거래다.',
      '경계를 못 나누더라도 connect와 read timeout은 반드시 나눠 건다. 연결이 안 되는 것과 응답이 느린 것은 성격이 다르다.',
      'bulkhead는 자원축, 서킷 브레이커는 시간축 방어다. 하나만 있으면 반쪽이라 보통 같이 쓴다.',
      '이 시나리오를 정리하다 우리 Saga 코드가 정확히 이 안티패턴을 저지르고 있는 걸 발견했다. @Transactional 안에서 결제 서비스를 부르고 있었고, 단계별 트랜잭션으로 고쳤다.',
    ],
  },
  {
    id: 'jpa-n-plus-one',
    eyebrow: 'JPA / Query Plan',
    title: '주문 목록 JPA N+1',
    summary: '지연 로딩은 좋은 기본값이다. 그런데 목록에서는 주문 100건 조회가 SQL 301번이 된다. 같은 목록 조회를 여러 방식으로 바꿔 가며 SQL 횟수가 어떻게 달라지는지 잰다.',
    route: '/scenarios/jpa-n-plus-one', routeLabel: 'N+1 조회 리허설',
    objective: 'N+1이 위험한 건 느려서가 아니라 개발 환경에서 안 보이기 때문이다. 데이터가 쌓인 어느 날 갑자기 터진다.',
    proof: '301은 어디서 나올까? 주문 목록 1번 + 상품 100번 + 결제·배송 200번이다. 쿼리 하나는 1ms도 안 되지만 왕복이 301번이고, 이게 데이터 건수에 비례해 늘어난다.',
    caseStudy: { title: '주문 목록 100건에서 SQL이 301회 실행된 조회', situation: '목록을 한 번 조회하고 반복문에서 상품·결제·배송을 꺼내 화면에 그린다. 코드에는 아무 문제가 없어 보인다.', risk: '테스트 데이터가 10건이면 31번이라 아무도 눈치채지 못한다. 운영에서 1,000건이 되면 3,001번이 되고 그때 타임아웃이 난다. 코드는 그대로인데.', verification: 'lazy loading, fetch join, projection, batch fetch가 각각 SQL을 몇 번 실행하는지 같은 입력으로 센다.' },
    flow: { label: '목록 조회 최적화 경로', steps: [
      { label: 'ORDER PAGE', detail: '100 rows' }, { label: 'LAZY LOAD', detail: '301 SQL', tone: 'warning' },
      { label: 'QUERY SHAPE', detail: 'fetch / projection' }, { label: 'BATCH', detail: 'bounded relations' },
      { label: 'MEASURE', detail: 'SQL count and p95', tone: 'success' },
    ] },
    signals: [
      { label: '목록 크기' },
      { label: 'SQL 을 몇 번 실행했나' },
      { label: '응답 시간 상위 5%', metric: 'p95' },
      { label: 'DB 에서 읽어 온 행 수' },
      { label: '페이징이 어긋나지 않는지' },
    ],
    runbook: ['lazy loading의 SQL 증가를 확인한다.', 'to-one fetch join과 collection 분리를 비교한다.', '목록 전용 projection을 실행한다.', 'batch size에 따른 SQL 횟수를 확인한다.'],
    observability: [{ label: 'N+1 조회 리허설', href: '/scenarios/jpa-n-plus-one' }], wiki: [],
    retrospectives: [
      'EAGER로 바꾸면 N+1이 없어지는 게 아니라 숨는다. 필요 없는 화면에서도 다 읽고, 어디서 쿼리가 나가는지 예측할 수 없게 된다.',
      'to-one은 fetch join, 컬렉션은 batch fetch가 실무 정석이다. 컬렉션을 fetch join하면 행이 곱해지고 페이징이 깨진다.',
      '컬렉션 fetch join에 페이징을 걸면 Hibernate가 전체를 메모리로 읽어 자른다. 데이터가 많으면 그대로 OOM이다.',
      '목록처럼 읽기 전용이면 엔티티를 아예 안 쓰는 projection이 가장 낫다. 필요한 컬럼만 읽고 영속성 컨텍스트 부담도 없다.',
      'default_batch_fetch_size 설정 한 줄이 가장 가성비가 좋다. 코드를 안 고치고 대부분의 N+1이 완화된다.',
      'N+1은 결과가 정확해서 기능 테스트로 안 잡힌다. 시간은 환경마다 다르지만 쿼리 횟수는 결정적이라, 그걸 테스트로 고정하는 게 확실하다.',
    ],
  },
  {
    id: 'commerce-order-confirmation',
    eyebrow: 'Order / Inventory',
    title: '주문·재고·결제 확정',
    summary: '재고 1개에 주문 2건이 동시에 들어오면 둘 다 "살 수 있다"를 읽는다. 그 틈을 없애는 방법들을 비교한다. 마지막 재고 경합에서 둘 중 하나만 예약되는 결과를 확인한다.',
    route: '/domain-scenarios/order-confirmation',
    routeLabel: '주문 확정 리허설',
    objective: '주문·재고·결제를 하나의 트랜잭션으로 묶을 수 없을 때, 각 단계가 어디서 어긋나고 무엇으로 되돌리는지 보여준다.',
    proof: '읽고 판단하고 쓰는 사이에 남이 끼어들면? 갱신이 덮어써져 주문은 2건인데 재고는 1개만 준다. 조건을 SQL 안에 넣으면 DB가 행을 잠근 채 확인과 갱신을 한 번에 해서 틈 자체가 사라진다.',
    caseStudy: {
      title: '마지막 한 개 상품에 동시에 들어온 두 주문',
      situation: '재고가 1개 남았고 두 고객이 거의 같은 순간에 주문했다. 두 요청 모두 "재고 1개 있음"을 읽는다.',
      risk: '읽은 값이 이미 낡았는데 그걸 모르고 각자 차감하면, 주문은 2건인데 재고는 1개만 줄어든다. 물건은 하나인데 두 명에게 팔린 것이다.',
      verification: '두 주문 중 한 건만 예약되는지, 중복 결제 callback이 한 번만 반영되는지, 확정 실패 시 결제 취소와 재고 복원이 도는지 확인한다.',
    },
    flow: {
      label: '주문 확정과 보상 경계',
      steps: [
        { label: 'PRICE SNAPSHOT', detail: 'order contract' },
        { label: 'RESERVE', detail: 'inventory hold' },
        { label: 'PAYMENT', detail: 'idempotent callback' },
        { label: 'CONFIRM', detail: 'order transition' },
        { label: 'COMPENSATE', detail: 'release / cancel', tone: 'success' },
      ],
    },
    signals: [
      { label: '팔 수 있는 재고' },
      { label: '잡아 둔 예약 상태' },
      { label: '결제 식별자', metric: 'payment ID' },
      { label: '주문 상태가 어떻게 바뀌었나' },
      { label: '결제 취소와 재고 복원' },
    ],
    runbook: [
      '정상 확정으로 재고 예약부터 주문 확정까지의 기준 경로를 확인한다.',
      '마지막 재고 경합에서 두 주문 중 하나만 예약되는 결과를 비교한다.',
      '중복 callback과 확정 실패에서 중복 반영 방지와 보상 단계를 확인한다.',
      '예약 만료가 판매 가능 재고를 복원하는지 최근 실행으로 검토한다.',
    ],
    observability: [{ label: '주문 확정 리허설', href: '/domain-scenarios/order-confirmation' }],
    wiki: [],
    retrospectives: [
      '읽고 판단하고 쓰는 사이의 틈이 문제다. 조건을 SQL 안에 넣으면 DB가 행을 잠근 채 확인과 갱신을 한 번에 해서 틈 자체가 없어진다.',
      '비관적 락은 인기 상품에서 전부 한 줄로 대기하고, 낙관적 락은 충돌이 잦으면 재시도가 폭증한다. 조건부 UPDATE는 락 대기도 재시도도 없다.',
      '재고를 available과 reserved 두 칸으로 나누면 "얼마를 돌려놔야 하는지"를 따로 기억할 필요가 없다. 상태 자체가 답을 갖는다.',
      '결제 callback은 중복으로 오는 게 정상이다. 두 번째에도 200을 줘야 한다. 400을 주면 결제사가 전달 실패로 보고 계속 재시도한다.',
      '결제창에서 그냥 나가면 실패 신호도 오지 않는다. 예약에 만료 시각을 넣지 않으면 재고는 있는데 아무도 못 사는 상태가 된다.',
      '가격 snapshot을 주문에 보존해야 상품 정보가 바뀐 뒤에도 거래 당시 계약을 설명할 수 있다.',
    ],
  },
  {
    id: 'operations-data-correction',
    eyebrow: 'SQL / Audit',
    title: '운영 데이터 조회·정정',
    summary: '운영 작업은 코드 리뷰도 테스트도 없이 바로 운영 DB에 닿는다. 그리고 UPDATE는 이전 값을 지우는 명령이다. 정정 전 값을 남기고 조건을 걸어 고치는 절차를 단계별로 따라간다.',
    route: '/scenarios/operations-data-correction',
    routeLabel: '데이터 정정 사례',
    objective: '운영 사고의 상당수는 버그가 아니라 권한 있는 사람이 옳다고 믿고 실행한 작업에서 난다. 그래서 답은 기능이 아니라 절차다.',
    proof: '한 건 고치려다 37건을 바꾸지 않으려면? 실행할 UPDATE의 WHERE 절을 그대로 SELECT로 먼저 돌린다. 비용이 거의 0인데 대부분의 사고가 여기서 막힌다.',
    caseStudy: {
      title: 'CS 확인 뒤 누락된 포인트와 거래 상태를 복구한 요청',
      situation: '고객 문의와 거래 원장을 대조하니 지급됐어야 할 포인트가 실제로 빠져 있다. 한 건만 고치면 되는 작업이다.',
      risk: '동명이인이 37명이거나 조인 조건을 빠뜨리면 엉뚱한 고객까지 바뀐다. 그리고 실행한 뒤에는 원래 값이 이미 덮어써져서 되돌릴 방법이 없다.',
      verification: '대상 SELECT로 건수를 먼저 세고, 수정 전 값을 남기고, expected state 조건으로 갱신하고, 끝나고 잔액과 원장 합계가 맞는지 다시 조회한다.',
    },
    flow: { label: '운영 데이터 정정 통제 흐름', steps: [
      { label: 'REQUEST', detail: 'ticket + business evidence' },
      { label: 'SELECT', detail: 'target and impact scope' },
      { label: 'SNAPSHOT', detail: 'before values + approval' },
      { label: 'CONDITIONAL UPDATE', detail: 'expected state only', tone: 'warning' },
      { label: 'VERIFY / AUDIT', detail: 'invariants + rollback key', tone: 'success' },
    ] },
    signals: [
      { label: '요청·승인 식별자' },
      { label: '고치기 전 값', metric: 'before snapshot' },
      { label: '예상 건수와 실제 바뀐 건수', metric: 'affected rows' },
      { label: '잔액과 원장이 여전히 맞는지' },
      { label: '작업자·시각·되돌리는 SQL', metric: 'rollback SQL' },
    ],
    runbook: ['CS 요청과 거래 근거로 대상 식별자를 확정한다.', 'SELECT 결과와 영향 건수를 별도 검토한다.', '수정 전 값을 보존하고 expected state 조건으로 변경한다.', '잔액·원장·상태를 재조회하고 audit와 복구 절차를 남긴다.'],
    observability: [],
    wiki: [{ label: 'PostgreSQL revision과 rollback', slug: 'postgres-db-wiki-revision' }],
    retrospectives: [
      'UPDATE 전에 같은 WHERE로 SELECT를 돌려 보는 것 하나로 대부분의 사고가 막힌다. 가장 싸고 가장 효과가 크다.',
      'expected state 조건을 붙이면 내가 조회한 뒤 누가 이미 처리한 경우에 갱신되지 않는다. 갱신 행 수가 1이 아니면 즉시 되돌린다.',
      'UPDATE가 1건 됐다는 것과 데이터가 올바르다는 건 다르다. 잔액과 원장 합계 같은 불변조건을 다시 확인해야 끝이다.',
      '롤백도 그냥 하면 안 된다. 그 사이 고객이 포인트를 썼다면 스냅샷 값으로 덮는 순간 그 사용이 사라진다. 후속 변경을 먼저 확인해야 한다.',
      '같은 유형이 반복되면 그건 기능으로 만들라는 신호다. 화면으로 만들면 조건·승인·감사가 코드로 강제돼 사람의 주의력에 기대지 않게 된다.',
      '백업은 마지막 방어선이지 첫 번째가 아니다. 잘못된 대상을 애초에 차단하는 절차가 앞에 있어야 한다.',
    ],
  },
  {
    id: 'privacy-data-lifecycle',
    eyebrow: 'Privacy / Retention',
    title: '개인정보 마스킹·파기',
    summary: '일반 데이터는 많을수록 좋지만 개인정보는 반대다. 안 가진 정보는 유출될 수 없다. 역할별로 마스킹 결과를 비교하고 탈퇴 뒤 파기와 보존 대상이 어떻게 갈리는지 따라간다.',
    route: '/scenarios/privacy-data-lifecycle',
    routeLabel: '개인정보 처리 사례',
    objective: '화면에서 별표로 가리는 것과 저장·로그·백업에서 실제로 지우는 것은 완전히 다른 문제다.',
    proof: '탈퇴하면 다 지우면 될까? 전자상거래법상 결제 기록은 5년 보존 의무가 있다. 그래서 지우는 게 아니라 즉시 파기 대상과 보존 예외를 분리하고, 식별자를 떼어낸다.',
    caseStudy: {
      title: '탈퇴 요청 뒤 운영 화면·로그·백업에 남은 고객 정보',
      situation: 'DB 본 테이블에서는 지웠다. 그런데 같은 사람을 식별할 값이 애플리케이션 로그, 검색 색인, 담당자가 받아 간 엑셀, 그리고 백업 파일에 남아 있다.',
      risk: '가장 어려운 건 백업이다. 지운 뒤 예전 백업으로 복원하면 그 정보가 되살아난다. 백업 파일은 압축된 덤프라 직접 수정할 수도 없다.',
      verification: '역할별로 무엇까지 보이는지, 탈퇴 시 토큰이 즉시 폐기되는지, 보존 예외가 분리되는지, 그리고 복원했을 때 재파기 절차가 도는지 확인한다.',
    },
    flow: { label: '개인정보 수명주기', steps: [
      { label: 'COLLECT', detail: 'purpose + minimum fields' },
      { label: 'MASK', detail: 'role-based projection' },
      { label: 'WITHDRAW', detail: 'account state transition' },
      { label: 'PURGE / RETAIN', detail: 'policy split', tone: 'warning' },
      { label: 'VERIFY', detail: 'logs + backup expiry', tone: 'success' },
    ] },
    signals: [
      { label: '필드마다 왜 받는지' },
      { label: '역할별로 원문이 보이는 범위' },
      { label: '탈퇴·파기 대상 건수' },
      { label: '법으로 남겨야 하는 것과 만료일' },
      { label: '로그·내려받기·백업에 다시 나타나는지' },
    ],
    runbook: ['개인정보 필드와 처리 목적·보유기간을 연결한다.', '일반·CS·관리자 역할별 masking 결과를 비교한다.', '탈퇴 시 즉시 파기와 분리 보존 대상을 나눈다.', '로그와 백업 세대가 만료된 뒤 재노출 검사를 수행한다.'],
    observability: [],
    wiki: [{ label: '공개 서비스의 법적 경계', slug: 'personal-service-legal-launch-boundary' }, { label: '문서·자산 보존 기준', slug: 'wiki-content-asset-retention-governance' }],
    retrospectives: [
      '가장 확실한 보호는 애초에 수집하지 않는 것이다. 이 사이트의 댓글은 원본 IP를 저장하지 않고 표시용 앞 2옥텟과 차단용 salted 해시만 남긴다. 둘 다 원본이 필요 없는 용도다.',
      'salt가 새면 IPv4는 43억 개뿐이라 전부 해시해 대조하면 역산된다. 그래서 Secret으로 관리하고, 운영에서 값이 없으면 아예 기동이 실패하게 만들었다.',
      '방문자 중복 제거 해시에는 날짜를 섞는다. 하루 안에서는 중복 제거가 되고 다음 날에는 같은 사람인지 대조할 수 없다. 순 방문자 수라는 목적만 달성하고 추적은 막는다.',
      '유입 경로도 받는 즉시 세 버킷으로 줄이고 원본 URL을 버린다. 나중에 지우는 것보다 처음부터 안 가지는 게 안전하다.',
      '개인정보 사고의 상당수는 외부 해킹이 아니라 내부자 조회다. 누가 언제 누구 정보를 왜 봤는지가 남으면 그 자체가 억제력이 된다.',
      '마스킹은 서버에서 잘라야 한다. 화면단에서만 가리면 API 응답에 원문이 실려 나가 개발자 도구로 보인다.',
      '로그에는 애초에 개인정보를 안 찍는 게 낫다. 여러 시스템에 복제되고 장기 보관돼서 나중에 지우기가 훨씬 어렵다.',
    ],
  },
  {
    id: 'bulk-spreadsheet-operations',
    eyebrow: 'Excel / Streaming',
    title: '대용량 Excel 다운로드·업로드',
    summary: '10만 행 엑셀을 순진하게 만들면 엔티티 10만 개와 셀 객체 100만 개가 전부 메모리에 올라간다. 조금씩 읽고 쓰는 방식으로 바꾸고 업로드 오류 행은 별도 파일로 돌려주는 과정을 본다.',
    route: '/scenarios/bulk-spreadsheet-operations',
    routeLabel: '대용량 파일 사례',
    objective: '내려받기는 메모리 문제이고 올리기는 정합성 문제다. 성격이 다른 두 문제를 한 화면에서 가른다.',
    proof: '내려받기는 왜 터질까? 전부 모아서 만들기 때문이다. 읽기는 커서로 나누고 쓰기는 최근 몇 행만 메모리에 두고 나머지를 임시 파일로 밀어내면 상한이 잡힌다.',
    caseStudy: {
      title: '게시글 10만 건을 내려받고 수정 파일을 다시 올린 백오피스 작업',
      situation: '운영자가 넓은 기간의 데이터를 엑셀로 받아 외부에서 보정한 뒤 다시 올려 일괄 반영하려 한다. 담당자 세 명이 동시에 누르기도 한다.',
      risk: '한 행씩 읽으며 바로 운영 테이블에 반영하면, 9,982행이 들어간 상태에서 18행이 실패하는 부분 반영이 남는다. 이미 커밋된 걸 어떻게 되돌릴지가 없다.',
      verification: '읽기 기준 시각을 고정했는지, 메모리 상한이 잡히는지, 검증이 끝나기 전에는 운영 테이블을 건드리지 않는지, 오류 행 보고서가 나오는지 확인한다.',
    },
    flow: { label: '대용량 파일 처리 흐름', steps: [
      { label: 'QUERY SNAPSHOT', detail: 'fixed criteria + count' },
      { label: 'PAGE / STREAM', detail: 'bounded memory' },
      { label: 'FILE CONTRACT', detail: 'columns + version' },
      { label: 'STAGING VALIDATION', detail: 'row errors isolated', tone: 'warning' },
      { label: 'APPLY / REPORT', detail: 'accepted + rejected counts', tone: 'success' },
    ] },
    signals: [
      { label: '전체 행과 처리한 행' },
      { label: '최대 메모리와 처리 시간', metric: 'peak memory' },
      { label: '파일 서식 버전', metric: 'schema version' },
      { label: '통과한 행과 튕긴 행' },
      { label: '중복 업로드를 거르는 키', metric: 'upload request key' },
    ],
    runbook: ['조회 기준 시각과 예상 건수를 고정한다.', 'paging으로 읽고 streaming workbook으로 기록한다.', '업로드를 staging에 저장해 형식·업무 규칙을 검증한다.', '정상 건만 멱등 반영하고 오류 행을 별도 파일로 반환한다.'],
    observability: [], wiki: [],
    retrospectives: [
      '읽기와 쓰기를 둘 다 스트리밍으로 바꿔야 한다. 하나만 고치면 다른 쪽에서 그대로 쌓인다.',
      '페이징 중에 데이터가 바뀌면 페이지 경계가 밀려 같은 행이 두 번 나오거나 누락된다. 그래서 조회 기준 시각을 고정한다.',
      '임시 파일은 전송이 끊겨도 지워지도록 finally에 둔다. 안 지우면 디스크가 차서 다른 기능까지 막는다.',
      'staging의 핵심은 "검증이 전부 끝나기 전에는 운영 테이블을 건드리지 않는다"는 것이다. 부분 반영이 남지 않는다.',
      '전부 거부와 부분 반영 중 무엇이 맞는지는 도메인이 정한다. 정산이면 일부만 반영된 상태가 더 위험하고, 상품 정보면 9,982건을 다시 올리게 하는 게 비효율이다.',
      '업무 규칙 검증을 행마다 쿼리로 하면 그 자체가 N+1이다. 참조 데이터를 한 번에 읽어 두고 대조한다.',
      '서식이 필요 없으면 CSV가 훨씬 가볍다. "엑셀로 주세요"가 실제로는 "표로 주세요"인 경우가 많다.',
    ],
  },
  {
    id: 'business-metrics-backoffice',
    eyebrow: 'SQL / Backoffice',
    title: '반복 통계 요청의 화면화',
    summary: '"이번 달 가입자 수"는 사실 정의되지 않은 질문이다. 결정해야 할 게 최소 다섯 가지다. 요청 문장을 계산 가능한 지표 정의로 바꾸고 화면과 파일이 같은 수를 내는지 대조한다.',
    route: '/scenarios/business-metrics-backoffice',
    routeLabel: '업무 통계 사례',
    objective: '통계 화면의 핵심은 차트가 아니라 같은 질문에 어디서 물어도 같은 답이 나오게 하는 지표 계약이다.',
    proof: '왜 143건이 차이 날까? 기간이 UTC냐 KST냐, 탈퇴자를 넣느냐, 테스트 계정을 빼느냐, 이메일 미인증은 어떻게 하느냐에 따라 답이 달라진다. 두 사람이 각자 SQL을 쓰면 이걸 다르게 해석한다.',
    caseStudy: {
      title: '매달 다시 요청된 가입자·거래 건수 추출',
      situation: '기획팀이 월별 가입자를 물을 때마다 개발자가 조건을 다시 해석해 SQL을 쓴다. 둘 다 결과를 "가입자 수"라고 부른다.',
      risk: '숫자가 한 번 안 맞으면 그 뒤로 모든 숫자를 의심하게 된다. 그리고 못 믿는 숫자로는 아무 결정도 할 수 없다.',
      verification: '지표 정의와 버전, 기준 시각, 화면 합계와 파일 행 수, 그리고 원본 표본 검산이 서로 맞는지 확인한다.',
    },
    flow: { label: '반복 지표의 제품화 흐름', steps: [
      { label: 'REQUEST', detail: 'business question' },
      { label: 'DEFINE', detail: 'metric contract' },
      { label: 'QUERY', detail: 'versioned SQL' },
      { label: 'SCREEN / EXPORT', detail: 'same filters' },
      { label: 'RECONCILE', detail: 'totals + samples', tone: 'success' },
    ] },
    signals: [
      { label: '지표 정의의 버전', metric: 'metric version' },
      { label: '기준 시간대와 자르는 시각', metric: 'timezone · cutoff' },
      { label: '무엇을 넣고 무엇을 뺐나' },
      { label: '화면 합계와 파일 합계' },
      { label: '쿼리 시간과 인덱스 사용', metric: 'duration · index scan' },
    ],
    runbook: ['요청 문장을 계산 가능한 지표 정의로 바꾼다.', '상태·시간·중복 제외 조건을 합의한다.', '같은 filter를 화면과 export에서 재사용한다.', '합계와 표본 row를 원본과 대조하고 변경 이력을 남긴다.'],
    observability: [], wiki: [],
    retrospectives: [
      '지표 정의는 바뀌기 마련이다. 바뀌는 게 문제가 아니라 바뀐 걸 모르는 게 문제라서 버전을 붙인다. 그래야 "작년엔 1,200인데 지금은 1,150"이 설명된다.',
      '필터를 화면과 export 두 곳에 따로 쓰면 반드시 어긋난다. 같은 조건 객체를 재사용해야 한다.',
      '파일에 기준 시각을 박아 두면 나중에 숫자가 달라도 "시점이 다르다"로 설명된다. 한 줄이 신뢰를 지킨다.',
      '최적화 뒤에는 반드시 결과 집합이 같은지 확인한다. 2,800ms가 180ms가 됐는데 건수가 바뀌었으면 빨라진 게 아니라 틀린 것이다.',
      '시간대 문제는 월말·월초에 터진다. DB는 UTC로 저장하고 사람은 KST로 생각해서, 9시간 차이가 그 경계에서만 결과를 바꾼다.',
      '집계 오류는 실패가 아니라 한쪽으로 쏠린 성공으로 나타난다. 이 사이트 블로그 통계도 유입이 전부 direct로 찍혔는데, 응답 코드는 계속 200이었다. 대시보드에 그려 보고서야 알았다.',
      '화면을 만들기 전에 정의가 합의되지 않으면 잘못된 숫자를 더 빠르게 배포하게 된다.',
    ],
  },
  {
    id: 'notification-delivery-operations',
    eyebrow: 'Message / Retry',
    title: '알림 발송 실패와 재처리',
    summary: '알림은 두 가지를 동시에 만족해야 한다. 반드시 가야 하고, 두 번 가면 안 된다. 발송 실패를 유형별로 가르고 운영자가 재처리해도 같은 알림이 두 번 가지 않는지 확인한다.',
    route: '/scenarios/notification-delivery-operations',
    routeLabel: '알림 운영 사례',
    objective: '"발송했다"와 "전달됐다"는 다르다. API가 200을 줬다는 건 접수까지고, 실제 도착은 callback으로만 알 수 있다.',
    proof: '실패한 알림을 다시 보내면 고객이 두 번 받을까? 운영자가 재처리할 때 기존 request key를 그대로 재사용하면, 원래 건이 사실 전달됐던 경우에도 중복이 안 난다.',
    caseStudy: {
      title: '결제 완료 알림 provider 장애와 운영자의 재발송 요청',
      situation: '결제는 끝났는데 메시지 provider가 timeout을 냈다. 고객에게 문자가 갔는지 안 갔는지 알 수 없다.',
      risk: '결제 커밋 뒤에 발송을 호출하면 그 사이에 죽었을 때 알림이 영원히 안 간다. 그렇다고 확인 없이 재발송하면 같은 문자가 두 번 간다.',
      verification: '결제와 발송 요청이 같은 트랜잭션에 기록되는지, 타임아웃에 재시도 대신 상태를 조회하는지, 영구 실패가 DLQ로 빠지는지, 재처리가 중복을 만들지 않는지 본다.',
    },
    flow: { label: '고객 알림 전달 흐름', steps: [
      { label: 'BUSINESS COMMIT', detail: 'payment completed' },
      { label: 'OUTBOX', detail: 'notification requested' },
      { label: 'PROVIDER SEND', detail: 'request key + template' },
      { label: 'RETRY / DLQ', detail: 'classified failure', tone: 'warning' },
      { label: 'DELIVERED / REVIEW', detail: 'callback or operator', tone: 'success' },
    ] },
    signals: [
      { label: '중복을 막는 발송 요청 키', metric: 'notification request key' },
      { label: '통신사가 준 메시지 ID', metric: 'provider message ID' },
      { label: '시도 횟수와 오류 종류', metric: 'attempt · error class' },
      { label: '재시도와 DLQ 건수' },
      { label: '최종 전달·실패 상태' },
    ],
    runbook: ['업무 commit 뒤 발송 event가 생성되는지 확인한다.', 'provider 오류를 재시도 가능·영구 실패로 분류한다.', 'callback과 조회 API로 최종 전달 상태를 확정한다.', '운영자 재처리가 동일 알림을 중복 생성하지 않는지 확인한다.'],
    observability: [{ label: 'Kafka 알림 리허설', href: '/kafka/order' }],
    wiki: [{ label: 'Kafka Outbox와 DLQ', slug: 'saga-kafka-outbox-order' }],
    retrospectives: [
      '결제 완료와 발송 요청을 같은 트랜잭션에 기록해야 유실이 없다. 커밋하고 나서 발송을 부르면 그 사이가 비어 있다.',
      '재시도 횟수를 정하는 것보다 오류를 재시도 가능·영구 실패로 분류하는 게 먼저다. 없는 번호에 100번 보내도 100번 실패한다.',
      '429는 큐에 다시 넣어 예약한다. 요청 스레드를 붙잡고 기다리면 대량 발송에서 스레드가 먼저 고갈된다.',
      '대량 발송이라 전부 같은 시각에 재시도하면 또 몰린다. 지연에 지터를 섞어 흩어야 한다.',
      'DLQ 메시지에는 전화번호와 이름이 들어 있다. DLQ는 별도 시스템에 오래 보관되므로 개인정보가 거기 쌓이지 않게 마스킹한다.',
      '거래성 알림과 마케팅 대량 발송이 같은 큐에 있으면 결제 알림이 10만 건 뒤로 밀린다. 큐를 나누거나 우선순위를 둬야 한다.',
      '이 사이트에서 실제로 구성한 건 운영 알람 쪽이다. Alertmanager에서 텔레그램으로 보내고, 백엔드 다운 알람을 일부러 내보는 리허설까지 만들었다.',
    ],
  },
  {
    id: 'maintenance-communication',
    eyebrow: 'Degraded / Notice',
    title: '점검 모드와 운영 공지',
    summary: '장애는 정상 아니면 장애 둘이 아니다. 결제사가 죽어도 상품 조회와 주문 내역은 멀쩡하다. 쓰기만 막는 부분 점검으로 전환하고 웹과 앱이 같은 공지를 보여주는지 확인한다.',
    route: '/scenarios/maintenance-communication',
    routeLabel: '점검 공지 사례',
    objective: '점검 페이지를 정적 문구가 아니라 기능 단위 게이트로 다룬다. 읽기는 최대한 지키고 위험한 쓰기만 막는다.',
    proof: '왜 쓰기만 막을까? 결제사가 죽은 상태에서 주문을 받으면 "주문은 생겼는데 결제가 안 된" 불완전한 데이터가 쌓인다. 나중에 사람이 하나하나 정리해야 하므로 차라리 안 받는 게 낫다.',
    caseStudy: {
      title: '배포·외부 장애 중 결제 쓰기만 제한해야 한 서비스',
      situation: '결제 의존성이 죽었다. 상품 조회와 공지는 문제없지만 결제·포인트·주문 확정은 안전하게 처리할 수 없다.',
      risk: '전부 막으면 멀쩡한 기능까지 못 쓰는 과잉 대응이 된다. 반대로 화면마다 500·무한 로딩·타임아웃으로 제각각 반응하면 사용자는 "고장났다"고 생각하고 CS가 폭증한다.',
      verification: '기능별로 막고 여는지, 모든 차단이 같은 오류 계약으로 응답하는지, 공지가 웹·앱·API에 함께 반영되는지, 복구 전에 실제 경로를 확인하는지 본다.',
    },
    flow: { label: '점검 상태 전환 흐름', steps: [
      { label: 'INCIDENT / CHANGE', detail: 'scope decided' },
      { label: 'DEGRADED MODE', detail: 'write gate', tone: 'warning' },
      { label: 'NOTICE', detail: 'web + app + API contract' },
      { label: 'RECOVERY SMOKE', detail: 'dependency verified' },
      { label: 'NORMAL', detail: 'gate opened + notice closed', tone: 'success' },
    ] },
    signals: [
      { label: '점검 모드 버전과 바꾼 사람', metric: 'mode version' },
      { label: '열어 둔 기능과 막은 기능' },
      { label: '공지 시작·예정·완료 시각' },
      { label: '캐시에 반영됐는지', metric: 'CDN cache' },
      { label: '게이트를 열기 전 확인 결과', metric: 'smoke test' },
    ],
    runbook: ['영향 기능과 읽기·쓰기 가능 범위를 결정한다.', '권한 있는 운영자가 versioned mode를 전환한다.', '웹·앱·API가 같은 공지와 오류 계약을 표시하는지 확인한다.', '의존성 smoke 뒤 쓰기를 열고 종료 공지를 반영한다.'],
    observability: [{ label: '운영 모니터링', href: '/monitoring' }],
    wiki: [{ label: '운영 콘텐츠 반영과 smoke', slug: 'production-content-sync-and-rollout' }],
    retrospectives: [
      '차단은 503에 Retry-After와 종료 예정 시각을 담아 일관되게 응답한다. 500을 주면 검색엔진이 "깨진 페이지"로 보고 색인에서 뺄 수도 있다.',
      '어떤 기능을 막을지는 "실패했을 때 불완전한 데이터가 남는가"로 가른다. 그러려면 기능별 의존성 지도를 미리 그려 둬야 한다. 장애 나고 파악하면 늦다.',
      '점검 공지는 띄우는 것보다 내리는 게 어렵다. CDN에 캐시된 점검 페이지가 남으면 서버가 정상인데도 사용자는 계속 점검 화면을 본다.',
      '복구가 가장 위험한 순간이다. 점검 중 쌓인 재시도와 큐 backlog가 게이트를 여는 순간 한꺼번에 쏟아져 방금 복구한 서비스를 다시 죽인다.',
      '"의존성이 살아났다"와 "우리 서비스가 정상"은 다르다. 실제 경로를 소수 요청으로 먼저 확인하고, 백로그 규모를 본 뒤, 게이트를 단계적으로 연다.',
      '2차 장애는 1차보다 신뢰를 훨씬 크게 깎는다. 복구는 스위치가 아니라 절차다.',
      '공지가 DB 한 곳에만 의존하면 DB 장애 때 안내조차 못 한다. 독립 경로와 기본 문구가 필요하다.',
    ],
  },
  {
    id: 'image-upload-optimization',
    eyebrow: 'Media / MinIO',
    title: '상품 이미지 업로드·최적화',
    summary: '이미지에서 진짜 비용은 저장이 아니라 전송이다. 저장은 한 번이지만 전송은 볼 때마다 나간다. 업로드 시점에 초과 파일을 거절하고 변환된 이미지만 공개로 나가는 흐름을 본다.',
    route: '/scenarios/image-upload-optimization',
    routeLabel: '이미지 처리 리허설',
    objective: '업로드를 파일 저장이 아니라 자원 보호·콘텐츠 검증·파생 이미지·삭제 수명주기 문제로 다룬다.',
    proof: '12MB 원본을 그대로 두면? 상품 20개짜리 목록 화면에서 240MB를 내려받는다. 화면에서는 200픽셀로 줄여 보여주면서. 480px 썸네일을 따로 만들면 1MB가 된다.',
    caseStudy: {
      title: '판매자가 12MB·6000×4000 상품 이미지를 등록한 요청',
      situation: '목록에는 작은 썸네일, 상세에는 적당한 크기가 필요한데 업로더는 아이폰 원본을 그대로 보냈다. EXIF에는 촬영 장소 GPS 좌표가 들어 있다.',
      risk: '확장자나 Content-Type은 클라이언트가 마음대로 쓰는 값이라 못 믿는다. 그리고 용량만 검사하면 1MB짜리 3만×3만 이미지가 통과해 decode할 때 3.6GB를 먹는다.',
      verification: '실제 바이트와 픽셀 수를 저장 전에 검사하는지, EXIF가 제거되는지, 용도별 variant가 만들어지는지, 비동기 변환에서 상태와 중복 job이 관리되는지 확인한다.',
    },
    flow: { label: '상품 이미지 처리 경계', steps: [
      { label: 'ADMISSION', detail: 'bytes + magic + pixels' },
      { label: 'QUARANTINE', detail: 'private original' },
      { label: 'TRANSFORM', detail: 'WebP + thumbnail' },
      { label: 'READY', detail: 'immutable variants', tone: 'success' },
      { label: 'LIFECYCLE', detail: 'replace + orphan cleanup', tone: 'warning' },
    ] },
    signals: [
      { label: '원본과 변환본의 용량', metric: 'bytes' },
      { label: '가로×세로와 총 픽셀 수' },
      { label: '진짜 파일 형식과 decode 결과', metric: 'magic bytes · MIME' },
      { label: '처리 시간과 대기열 상태', metric: 'queue depth' },
      { label: '저장·삭제된 객체 키', metric: 'object key' },
    ],
    runbook: ['무제한 원본 저장에서 공개 전송 비용을 확인한다.', '용량·픽셀 초과 거절이 MinIO write 전에 끝나는지 확인한다.', '동기 최적화에서 EXIF 제거와 variant 크기를 비교한다.', '비동기 접수·완료에서 PROCESSING, READY와 원본 lifecycle을 확인한다.'],
    observability: [],
    wiki: [{ label: 'MinIO 위키 이미지 자산', slug: 'minio-portfolio-assets' }, { label: '이미지 자산 lifecycle', slug: 'wiki-image-asset-lifecycle' }],
    retrospectives: [
      '검증은 저장 전에 해야 한다. 저장한 뒤 지우면 이미 비용을 다 쓴 것이다.',
      '클라이언트가 보낸 메타데이터는 전부 거짓일 수 있다. 파일 이름, 확장자, Content-Type, Content-Length 전부. 믿을 건 실제 바이트뿐이다.',
      '용량만 보면 압축 폭탄에 뚫린다. 단색 이미지는 압축률이 극도로 높아서, 1MB 파일이 펼치면 수 GB가 된다. 헤더에서 픽셀 수를 먼저 봐야 한다.',
      'EXIF 제거는 성능이 아니라 개인정보 항목이다. 집에서 찍은 중고거래 사진을 올리면 집 주소가 노출된다.',
      '파일 이름에 내용 해시를 넣으면 내용이 바뀔 때 이름도 바뀐다. 그러면 캐시를 영구로 걸 수 있어 CDN 무효화 고민이 사라진다.',
      '동기냐 비동기냐는 업로드 패턴이 정한다. 한 장이면 2초 기다리는 게 자연스럽고, 20장 일괄이면 비동기여야 한다. 대신 상태 관리와 job 멱등성이 따라온다.',
      '변환 job은 큐로 오므로 중복될 수 있다. 원본 checksum으로 이미 만든 variant가 있는지 확인한다.',
      '상품 display, 증빙 원본, 게시글 첨부는 보존·변환 정책이 달라야 한다. 정책을 안 정하면 기본값이 "다 보관"이 되고 몇 년 뒤 비용이 문제가 된다.',
    ],
  },
  {
    id: 'data-ownership-boundary',
    eyebrow: 'NetworkPolicy / PostgreSQL',
    title: '결제 데이터 소유권 경계',
    summary: '프로세스를 나눠도 한 데이터를 둘이 쓰면 경계는 그림에만 있다. 소유권을 계정과 NetworkPolicy 두 겹으로 강제하고, 모놀리스만 막히는 것을 대조군과 함께 잰다.',
    route: '/wiki/msa-data-ownership-split',
    routeLabel: '데이터 소유권 분리 글',
    objective: '경계를 약속이 아니라 강제로 만든다. 그리고 강제됐다는 것을 문장이 아니라 같은 명령을 세 곳에서 돌린 결과로 보인다.',
    proof: '모놀리스가 결제 DB 에 못 붙는다는 것을 어떻게 증명하나? "그렇게 안 썼습니다"는 증거가 아니다. 거부 한 줄만 보면 서비스가 죽어서 난 거부와도 구분이 안 된다.',
    caseStudy: {
      title: '결제의 원본이 아직 모놀리스 DB 에 있던 상태',
      situation: '프로세스 분리·독립 배포·Kafka·분산 추적이 다 있었는데 결제의 원본은 모놀리스 DB 의 tb_saga_payment 였고, payment-api 는 파이썬 dict 하나를 든 프로세스였다.',
      risk: '경계가 그림에만 있으면 어느 쪽 코드든 상대의 상태를 읽고 고칠 수 있다. 실제로 payment-api 를 재시작하면 메모리가 비어 그 전 주문의 보상 취소가 404 로 떨어졌다.',
      verification: '소유권을 payment-api 의 DB 로 옮긴 뒤, 모놀리스가 그 DB 에 TCP 로 닿는지를 대조군 둘과 함께 운영에서 직접 잰다.',
    },
    flow: {
      label: '차단 한 줄과 대조군 셋',
      steps: [
        { label: '모놀리스 → pg-services', detail: 'Connection refused', tone: 'warning' },
        { label: '모놀리스 → pg-postgresql', detail: '대조군, 통과', tone: 'success' },
        { label: 'payment-api → pg-services', detail: '대조군, 통과', tone: 'success' },
        { label: '백업 CronJob → pg-services', detail: '라벨 예외, 통과', tone: 'success' },
      ],
    },
    signals: [
      { label: '경계를 지키는 정책', metric: 'NetworkPolicy pg-services-allow-owners' },
      { label: '계정 층의 경계', metric: 'revoke connect on database ... from public' },
      { label: '차단이 나는 방식', metric: 'Connection refused (kube-router REJECT)' },
      { label: '화면이 결제 상태를 들은 시각', metric: 'tb_payment_projection.observed_at' },
      { label: '늘어난 백업 대상', metric: 'portfolio + payment + shipping dump' },
    ],
    runbook: [
      '모놀리스 파드에서 pg-services:5432 로 접속을 시도해 거부되는지 본다.',
      '같은 파드에서 pg-postgresql:5432 로 붙어 첫 번째 대조군이 통과하는지 본다.',
      'payment-api 파드에서 pg-services 로 붙어 두 번째 대조군을 본다. 여기서 막는 주체가 정책이라는 것이 갈린다.',
      '백업 CronJob 을 즉시 한 번 돌려 dump 가 DB 수만큼 뜨는지 센다.',
      '주문 화면에서 결제·배송 칸이 기준 시각과 함께 나오는지 본다. 원본이 아니라 이벤트로 받은 사본이다.',
    ],
    observability: [
      { label: '데이터 소유권 분리 글', href: '/wiki/msa-data-ownership-split' },
      { label: '인스턴스를 나눈 근거', href: '/wiki/why-a-second-postgres-instance' },
    ],
    wiki: [
      { label: '소유권을 두 겹으로 강제한 기록', slug: 'msa-data-ownership-split' },
      { label: '인스턴스를 나눈 유일한 근거', slug: 'why-a-second-postgres-instance' },
      { label: '백업 범위가 같이 늘어난 기록', slug: 'backup-scope-drift' },
    ],
    retrospectives: [
      '대조군 없이 거부 한 줄만 재면 "서비스가 죽어서 난 거부"와 구분이 안 된다. 같은 주소에 payment-api 는 붙고 모놀리스만 막히는 것이 정책의 증거다.',
      '차단은 타임아웃이 아니라 Connection refused 로 났다. k3s 의 kube-router 가 패킷을 드롭하지 않고 REJECT 하기 때문이고, 설계 때 예상한 것과 달라 실측이 고쳐 줬다.',
      '계정만 나누면 분리가 이름뿐이다. PUBLIC 이 기본으로 아무 DB 에나 CONNECT 를 가지므로 revoke connect ... from public 을 같이 해야 한다.',
      '정책이 파드를 고르는 순간 적힌 것 말고는 전부 거부다. 백업 파드를 허용 목록에서 빠뜨리면 결제 데이터가 백업에서 조용히 빠진다.',
      '노드가 하나라 이 분리는 장애 격리가 아니라 소유권 경계다. 같은 커널, 같은 디스크, 같은 전원이고 디스크가 죽으면 셋이 같이 죽는다.',
      '아래 기록은 결제 분리 배포 시점의 실측이다. 배송은 같은 구조를 복제해 로컬 검증까지 끝냈고 운영 배포 전이다.',
      '결과적 일관성의 비용도 남았다. 취소 직후 잠깐 화면에 AUTHORIZED 가 남고, 화면은 그 지연을 감추지 않고 기준 시각과 함께 적는다.',
    ],
  },
] as const satisfies readonly Scenario[];

export type ScenarioId = (typeof SCENARIOS)[number]['id'];

const WORK_RECONSTRUCTED: ScenarioProvenance = {
  kind: 'work-reconstructed',
  label: '실무 기반',
  // "출처"라는 축 자체는 목록 상단 범례가 설명한다. 여기서 다시 안내하면 줄만 길어진다.
  description: '이커머스·상품권과 서비스 운영에서 마주친 문제를 회사 데이터나 코드 없이 익명화해 구성했습니다.',
};

const PORTFOLIO_OPERATED: ScenarioProvenance = {
  kind: 'portfolio-operated',
  label: '운영 검증',
  description: 'jay-wiki 환경에서 직접 실행하고 상태·로그·지표 또는 복구 결과를 확인한 장면입니다.',
};

const POLICY_MODEL: ScenarioProvenance = {
  kind: 'policy-model',
  label: '정책 비교',
  description: '실무에서 발생할 수 있는 문제를 고정 입력으로 비교하며 실제 운영 부하나 원장 수치로 과장하지 않습니다.',
};

export const SCENARIO_PROVENANCE: Readonly<Record<ScenarioId, ScenarioProvenance>> = {
  'commerce-order-confirmation': WORK_RECONSTRUCTED,
  'gift-card-consistency': WORK_RECONSTRUCTED,
  'partner-api-resilience': WORK_RECONSTRUCTED,
  'operations-data-correction': WORK_RECONSTRUCTED,
  'privacy-data-lifecycle': WORK_RECONSTRUCTED,
  'bulk-spreadsheet-operations': WORK_RECONSTRUCTED,
  'business-metrics-backoffice': WORK_RECONSTRUCTED,
  'notification-delivery-operations': WORK_RECONSTRUCTED,
  'maintenance-communication': WORK_RECONSTRUCTED,
  'image-upload-optimization': POLICY_MODEL,
  'saga-observability': PORTFOLIO_OPERATED,
  'data-ownership-boundary': PORTFOLIO_OPERATED,
  'kafka-dlq': PORTFOLIO_OPERATED,
  'redis-chat-queue': PORTFOLIO_OPERATED,
  'search-compare': PORTFOLIO_OPERATED,
  'hpa-scaleout': PORTFOLIO_OPERATED,
  'backup-restore': PORTFOLIO_OPERATED,
  'alert-chain-drill': PORTFOLIO_OPERATED,
  'traffic-burst-control': POLICY_MODEL,
  'coupon-race-condition': POLICY_MODEL,
  'settlement-batch-retry': POLICY_MODEL,
  'connection-pool-exhaustion': POLICY_MODEL,
  'jpa-n-plus-one': POLICY_MODEL,
};

export function findScenarioProvenance(id: ScenarioId): ScenarioProvenance {
  return SCENARIO_PROVENANCE[id];
}

const LIVE: ScenarioExecution = {
  kind: 'live',
  label: 'LIVE',
  description: '실행할 때마다 실제 인프라가 동작합니다. 화면의 단계와 숫자는 그때 측정된 결과라 실행할 때마다 달라집니다.',
};

const SCRIPTED: ScenarioExecution = {
  kind: 'scripted',
  label: 'MOCK',
  description: '화면의 단계는 미리 정의한 흐름을 재생한 것입니다. 대안을 같은 기준으로 비교하기 위한 고정 입력이며 측정값이 아닙니다.',
};

// 두 축(출처 × 실행)으로도 안 갈리는 두 편이 있다. 축을 하나 더 늘리는 대신 설명만 정확히 쓴다.
// 범례(ScenarioBadgeLegend)는 kind 로 묶어 첫 항목만 보여주므로 아래 둘은 범례에 안 나온다.

/** 인프라는 실제로 돌지만 화면에 실행 버튼이 없는 편. 지금은 backup-restore 하나다. */
const LIVE_OFFSCREEN: ScenarioExecution = {
  kind: 'live',
  label: 'LIVE',
  description: '실제 인프라가 돌지만 화면 밖에서 돕니다. 정해진 시각에 자동으로 실행되며, 여기에는 실행 버튼 대신 그 결과 기록이 있습니다.',
};

/** 구성은 상시 유효한데 확인이 화면 밖 명령인 편. 지금은 data-ownership-boundary 하나다. */
const LIVE_VERIFIED_BY_COMMAND: ScenarioExecution = {
  kind: 'live',
  label: 'LIVE',
  description: '실제 클러스터에 상시 적용된 구성입니다. 화면에 실행 버튼은 없고, 경계가 실제로 막는지는 운영에서 명령으로 직접 재어 기록했습니다.',
};

/** 단계는 고정인데 딸린 패널 하나가 실물을 돌리는 편. 지금은 bulk-spreadsheet-operations 하나다. */
const SCRIPTED_WITH_LIVE_PANEL: ScenarioExecution = {
  kind: 'scripted',
  label: 'MOCK',
  description: '화면의 단계는 미리 정의한 흐름을 재생한 것입니다. 다만 내려받기 패널은 실제로 파일을 만들어 보냅니다(로그인해야 보입니다).',
};

export const SCENARIO_EXECUTION: Readonly<Record<ScenarioId, ScenarioExecution>> = {
  // 실제 인프라가 도는 9편. 나머지는 DomainScenarioEngine 이 정의된 단계를 돌려준다.
  'saga-observability': LIVE,
  'kafka-dlq': LIVE,
  'redis-chat-queue': LIVE,
  'search-compare': LIVE,
  'hpa-scaleout': LIVE,
  'backup-restore': LIVE_OFFSCREEN,
  'partner-api-resilience': LIVE,
  // 여덟 번째 LIVE. 화면 밖(휴대폰)에서 끝나는 유일한 편이다.
  'alert-chain-drill': LIVE,
  // 아홉 번째 LIVE. 실행이 아니라 상시 구성이라 확인이 명령이다.
  'data-ownership-boundary': LIVE_VERIFIED_BY_COMMAND,

  'commerce-order-confirmation': SCRIPTED,
  'gift-card-consistency': SCRIPTED,
  'coupon-race-condition': SCRIPTED,
  'settlement-batch-retry': SCRIPTED,
  'traffic-burst-control': SCRIPTED,
  'connection-pool-exhaustion': SCRIPTED,
  'jpa-n-plus-one': SCRIPTED,
  'image-upload-optimization': SCRIPTED,
  'operations-data-correction': SCRIPTED,
  'privacy-data-lifecycle': SCRIPTED,
  'bulk-spreadsheet-operations': SCRIPTED_WITH_LIVE_PANEL,
  'business-metrics-backoffice': SCRIPTED,
  'notification-delivery-operations': SCRIPTED,
  'maintenance-communication': SCRIPTED,
};

export function findScenarioExecution(id: ScenarioId): ScenarioExecution {
  return SCENARIO_EXECUTION[id];
}

/**
 * 실행이 관리자로 닫힌 편. 배지 축을 셋으로 늘리지 않고 LIVE 에 붙는 단서로 둔다 —
 * 출처·실행 두 축과 달리 모든 편에 값이 있는 분류가 아니라, 몇 편에만 붙는 조건이다.
 * SCENARIO_EXECUTION 의 상수(LIVE 등)에 필드를 넣지 않는 이유는 그 상수를 여러 편이
 * 공유해서, 필드를 넣으면 같은 값을 쓰는 편들을 다시 쪼개야 하기 때문이다.
 * 근거는 SecurityConfig 의 경로 규칙이다 — /api/admin/** 은 hasRole("ADMIN") 이다.
 */
const ADMIN_ONLY_SCENARIOS: ReadonlySet<ScenarioId> = new Set([
  'alert-chain-drill',              // POST /api/bff/admin/alert-drills/{kind}
  'hpa-scaleout',                   // POST /api/bff/admin/rehearsals/hpa
  'bulk-spreadsheet-operations',    // 내려받기 패널이 auth/me 로 ADMIN 을 확인한다
]);

export function isAdminOnlyScenario(id: ScenarioId): boolean {
  return ADMIN_ONLY_SCENARIOS.has(id);
}

export type ScenarioGroup = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly scenarioIds: readonly ScenarioId[];
};

export const SCENARIO_GROUPS = [
  {
    id: 'transaction-consistency',
    label: 'Transaction & consistency',
    title: '거래·정합성',
    description: '동시 요청과 재실행에서도 주문, 잔액, 쿠폰과 정산 결과를 한 번만 확정한다.',
    scenarioIds: [
      'commerce-order-confirmation',
      'gift-card-consistency',
      'coupon-race-condition',
      'settlement-batch-retry',
    ],
  },
  {
    id: 'distributed-integration',
    label: 'Distributed & integration',
    title: '분산 처리·외부 연동',
    description: '서비스와 메시지 경계를 넘어 발생한 실패를 격리하고 추적 가능한 상태로 남긴다.',
    scenarioIds: [
      'partner-api-resilience',
      'saga-observability',
      'data-ownership-boundary',
      'kafka-dlq',
      'redis-chat-queue',
    ],
  },
  {
    id: 'performance-data',
    label: 'Performance & data',
    title: '성능·데이터',
    description: '트래픽, DB 자원과 조회 비용을 측정해 병목의 위치와 완화 전략을 비교한다.',
    scenarioIds: [
      'traffic-burst-control',
      'connection-pool-exhaustion',
      'jpa-n-plus-one',
      'search-compare',
      'image-upload-optimization',
    ],
  },
  {
    id: 'infrastructure-recovery',
    label: 'Infrastructure & recovery',
    title: '인프라·복구',
    description: '부하 변화와 장애 이후에도 서비스 용량과 데이터를 운영 가능한 상태로 되돌린다.',
    scenarioIds: ['hpa-scaleout', 'backup-restore', 'alert-chain-drill'],
  },
  {
    id: 'operations-governance',
    label: 'Operations & governance',
    title: '운영 도구·거버넌스',
    description: '반복되는 운영 작업을 승인·감사·복구가 가능한 도구와 절차로 전환한다.',
    scenarioIds: [
      'operations-data-correction',
      'privacy-data-lifecycle',
      'bulk-spreadsheet-operations',
      'business-metrics-backoffice',
      'notification-delivery-operations',
      'maintenance-communication',
    ],
  },
] as const satisfies readonly ScenarioGroup[];

const SCENARIO_DISPLAY_ORDER: readonly ScenarioId[] = SCENARIO_GROUPS.flatMap(
  (group) => group.scenarioIds,
);

export const ORDERED_SCENARIOS: readonly (typeof SCENARIOS)[number][] = SCENARIO_DISPLAY_ORDER.map((id) => {
  const scenario = SCENARIOS.find((item) => item.id === id);
  if (!scenario) throw new Error(`Unknown scenario display order id: ${id}`);
  return scenario;
});

export function findScenario(id: ScenarioId): Scenario {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? ORDERED_SCENARIOS[0];
}

