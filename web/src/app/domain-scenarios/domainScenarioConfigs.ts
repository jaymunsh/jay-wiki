export type DomainScenarioMode = {
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly valueLabel?: string;
  readonly valueUnit?: string;
  readonly beforeLabel?: string;
  readonly afterLabel?: string;
};

export type DomainScenarioConfig = {
  readonly slug: 'gift-card' | 'partner-api' | 'order-confirmation' | 'traffic-burst' | 'coupon-race' | 'settlement-batch' | 'connection-pool' | 'n-plus-one' | 'data-correction' | 'privacy-lifecycle' | 'spreadsheet-operations' | 'business-metrics' | 'notification-delivery' | 'maintenance-mode' | 'image-upload-pipeline';
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly valueLabel: string;
  readonly valueUnit: string;
  readonly beforeLabel?: string;
  readonly afterLabel?: string;
  readonly modes: readonly DomainScenarioMode[];
  readonly principles: readonly { readonly title: string; readonly detail: string }[];
  readonly checklist: readonly string[];
};

export const GIFT_CARD_CONFIG: DomainScenarioConfig = {
  slug: 'gift-card',
  eyebrow: 'Gift card consistency',
  title: '상품권 사용 정합성 리허설',
  summary: '"왜 4만 원이죠?"에 답하려면 잔액 숫자 하나로는 부족하다. 변동을 원장에 쌓고, 중복 재전송과 동시 사용에도 딱 한 번만 반영한다.',
  valueLabel: '잔액',
  valueUnit: '원',
  modes: [
    { value: 'NORMAL', label: '정상 사용', description: '10,000원을 한 번 쓴다. 나머지 네 모드가 여기서 어긋나는 지점들이다.' },
    { value: 'DUPLICATE_RETRY', label: '중복 재전송', description: '같은 키로 두 번 온다. 먼저 조회해 없으면 넣는 방식은 둘 다 "없다"를 본 순간 뚫린다.' },
    { value: 'CONCURRENT_USE', label: '동시 사용', description: '잔액 1만 원에 1만 원 요청 둘. 애플리케이션에서 잔액을 검사하면 읽기와 쓰기 사이가 벌어진다.' },
    { value: 'TIMEOUT_RETRY', label: '응답 유실', description: '차감은 끝났는데 응답만 사라졌다. 여기서 재시도가 안전한 건 내가 멱등을 보장하는 서버라서다.' },
    { value: 'CANCEL', label: '사용 취소', description: '-10,000을 지우지 않는다. +10,000을 새로 쌓아야 "왜 취소됐나"가 남는다.' },
  ],
  principles: [
    { title: '잔액과 원장 분리', detail: '컬럼 하나에는 현재 값만 있고 과정이 없다. 변동을 행으로 쌓아야 언제 얼마가 빠졌는지에 답할 수 있다.' },
    { title: '확인은 DB가 한다', detail: '먼저 조회해 없으면 넣으면 두 요청이 같은 순간에 "없다"를 본다. 멱등키에 UNIQUE를 걸고, 일단 넣은 뒤 걸리면 기존 결과를 돌려준다.' },
    { title: '취소는 새 기록', detail: '기존 사용을 지우면 이력이 사라진다. 반대 부호 원장을 더하면 잔액도 맞고 흔적도 남는다.' },
  ],
  checklist: ['요청 키를 클라이언트가 만들어 재전송에도 같은 값을 쓰는가', '잔액 갱신과 원장 기록이 같은 트랜잭션에 묶여 있는가', '응답이 유실됐을 때 상태를 되찾을 경로가 있는가'],
};

export const PARTNER_API_CONFIG: DomainScenarioConfig = {
  slug: 'partner-api',
  eyebrow: 'Partner API resilience',
  title: '외부 API 장애 대응 리허설',
  summary: '응답이 없는 건 실패가 아니라 모름이다. 모름·429·5xx·위조를 같은 실패로 묶으면 그중 하나는 반드시 틀린 대응을 하게 된다.',
  valueLabel: '확정 상태',
  valueUnit: '',
  modes: [
    { value: 'NORMAL', label: '정상 승인', description: 'correlation ID를 실어 보내고 200을 받는다. 요청과 나중에 올 callback을 잇는 끈이다.' },
    { value: 'TIMEOUT_CALLBACK', label: 'Timeout', description: '여기서 다시 보내면 이중 결제다. 상대가 멱등을 보장한다는 확신이 없으니 callback으로 확정한다.' },
    { value: 'RATE_LIMIT', label: 'HTTP 429', description: '네 실패 중 유일하게 상대가 다시 올 시각을 알려준다. 그 시간을 지키는 게 서로에게 이득이다.' },
    { value: 'SERVER_ERROR', label: 'HTTP 500', description: '3회에서 끊는다. 죽은 상대를 계속 기다리면 내 스레드가 묶여 남의 장애가 내 장애가 된다.' },
    { value: 'BAD_SIGNATURE', label: '서명 오류', description: 'callback은 방향이 반대라 누구나 두드릴 수 있다. 서명이 틀리면 주문을 바꾸지 않고 감사 기록만 남긴다.' },
  ],
  principles: [
    { title: '실패마다 다른 대응', detail: 'timeout·429·5xx·위조는 상대가 알려준 것이 각각 다르다. 하나로 뭉뚱그리는 순간 어느 하나는 반드시 틀린다.' },
    { title: '모름을 확정한다', detail: '응답이 없다고 실패로 단정하지 않는다. callback과 대조로 최종 상태를 확정한 뒤에 판단한다.' },
    { title: '신뢰 경계', detail: '서명은 위조만 막고 재전송은 못 막는다. timestamp 허용 창이나 correlation ID 일회 소비가 따로 필요하다.' },
  ],
  checklist: ['connect timeout과 read timeout을 따로 잡았는가', '재시도 상한과 backoff가 코드에 고정돼 있는가', 'correlation ID로 요청과 늦게 온 callback을 이을 수 있는가'],
};

