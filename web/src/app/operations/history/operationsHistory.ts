export type OperationEventType = 'release' | 'incident' | 'recovery' | 'drill';

export type OperationEvent = {
  readonly id: string;
  readonly occurredAt: string;
  readonly type: OperationEventType;
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly string[];
  readonly impact: string;
  /** 화면에 그대로 쓰는 측정 문구. 사건마다 재는 대상이 달라서 문장을 정본으로 둔다. */
  readonly duration: string;
  /** 로그 눈금에 올릴 초 단위 값. 실제로 재지 않은 사건은 null 이고 막대를 그리지 않는다. */
  readonly durationSeconds: number | null;
  readonly href: string;
  readonly linkLabel: string;
  /**
   * 이 사건 때문에 실제로 바꾼 것. 리허설과 측정처럼 아무것도 바꾸지 않은 사건에는 없다.
   * 없는 것을 채우려고 문장을 지어내지 않는다 — 없다는 사실도 기록이다.
   */
  readonly followUp?: string;
  /**
   * 고친 뒤에 같은 상황을 다시 만들어 확인했는가. 장애를 기록하는 것과 재발하지 않는 것을 확인하는
   * 것은 다른 일이라 따로 적는다. 확인하지 않았으면 그 사실과 이유를 그대로 쓴다.
   */
  readonly recheck?: { readonly verified: boolean; readonly note: string };
};

export const OPERATION_EVENT_LABELS: Readonly<Record<OperationEventType, string>> = {
  release: '배포',
  incident: '장애',
  recovery: '복구',
  drill: '리허설',
};

/**
 * incident date의 정본. 위키 updatedAt은 편집 시각이라 사건 순서에 쓰지 않는다.
 * 각 값은 연결된 운영 글 또는 runbook에 실제 실행 증거가 있는 사건만 싣는다.
 */