export const ORDER_CONFIG: DomainScenarioConfig = {
  slug: 'order-confirmation',
  eyebrow: 'Commerce order confirmation',
  title: '주문·재고·결제 확정 리허설',
  summary: '마지막 한 개에 주문 둘이 동시에 오면 둘 다 "재고 있음"을 읽는다. 읽기와 쓰기 사이의 틈을 어떻게 없앨 것인가.',
  valueLabel: '판매 가능 재고',
  valueUnit: '개',
  modes: [
    { value: 'NORMAL', label: '정상 확정', description: '예약·결제·확정 순서를 기준선으로 깐다. 나머지 네 모드는 이 순서가 어긋나는 지점들이다.' },
    { value: 'LAST_STOCK_RACE', label: '마지막 재고', description: '조건을 SQL 안에 넣으면 DB가 행을 잠근 채 확인과 차감을 한 번에 한다. 갱신된 행 수 1이 곧 확보다.' },
    { value: 'DUPLICATE_CALLBACK', label: '중복 Callback', description: '결제사가 두 번 보내는 건 정상 동작이다. 두 번째에도 200을 줘야 재시도가 멈춘다.' },
    { value: 'CONFIRM_FAILURE', label: '확정 실패', description: '결제사는 내 트랜잭션 밖이라 ROLLBACK이 닿지 않는다. 취소를 새로 실행해 역순으로 되돌린다.' },
    { value: 'RESERVATION_EXPIRED', label: '예약 만료', description: '브라우저를 닫은 손님은 실패 신호를 주지 않는다. 신호를 기다리지 말고 시간을 기준으로 회수한다.' },
  ],
  principles: [
    { title: '가격 snapshot', detail: '상품 가격은 언제든 바뀐다. 주문 당시 금액을 주문에 박아 둬야 나중에 청구 근거가 남는다.' },
    { title: '재고에 칸이 둘인 이유', detail: '칸이 하나면 결제가 실패했을 때 얼마를 돌려놓을지 따로 기억해야 한다. available과 reserved로 나누면 상태 자체가 답을 갖는다.' },
    { title: '보상 가능한 상태 전이', detail: '경계를 나누면 원자성을 잃는다. 대신 결제 취소와 재고 복원을 역순으로 실행할 수 있어야 한다.' },
  ],
  checklist: ['상태 전이가 역행하는 경로가 없는가', 'payment ID로 두 번째 callback을 걸러 내는가', '예약 만료 회수가 여러 대에서 동시에 돌아도 안전한가'],
};

export const TRAFFIC_BURST_CONFIG: DomainScenarioConfig = {
  slug: 'traffic-burst',
  eyebrow: 'Traffic shaping / Backpressure',
  title: '이벤트 트래픽 폭주 대응 리허설',
  summary: '초당 600건이 들어오는데 220건만 처리하면 나머지 380건은 사라지지 않는다. 버릴 것인가 미룰 것인가, 그 대가는 각각 무엇인가.',
  valueLabel: 'RPS',
  valueUnit: 'RPS',
  modes: [
    { value: 'BASELINE', label: '직접 처리', description: '아무것도 정하지 않으면 이게 기본값이 된다. 초과분이 전부 들어와 감당되던 요청까지 같이 느려진다.' },
    { value: 'RATE_LIMIT', label: '빠른 제한', description: '30초 기다리다 실패하는 것보다 0.1초에 아는 게 낫다. 대신 앞단에서 거절해야 자원을 안 쓴다.' },
    { value: 'QUEUE_BUFFER', label: 'Kafka 버퍼', description: '아무도 안 버려지는 대신 접수와 완료가 분리된다. 기술 결정이 아니라 제품 결정이다.' },
    { value: 'SLOW_CONSUMER', label: '느린 Consumer', description: '큐는 순간 몰림을 흡수하지 지속적인 처리량 부족은 못 푼다. 평균이 밀리면 lag은 무한히 쌓인다.' },
    { value: 'DUPLICATE_BURST', label: '중복 폭주', description: '폭주의 상당수는 같은 사람의 재클릭이다. 성능 튜닝이 아니라 멱등성으로 푸는 문제다.' },
    { value: 'RECOVERY', label: 'Backlog 복구', description: '입력이 멈춰도 끝이 아니다. 쌓인 것을 다 소화할 때까지가 장애 시간이다.' },
  ],
  principles: [
    { title: '앞에서 거절한다', detail: 'DB 커넥션까지 잡은 뒤에 거절하면 이미 자원을 다 쓴 뒤다. 거절 자체가 싸야 재시도가 몰려도 버틴다.' },
    { title: 'lag은 저절로 안 준다', detail: '평균 입력이 평균 처리량을 넘으면 큐를 아무리 키워도 소용없다. lag 감시와 처리량을 늘릴 수단이 같이 따라와야 한다.' },
    { title: '응답과 완료는 다르다', detail: '접수를 0.1초에 주면 응답 시간 지표는 좋아진다. 완료 시간을 따로 재지 않으면 lag이 4분 쌓여도 알아채지 못한다.' },
  ],
  checklist: ['공개 화면에서 임의 부하량을 넣을 수 없는가', '429와 queue lag를 실패율과 섞어 보고 있지 않은가', '입력이 끝난 뒤 정상으로 돌아오는 시간을 재고 있는가'],
};

export const COUPON_RACE_CONFIG: DomainScenarioConfig = {
  slug: 'coupon-race', eyebrow: 'Coupon / Concurrency', title: '선착순 쿠폰 발급 경합 리허설',
  summary: '쿠폰 100장에 요청 120개가 같은 행 하나를 노린다. 모두가 한 행에 몰리면 낙관적 락도 비관적 락도 최악이 된다.',
  valueLabel: '발급 건수', valueUnit: '건',
  modes: [
    { value: 'BASELINE', label: '조회 후 발급', description: '120개가 전부 "아직 100장 남았네"를 읽는다. 그리고 120장이 나간다.' },
    { value: 'CONDITIONAL_UPDATE', label: '조건부 UPDATE', description: '잔여 > 0 조건을 SQL에 넣으면 정확히 100번만 1건이 갱신된다. 초과가 원천적으로 불가능해진다.' },
    { value: 'REDIS_LUA', label: 'Redis Lua', description: 'Redis 명령 하나는 원자적이어도 셋을 묶으면 아니다. 단일 스레드가 스크립트를 통째로 실행해야 틈이 없다.' },
    { value: 'DUPLICATE_REQUEST', label: '중복 요청', description: '총량은 맞는데 한 사람이 세 장 받았다. 수량 방어와 1인 1매 방어는 서로 다른 장치다.' },
  ],
  principles: [
    { title: '조회보다 갱신 결과', detail: '과거에 읽은 수량은 이미 낡았다. 조건부 갱신이 몇 행을 바꿨는지가 유일하게 믿을 수 있는 답이다.' },
    { title: '사용자 멱등성', detail: '총량만 맞추면 수량은 맞는데 불공정해진다. 캠페인과 사용자 조합에 UNIQUE를 걸어 따로 막는다.' },
    { title: '원장 대조', detail: 'Redis를 게이트로 쓰면 원본은 DB에 둔다. 둘은 어긋날 수 있으니 발급이 끝나면 반드시 대조한다.' },
  ],
  checklist: ['발급 총량과 1인 1매를 각각 막고 있는가', 'Redis는 성공했는데 DB가 실패한 경우를 되돌릴 수 있는가', '품절 응답이 오히려 재시도를 부르지는 않는가'],
};