export const OPERATION_EVENTS: readonly OperationEvent[] = [
  {
    id: 'content-sync-86',
    occurredAt: '2026-08-21T06:48:00+09:00',
    type: 'release',
    title: '위키 86편을 운영 기준과 맞췄다',
    summary: '배포 절차와 콘텐츠 반영 절차를 하나의 경로로 연결하고, 운영 데이터베이스와 시드, export 결과, 로컬 PostgreSQL을 모두 86편 11개 탭으로 일치시켰습니다.',
    steps: ['PostgreSQL backup', '내부 content sync', 'public smoke와 콘텐츠 일치 확인'],
    impact: '공개 화면 정상',
    duration: '배포 완료 06:48 KST',
    durationSeconds: null,
    href: '/wiki/gitops-wiki-content-sync-boundary',
    linkLabel: '동기화 경계 읽기',
  },
  {
    id: 'release-one-run',
    occurredAt: '2026-08-19T05:43:03Z',
    type: 'release',
    title: '배포 한 판을 처음부터 끝까지 쟀다',
    summary: 'GitHub Actions run 32220470022에서 수행한 build와 이미지 여섯 개 생성, rollout, 공개 smoke 검사를 하나의 기록으로 정리했습니다.',
    steps: ['GHCR 이미지 build·push', 'application rollout 70초', '공개 smoke 9개 확인'],
    impact: '정상 배포',
    duration: '전체 16분 42초',
    durationSeconds: 1002,
    href: '/wiki/release-record-one-run',
    linkLabel: '릴리스 기록 읽기',
  },
  {
    id: 'kafka-dlq-rehearsal',
    occurredAt: '2026-08-19T14:17:00+09:00',
    type: 'drill',
    title: '주문 세 건으로 retry와 DLQ를 재현했다',
    summary: '정상 처리와 한 번 실패, 계속 실패하는 경우를 운영 환경에서 연달아 실행했습니다. 그 과정에서 그동안 동작하지 않던 DLQ 알림 규칙도 함께 수정했습니다.',
    steps: ['consumer 세 갈래 정상 확인', '0.5초 간격 세 번 재시도', '발행 2.1초 뒤 DLQ 격리'],
    impact: 'notification만 실패, inventory·analytics 정상',
    duration: 'DLQ 알림 75초 안',
    durationSeconds: 75,
    href: '/wiki/kafka-dlq-rehearsal',
    linkLabel: 'DLQ 실측 기록',
    followUp: 'DLQ 알림 규칙을 고쳐, 격리된 메시지가 실제로 통보되게 했습니다.',
  },
  {
    id: 'image-pull-rollback',
    occurredAt: '2026-08-19T11:04:50+09:00',
    type: 'drill',
    title: '없는 이미지로 배포를 깨뜨렸다',
    summary: 'ImagePullBackOff 상태를 의도적으로 발생시킨 다음, 미리 기록해 둔 이전 SHA를 사용하여 Deployment 다섯 개를 복구했습니다.',
    steps: ['없는 image tag 적용', '45초 뒤 ImagePullBackOff 확인', '이전 이미지 rollback 검증'],
    impact: '공개 요청 66회 모두 HTTP 200',
    duration: '롤백 9초',
    durationSeconds: 9,
    href: '/wiki/image-that-never-pulled',
    linkLabel: '리허설 전체 기록',
  },
  {
    id: 'workflow-step-rollback',
    occurredAt: '2026-08-16T20:51:20+09:00',
    type: 'recovery',
    title: '첫 파이프라인 실패가 자동 롤백을 검증했다',
    summary: '블로그 발행 단계가 ConfigMap key 제약 때문에 실패했고, workflow에 작성해 둔 failure rollback이 처음으로 실제 상황에서 동작했습니다.',
    steps: ['20:51:20 스텝 실패', '1초 뒤 rollback 시작', '20:51:55 공개 주소 복구 확인'],
    impact: '공개 화면 중단 없음',
    duration: '감지부터 검증까지 35초',
    durationSeconds: 35,
    href: '/wiki/never-exercised-code',
    linkLabel: '검증 회고 읽기',
  },
  {
    id: 'backup-restore-rehearsal',
    occurredAt: '2026-08-16T19:51:21+09:00',
    type: 'drill',
    title: '운영 밖으로 꺼낸 백업만으로 복원했다',
    summary: '개발 머신으로 내려받은 PostgreSQL 백업 사본을 임시 데이터베이스에 복원하고, 주요 테이블의 row count와 오류 개수를 확인했습니다.',
    steps: ['백업 사본 전송 5.2초', '임시 PostgreSQL 복원', 'tb_article·tb_post 검증'],
    impact: '운영 데이터 변경 없음',
    duration: '복원 2.2초 · 오류 0',
    durationSeconds: 2.2,
    href: '/wiki/postgres-backup-restore',
    linkLabel: '백업·복원 기록',
  },
  {
    id: 'all-in-one-delivery',
    occurredAt: '2026-08-15T12:00:00+09:00',
    type: 'release',
    title: '관측·데이터·콘텐츠 배포 경계를 하나로 묶었다',
    summary: '되돌릴 수 있는 경로를 먼저 마련한 다음, 관측 Helm과 데이터 Helm, 콘텐츠 동기화, 블로그 발행을 배포 workflow 안으로 옮겼습니다.',
    steps: ['운영 values drift 대조', 'Helm atomic·revision 경계', 'backup 뒤 콘텐츠 반영'],
    impact: '반복 배포의 수동 절차 제거',
    duration: '8월 15~16일 단계 적용',
    durationSeconds: null,
    href: '/wiki/all-in-one-deploy-build',
    linkLabel: '배포 경계 읽기',
  },
  {
    id: 'silent-api-error',
    occurredAt: '2026-08-12T01:51:12+09:00',
    type: 'incident',
    title: '500 오류는 났는데 알림이 울리지 않았다',
    summary: '관리자 화면에서 발생한 글 수정 실패가 일반 오류 메시지로만 표시되었습니다. Loki에서 원인을 확인한 다음 5xx와 400 알림, trace 문맥을 보강했습니다.',
    steps: ['관리자 PUT 500 확인', 'Loki에서 원인 추적', '재현 손잡이와 중복 억제 검증'],
    impact: '관리자 글 수정 1건 실패',
    duration: '발견 후 당일 보강',
    durationSeconds: null,
    href: '/wiki/silent-500-alert-gap',
    linkLabel: '장애 회고 읽기',
    followUp: '5xx와 400 로그 알림을 추가하고 trace 문맥과 중복 억제를 넣었습니다.',
    recheck: {
      verified: true,
      note: '2026-08-12 09:59 에 같은 500 을 다시 내 알림 한 통이 trace_id 와 함께 오는 것을 확인했고, 400 전환을 배포한 뒤에도 같은 깨진 JSON 으로 400 규칙만 울리는 것을 확인했습니다.',
    },
  },
  {
    id: 'minipc-reboot',
    occurredAt: '2026-08-09T23:31:00+09:00',
    type: 'drill',
    title: 'miniPC 재부팅 뒤 복구 시간을 쟀다',
    summary: '터널 외부에서 공개 경로를 폴링하면서 k3s와 cloudflared, runner, 상태를 저장하는 workload가 복귀하는 순서를 확인했습니다.',
    steps: ['외부 2초 폴링 시작', '공개 경로 복귀 확인', 'Pod 23개 재기동 완료'],
    impact: '공개 경로 최대 60초 중단',
    duration: '전체 Pod 복귀 91초',
    durationSeconds: 91,
    href: '/wiki/minipc-reboot-recovery-drill',
    linkLabel: '재부팅 기록 읽기',
  },
  {
    id: 'cloudflared-reload-incident',
    occurredAt: '2026-08-08T12:00:00+09:00',
    type: 'incident',
    title: '터널을 고치다 SSH 복구 경로까지 닫았다',
    summary: 'cloudflared가 SIGHUP을 정상 종료로 처리했기 때문에 Restart=on-failure가 동작하지 않았고, 공개 hostname 전체가 530을 반환했습니다.',
    steps: ['SIGHUP 뒤 hostname 전체 530', '사설망으로 현장 복구', 'Restart=always와 변경 절차 적용'],
    impact: '공개 서비스와 원격 SSH 동시 중단',
    duration: '재발 방지 설정까지 당일 완료',
    durationSeconds: null,
    href: '/wiki/cloudflared-reload-cut-the-ssh-path',
    linkLabel: '터널 장애 회고',
    followUp: 'Restart=always로 바꾸고, 터널 설정을 고치는 절차를 따로 두었습니다.',
    recheck: {
      verified: false,
      note: 'SIGHUP 을 다시 보내 되살아나는지는 아직 확인하지 않았습니다. cloudflared 를 건드리면 SSH 경로가 같이 끊겨서, 사설망으로 붙을 수 있는 자리에서만 시험할 수 있습니다.',
    },
  },
  {
    id: 'static-assets-recovery',
    occurredAt: '2026-07-11T12:00:00+09:00',
    type: 'recovery',
    title: 'favicon과 기술 로고의 서로 다른 원인을 복구했다',
    summary: 'Next standalone 이미지에서 public 디렉터리가 누락된 문제와 MinIO bucket이 비어 있던 문제를, 화면 결함이 아니라 서로 다른 두 배포 경계의 문제로 구분했습니다.',
    steps: ['favicon 404 확인', 'standalone image에 public 포함', 'MinIO 자산 업로드와 HTTP 200 확인'],
    impact: '본문은 정상, 시각 자산만 누락',
    duration: '당일 복구',
    durationSeconds: null,
    href: '/wiki/production-static-asset-recovery',
    linkLabel: '자산 복구 기록 읽기',
    followUp: 'standalone 이미지에 public 디렉터리를 포함시키고 MinIO에 자산을 채웠습니다.',
  },
  {
    id: 'saga-trace-verification',
    occurredAt: '2026-07-09T12:00:00+09:00',
    type: 'drill',
    title: '배송 실패의 보상 호출을 한 trace로 묶었다',
    summary: 'Spring의 주문 처리와 FastAPI의 결제 승인 및 취소가 하나의 trace로 이어지는지, Service Graph에 관계가 생성되는지 운영 환경에서 확인했습니다.',
    steps: ['배송 실패 Saga 실행', 'Tempo에서 승인·취소 span 확인', 'Loki·Prometheus와 교차 확인'],
    impact: '제어된 simulator 요청 1건',
    duration: 'trace 315be5af… 검증',
    durationSeconds: null,
    href: '/wiki/saga-trace-service-graph-verification',
    linkLabel: 'trace 검증 기록',
  },
] as const;


/** 사건 종류별 건수. 축 범례와 필터 옆 숫자가 같은 값을 보게 한다. */
export function countByType(): Readonly<Record<OperationEventType, number>> {
  const counts: Record<OperationEventType, number> = { release: 0, incident: 0, recovery: 0, drill: 0 };
  for (const event of OPERATION_EVENTS) counts[event.type] += 1;
  return counts;
}

/** 목록이 덮는 기간. 가장 오래된 사건과 가장 최근 사건의 날짜다. */
export const OPERATION_EVENT_RANGE = {
  first: OPERATION_EVENTS[OPERATION_EVENTS.length - 1].occurredAt,
  last: OPERATION_EVENTS[0].occurredAt,
} as const;

/** 실제로 시간을 잰 사건 수. "잰 것과 안 잰 것"을 화면에서 구분해 말하려고 쓴다. */
export function measuredCount(): number {
  return OPERATION_EVENTS.filter((event) => event.durationSeconds !== null).length;
}