export const SETTLEMENT_BATCH_CONFIG: DomainScenarioConfig = {
  slug: 'settlement-batch', eyebrow: 'Batch / Idempotency', title: '정산 배치 재실행 리허설',
  summary: '1만 건 중 7,500건에서 죽으면 "어디서부터"가 문제가 된다. 처음부터 다시 돌려도 결과가 한 번만 반영돼야 한다.',
  valueLabel: '정산 건수', valueUnit: '건',
  modes: [
    { value: 'BASELINE_DUPLICATE', label: '전체 재실행', description: '처음부터 다시 돌리면 이미 정산된 건이 또 들어간다. 청크로 나눠 커밋하는 한 부분 성공은 필연이다.' },
    { value: 'CHECKPOINT_RESUME', label: 'Checkpoint', description: '빨라지지만 정확해지지는 않는다. 체크포인트 갱신 자체가 또 하나의 쓰기라 그 사이에서 죽는다.' },
    { value: 'IDEMPOTENT_UPSERT', label: '멱등 Upsert', description: '거래와 정산일 조합에 UNIQUE를 걸면 몇 번을 돌려도 결과가 같다. 여기가 정확성의 기반이다.' },
    { value: 'PARTIAL_RETRY', label: '부분 재처리', description: '구간으로 나누면 실패 범위가 명확해지고 병렬로 돌릴 수 있다. 대신 구간 사이에 의존이 없어야 한다.' },
  ],
  principles: [
    { title: '멱등키가 곧 재실행 범위', detail: '거래 ID만 잡으면 정당한 재정산까지 막힌다. 무엇을 같은 것으로 볼지는 기술이 아니라 업무 결정이다.' },
    { title: '체크포인트는 최적화다', detail: '어디까지 했는지 기억하면 빨라진다. 다만 정확성까지 책임지지는 않으니 멱등 upsert 위에 얹어서 쓴다.' },
    { title: '돌았다와 맞다는 다르다', detail: '배치가 예외 없이 끝났다는 건 아무것도 증명하지 않는다. 원본 거래와 건수·합계가 맞아야 비로소 끝이다.' },
  ],
  checklist: ['거래와 정산일 조합이 고유한가', '체크포인트 저장과 업무 반영 중 무엇이 먼저인지 정해져 있는가', '부분 실패를 운영자가 찾아서 다시 돌릴 수 있는가'],
};

export const CONNECTION_POOL_CONFIG: DomainScenarioConfig = {
  slug: 'connection-pool', eyebrow: 'HikariCP / Transaction', title: 'DB Connection Pool 고갈 리허설',
  summary: '외부 API를 기다리는 3초 동안 커넥션은 아무 일도 안 하면서 반납되지도 않는다. 결제사 한 곳이 느려졌을 뿐인데 게시판이 죽는다.',
  valueLabel: 'Active connection', valueUnit: '개',
  modes: [
    { value: 'TX_EXTERNAL_CALL', label: 'Transaction 내부 호출', description: '실제 DB 작업은 100ms인데 점유는 3.1초다. 전체의 97%를 놀면서 쥐고 있다.' },
    { value: 'BOUNDARY_SPLIT', label: '경계 분리', description: '외부 호출을 트랜잭션 밖으로 빼면 점유가 100ms로 준다. 원자성을 보상으로 바꾸는 거래다.' },
    { value: 'TIMEOUT', label: 'Timeout', description: '경계를 못 나눠도 상한은 걸 수 있다. 타임아웃이 없으면 OS 기본값까지, 수십 초를 기다린다.' },
    { value: 'BULKHEAD', label: 'Bulkhead', description: '외부 연동에 쓸 동시성을 8개로 묶는다. 결제는 여전히 실패하지만 결제만 실패한다.' },
  ],
  principles: [
    { title: '커넥션은 늘릴 수 없다', detail: 'PostgreSQL은 커넥션마다 프로세스를 띄운다. 풀을 키우면 병목이 DB로 옮겨 갈 뿐 사라지지 않는다.' },
    { title: '빨리 돌려주는 것뿐', detail: '네트워크 대기와 트랜잭션 수명이 겹치지 않게 한다. 늘릴 수 없는 자원이니 점유 시간을 줄이는 것 말고 방법이 없다.' },
    { title: 'Pool 신호', detail: 'active·idle·pending과 acquire timeout을 응답 p95와 겹쳐서 본다. 느려진 원인이 쿼리인지 대기인지는 그래야 갈린다.' },
  ],
  checklist: ['트랜잭션 안에서 외부 응답을 기다리는 코드가 있는가', '동시 요청 상한이 풀 크기보다 크게 잡혀 있지 않은가', '타임아웃으로 끊긴 뒤 커넥션이 제대로 반납되는가'],
};

export const N_PLUS_ONE_CONFIG: DomainScenarioConfig = {
  slug: 'n-plus-one', eyebrow: 'JPA / Query plan', title: '주문 목록 N+1 조회 리허설',
  summary: '주문 100건을 읽었는데 SQL이 301번 나간다. 개발 데이터 10건에서는 절대 안 보이고 운영에서 어느 날 갑자기 터진다.',
  valueLabel: 'SQL 실행', valueUnit: '회',
  modes: [
    { value: 'N_PLUS_ONE', label: 'Lazy loading', description: '1 + 100 + 200이다. 쿼리 하나는 빠른데 왕복이 301번이고, 건수에 비례해 늘어난다.' },
    { value: 'FETCH_JOIN', label: 'Fetch join', description: 'to-one 연관은 조인으로 한 번에 온다. 컬렉션까지 조인하면 행이 중복되고 페이징이 깨진다.' },
    { value: 'PROJECTION', label: 'Projection', description: '목록 화면에 엔티티 전체가 필요한가. 필요한 컬럼만 뽑으면 SQL 1번에 영속성 부담도 없다.' },
    { value: 'BATCH_FETCH', label: 'Batch fetch', description: '연관 ID를 묶어 IN 절로 가져온다. 설정 한 줄이라 코드를 안 고치고 전역에 깔 수 있다.' },
  ],
  principles: [
    { title: '시간이 아니라 횟수', detail: '시간은 환경마다 흔들려 테스트로 못 박는다. 쿼리 횟수는 결정적이라 "100건 조회에 3회 이하"를 단언할 수 있다.' },
    { title: '화면별 조회 모델', detail: '수정이 필요하면 엔티티, 읽기 전용 목록이면 projection이다. 조회와 수정의 모델을 나누는 판단이다.' },
    { title: '컬렉션 분리', detail: '컬렉션을 fetch join하면 주문 1건이 상품 수만큼 행으로 불어난다. LIMIT이 엔티티가 아니라 조인된 행을 자른다.' },
  ],
  checklist: ['목록 크기가 커질 때 SQL도 같이 늘어나는가', '페이징과 컬렉션 fetch join을 함께 쓰고 있지는 않은가', '실행계획과 index는 쿼리 수를 줄인 다음에 봤는가'],
};

export const DATA_CORRECTION_CONFIG: DomainScenarioConfig = {
  slug: 'data-correction', eyebrow: 'SQL / Audit control', title: '운영 데이터 정정 리허설',
  summary: '한 건 고치려다 동명이인 37건이 바뀐다. UPDATE는 이전 값을 지우는 명령이라, 실행 전에 남겨 두지 않으면 되돌릴 수 없다.',
  valueLabel: 'affected rows', valueUnit: '건', beforeLabel: 'EXPECTED', afterLabel: 'ACTUAL',
  modes: [
    { value: 'DIRECT_UPDATE', label: '직접 UPDATE', description: 'WHERE가 생각보다 넓었다. 그리고 원래 값이 뭐였는지는 이미 덮어써서 알 수 없다.' },
    { value: 'SELECT_ONLY', label: 'Dry run', description: '실행할 UPDATE의 WHERE를 그대로 SELECT로 돌려 본다. 비용이 거의 0인데 사고 대부분이 여기서 막힌다.' },
    { value: 'CONDITIONAL_UPDATE', label: '조건부 정정', description: '조회 당시 상태를 조건에 붙이고 갱신 행 수가 1인지 본다. 0이면 이미 처리됐고 2 이상이면 조건이 넓다.' },
    { value: 'ROLLBACK', label: 'Rollback', description: '그 사이 고객이 포인트를 썼으면 스냅샷으로 덮는 순간 그 사용이 사라진다. 후속 변경부터 확인한다.' },
  ],
  principles: [
    { title: '근거는 티켓이 아니라 원장', detail: '고객이 그렇게 말했다는 건 근거가 아니다. 실제 거래 기록과 대조하면 상당수가 이 단계에서 걸러진다.' },
    { title: '조건부 변경', detail: '같은 도구가 여기선 목적이 다르다. 동시성 방어가 아니라 "내가 조회했을 때의 상태가 아직 유효한가"를 묻는다.' },
    { title: '복구 가능한 감사', detail: '작업자·티켓·승인자·이전 값을 하나의 실행 ID에 묶는다. 그게 없으면 나중에 이 작업을 설명할 수 없다.' },
  ],
  checklist: ['SELECT 결과의 고객·거래가 티켓과 일치하는가', '영향 행 수가 예상과 다르면 즉시 롤백되는가', '정정한 뒤 잔액과 원장 합계를 다시 대조하는가'],
};

export const PRIVACY_LIFECYCLE_CONFIG: DomainScenarioConfig = {
  slug: 'privacy-lifecycle', eyebrow: 'Privacy / Retention', title: '개인정보 마스킹·파기 리허설',
  summary: '안 가진 정보는 유출될 수 없다. 볼 때 줄이고, 탈퇴할 때 나누고, 만료되면 지우고, 백업 복원본까지 따라간다.',
  valueLabel: '원문 노출 필드', valueUnit: '개', beforeLabel: 'BEFORE', afterLabel: 'AFTER',
  modes: [
    { value: 'RAW_ACCESS', label: '원문 조회', description: 'CS 상담에 주민번호와 전체 주소가 필요한가. 역할 구분 없이 내보내면 필요 없는 것까지 나간다.' },
    { value: 'ROLE_MASKING', label: '역할별 마스킹', description: '뒤 4자리면 본인 확인이 된다. 그리고 마스킹은 화면이 아니라 서버 projection에서 잘라야 한다.' },
    { value: 'WITHDRAWAL', label: '탈퇴 처리', description: '탈퇴는 즉시 삭제가 아니다. 결제 기록은 법으로 남겨야 하니 파기 대상과 보존 대상을 나눈다.' },
    { value: 'PURGE_WITH_RETENTION', label: '만료 파기', description: '본 테이블만 지우면 로그·색인·백업에 남는다. 그 백업으로 복원하면 지운 사람이 되살아난다.' },
  ],
  principles: [
    { title: '최소 노출', detail: '가장 확실한 보호는 애초에 수집하지 않는 것이다. 그다음이 최소만 저장하는 것, 그다음이 최소만 보여주는 것이다.' },
    { title: '파기와 보존 분리', detail: '이름·연락처는 즉시 지우고 거래 기록은 남기되 식별자를 떼어 낸다. 무엇이 팔렸는지는 남기고 누가 샀는지는 줄인다.' },
    { title: '복원 이후까지 검증', detail: '백업 파일은 직접 고칠 수 없다. 복원 자체를 트리거로 삼아 재파기를 밟거나, 보관 기간으로 자연 소멸시킨다.' },
  ],
  checklist: ['원문 조회가 누가·언제·왜까지 기록되는가', '필드마다 수집 목적과 보유기간이 붙어 있는가', '백업을 복원한 뒤 재파기 절차가 실제로 도는가'],
};

export const SPREADSHEET_OPERATIONS_CONFIG: DomainScenarioConfig = {
  slug: 'spreadsheet-operations', eyebrow: 'Excel / Streaming', title: '대용량 Excel 처리 리허설',
  summary: '10만 행을 한 번에 들면 엔티티 10만 개와 Cell 100만 개가 메모리에 올라간다. 내려받기는 메모리 문제고 올리기는 정합성 문제다.',
  valueLabel: '처리 값', valueUnit: '건', beforeLabel: 'INPUT / BEFORE', afterLabel: 'OUTPUT / AFTER',
  modes: [
    { value: 'IN_MEMORY_EXPORT', label: '메모리 적재', description: '전부 읽고 전부 만든 다음에야 파일로 나간다. 담당자 셋이 동시에 누르면 세 배다.', valueLabel: 'modelled memory', valueUnit: 'MB', beforeLabel: 'BUDGET', afterLabel: 'MODELLED PEAK' },
    { value: 'STREAMING_EXPORT', label: 'Streaming', description: '조금 읽고 조금 쓰고 놓아준다. 읽기 페이징과 쓰기 window를 같이 고쳐야 효과가 난다.', valueLabel: 'modelled memory', valueUnit: 'MB', beforeLabel: 'IN MEMORY', afterLabel: 'STREAMING' },
    { value: 'INVALID_UPLOAD', label: '오류 파일', description: '한 행씩 바로 반영하면 9,982행이 들어간 채로 18행이 실패한다. 검증 전에는 운영 테이블을 안 건드린다.', valueLabel: '반영 건수', valueUnit: '건', beforeLabel: 'INPUT', afterLabel: 'APPLIED' },
    { value: 'STAGED_IMPORT', label: 'Staging 반영', description: '정상 건만 staging을 거쳐 반영하고 오류는 행 번호와 사유로 돌려준다. "18행 실패"만으로는 못 고친다.', valueLabel: '처리 건수', valueUnit: '건', beforeLabel: 'INPUT', afterLabel: 'APPLIED' },
  ],
  principles: [
    { title: '고정된 조회 기준', detail: '페이징 도중에 글이 하나 늘면 페이지 경계가 밀린다. 같은 행이 두 번 나오거나 빠지므로 기준 시각을 고정한다.' },
    { title: 'Bounded memory', detail: 'window 밖 행은 임시 파일로 밀어낸다. 파일 크기와 heap 사용량을 떼어 놓는 게 핵심이다.' },
    { title: '검증 뒤 반영', detail: '전부 거부할지 정상 건만 반영할지는 도메인이 정한다. 정산이면 전부 거부가, 상품 정보면 부분 반영이 맞다.' },
  ],
  checklist: ['최대 행 수에서 peak memory를 실제로 재 봤는가', '파일 schema version과 업로드 요청 키가 있는가', '오류 행만 따로 보고하고 정상 건은 다시 돌릴 수 있는가'],
};

export const BUSINESS_METRICS_CONFIG: DomainScenarioConfig = {
  slug: 'business-metrics', eyebrow: 'SQL / Backoffice', title: '반복 통계 요청 화면화 리허설',
  summary: '"이번 달 가입자 수"는 사실 정의되지 않은 질문이다. 기간 기준과 탈퇴·테스트 계정 처리에 따라 답이 달라진다.',
  valueLabel: '집계 결과', valueUnit: '건', beforeLabel: 'REFERENCE', afterLabel: 'RESULT',
  modes: [
    { value: 'ONE_OFF_SQL', label: '일회성 SQL', description: '두 사람이 각자 SQL을 쓰면 다섯 가지를 다르게 해석한다. 그리고 둘 다 "가입자 수"라고 부른다.' },
    { value: 'DEFINED_METRIC', label: '지표 계약', description: '이름·정의·기간 기준·제외 조건·버전을 고정한다. 정의는 바뀌기 마련이고, 바뀐 걸 모르는 게 문제다.' },
    { value: 'EXPORT_RECONCILIATION', label: '화면·Export', description: '화면은 12,480인데 파일은 12,463이면 신뢰가 무너진다. 같은 필터를 쓰고 기준 시각을 파일에 박는다.' },
    { value: 'INDEXED_QUERY', label: '조회 계획', description: '빨라졌는데 건수가 달라졌다면 빨라진 게 아니라 틀린 것이다. 최적화의 전제는 결과가 같다는 것이다.', valueLabel: 'query duration', valueUnit: 'ms', beforeLabel: 'BEFORE', afterLabel: 'AFTER' },
  ],
  principles: [
    { title: '정의가 먼저', detail: '숫자가 안 맞는 원인은 대개 SQL이 아니라 말이다. 차트를 그리기 전에 계산 가능한 계약부터 만든다.' },
    { title: '한 filter 원본', detail: '화면과 export가 조건을 각자 들고 있으면 반드시 어긋난다. 두 곳이 같은 조회 규칙을 부르게 한다.' },
    { title: '결과 보존', detail: '지표 version과 기준 시각을 남긴다. 그래야 작년 보고서의 숫자를 지금 다시 설명할 수 있다.' },
  ],
  checklist: ['기간 기준 시간대와 cutoff가 명시돼 있는가', '테스트·탈퇴·취소 데이터를 어떻게 할지 정해져 있는가', '화면 합계와 export 행 수를 대조하고 있는가'],
};

export const NOTIFICATION_DELIVERY_CONFIG: DomainScenarioConfig = {
  slug: 'notification-delivery', eyebrow: 'Message / Retry', title: '알림 발송 실패·재처리 리허설',
  summary: '발송했다와 전달됐다는 다르다. 그리고 없는 번호에 100번 재시도하면 100번 실패하고 큐만 막힌다.',
  valueLabel: '최종 전달', valueUnit: '건', beforeLabel: 'REQUESTED', afterLabel: 'DELIVERED',
  modes: [
    { value: 'NORMAL', label: '정상 전달', description: '결제 commit과 발송 요청을 같은 트랜잭션에 남긴다. 그 사이에서 죽어도 발송 의도가 사라지지 않는다.' },
    { value: 'TIMEOUT_RETRY', label: '응답 Timeout', description: '다시 보내지 않고 같은 요청 키의 상태를 조회한다. 재시도하면 고객이 결제 문자를 두 번 받는다.' },
    { value: 'RATE_LIMIT', label: 'HTTP 429', description: '대량 발송이라 429가 잦다. 1만 건이 전부 "3초 뒤"를 정확히 지키면 3초 뒤에 또 몰린다.' },
    { value: 'PERMANENT_FAILURE', label: '영구 실패', description: '재시도로 될 실패와 안 될 실패를 가른다. DLQ로 넘길 때 수신 정보는 가리고 사유만 남긴다.' },
    { value: 'MANUAL_REPLAY', label: '운영자 재처리', description: '새 키로 보내면 사실은 전달됐던 건이 두 번 간다. 승인을 남기고 기존 요청 키를 다시 쓴다.' },
  ],
  principles: [
    { title: '업무와 발송 분리', detail: '결제 커밋이 통신사 응답을 기다릴 이유가 없다. outbox가 발송 의도를 보존하고 릴레이가 실제 전송을 맡는다.' },
    { title: '오류 분류', detail: 'timeout은 모름, 429는 잠시 뒤, 영구 거절은 사람 몫이다. 하나로 묶으면 큐가 막히거나 중복이 나간다.' },
    { title: '최종 상태 확정', detail: 'HTTP 200은 통신사가 요청을 받았다는 뜻일 뿐이다. 실제 도착은 provider ID와 callback으로만 알 수 있다.' },
  ],
  checklist: ['요청 키와 provider message ID가 이어져 있는가', '영구 실패가 자동 재시도로 흘러가지 않는가', 'DLQ와 로그에서 수신 정보가 가려지는가'],
};

export const MAINTENANCE_MODE_CONFIG: DomainScenarioConfig = {
  slug: 'maintenance-mode', eyebrow: 'Degraded / Notice', title: '점검 모드와 운영 공지 리허설',
  summary: '결제사가 죽어도 상품 조회와 주문 내역은 멀쩡하다. 정상과 장애 사이의 중간 상태를 정해 두지 않으면 대응이 과해진다.',
  valueLabel: '사용 가능 기능', valueUnit: '개', beforeLabel: 'BEFORE', afterLabel: 'AVAILABLE',
  modes: [
    { value: 'NORMAL', label: '정상', description: '기능 여덟 개가 전부 열려 있다. 나머지 세 모드가 여기서 무엇을 닫는지 비교한다.' },
    { value: 'DEGRADED', label: '부분 장애', description: '읽기는 지키고 위험한 쓰기만 막는다. 결제 없이 주문을 받으면 사람이 손으로 정리할 데이터가 쌓인다.' },
    { value: 'MAINTENANCE', label: '점검 모드', description: '화면마다 500·무한 로딩·타임아웃이면 사용자는 고장으로 읽는다. 503과 Retry-After로 모두 같은 답을 준다.' },
    { value: 'RECOVERY', label: '복구', description: '의존성이 살아난 것과 서비스가 도는 것은 다르다. 쌓인 backlog를 먼저 보지 않으면 2차 장애가 난다.' },
  ],
  principles: [
    { title: '기능별 Degraded mode', detail: '장애는 대개 일부 의존성에서 나고 영향도 일부 기능에 그친다. 기능마다 무엇에 묶여 있는지 미리 그려 둔다.' },
    { title: '단일 상태 계약', detail: '앱은 배포 주기가 달라 공지를 하드코딩하면 못 고친다. 서버가 mode version을 내려주고 웹·앱·API가 같은 것을 본다.' },
    { title: '검증 뒤 복구 선언', detail: '복구는 스위치가 아니라 절차다. 스모크로 실제 경로를 밟고 backlog를 확인한 뒤 단계적으로 연다.' },
  ],
  checklist: ['점검 모드를 켤 권한이 제한되고 기록이 남는가', '공지 경로가 장애 난 의존성과 분리돼 있는가', '쓰기를 다시 열기 전에 smoke와 queue 상태를 보는가'],
};

export const IMAGE_UPLOAD_PIPELINE_CONFIG: DomainScenarioConfig = {
  slug: 'image-upload-pipeline', eyebrow: 'Media / MinIO / Security', title: '상품 이미지 업로드·최적화 리허설',
  summary: '저장은 한 번이지만 전송은 볼 때마다 나간다. 12MB 원본을 목록 화면에서도 그대로 내려보내면 상품 20개에 240MB다.',
  valueLabel: '저장·전송 크기', valueUnit: 'KB', beforeLabel: 'ORIGINAL', afterLabel: 'PUBLIC ASSET',
  modes: [
    { value: 'UNRESTRICTED', label: '원본 그대로', description: '확장자와 Content-Type은 클라이언트가 쓰는 값이라 믿을 수 없다. 그리고 목록에서도 원본이 그대로 나간다.' },
    { value: 'REJECT_OVERSIZE', label: '용량·픽셀 거절', description: '저장한 뒤 지우면 비용은 이미 썼다. 그리고 1MB 파일이 3만×3만 픽셀이면 펼치는 순간 3.6GB다.' },
    { value: 'SYNC_OPTIMIZE', label: '동기 최적화', description: '요청 안에서 EXIF를 지우고 변환까지 마친다. 사진에 박힌 GPS 좌표는 성능이 아니라 개인정보 문제다.' },
    { value: 'ASYNC_OPTIMIZE', label: '비동기 접수', description: '응답이 빨라지고 변환이 요청 스레드를 묶지 않는다. 대신 PROCESSING 상태를 화면이 다뤄야 한다.' },
    { value: 'ASYNC_COMPLETE', label: '비동기 완료', description: '큐는 at-least-once라 같은 job이 두 번 온다. 원본 checksum으로 중복 변환을 막는다.' },
  ],
  principles: [
    { title: '크기보다 먼저 신뢰 경계', detail: '파일 이름·확장자·Content-Type은 전부 클라이언트가 쓰는 값이다. 실제 바이트를 읽고 총 픽셀까지 따로 확인한다.' },
    { title: '용도별 원본 정책', detail: '목록은 480px 썸네일이면 충분해서 240MB가 1MB가 된다. 원본은 비공개로 두거나 정책에 따라 지운다.' },
    { title: '파생 객체 Lifecycle', detail: '원본을 지우거나 바꾸면 thumbnail·display와 실패한 임시 객체까지 함께 정리한다. 안 정하면 기본값이 "다 보관"이 된다.' },
  ],
  checklist: ['stream byte와 픽셀 상한을 둘 다 확인하는가', 'EXIF·SVG script·압축 폭탄 경계를 처리하는가', '동기 CPU 비용이나 비동기 실패 재처리를 관측하는가'],
};
