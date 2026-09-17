'use client';

import { useRef } from 'react';
import { MermaidDiagrams } from '@/components/MermaidDiagrams';
import type { DomainScenarioRun } from './domainScenarioContract';
import type { PracticeSlug } from './DomainScenarioRunner';

type Flow = { readonly title: string; readonly summary: string; readonly source: string };

const FLOW_BY_SLUG: Readonly<Record<PracticeSlug, Readonly<Record<string, Flow>>>> = {
  'data-correction': {
    DIRECT_UPDATE: flow('통제 없는 직접 수정', '한 건 요청이 넓은 UPDATE로 번지는 실패를 재현합니다.', 'A[CS 요청 1건] --> B[조건 없는 UPDATE]\n  B --> C[37건 변경]\n  C --> D[영향 범위 초과]'),
    SELECT_ONLY: flow('수정 전 Dry run', '업무 근거와 대상, snapshot을 확인하되 실제 값은 바꾸지 않습니다.', 'A[CS ticket] --> B[거래 원장 대조]\n  B --> C[대상 SELECT]\n  C --> D[Before snapshot]'),
    CONDITIONAL_UPDATE: flow('승인된 조건부 정정', '예상 상태가 유지된 한 건만 바꾸고 불변조건을 검증합니다.', 'A[Target + approval] --> B{Expected state}\n  B -->|1 row| C[UPDATE]\n  B -->|0 / N rows| D[중단]\n  C --> E[원장 검증]'),
    ROLLBACK: flow('Snapshot 기반 복구', '후속 변경을 확인한 뒤 원 작업의 before value로 되돌립니다.', 'A[Audit 조회] --> B{후속 변경 없음}\n  B --> C[조건부 rollback]\n  C --> D[복구 검증]'),
  },
  'privacy-lifecycle': {
    RAW_ACCESS: flow('과도한 원문 조회', '역할 구분 없는 API 응답이 불필요한 개인정보를 노출합니다.', 'A[CS 조회] --> B[Raw entity]\n  B --> C[6개 원문 필드]\n  C --> D[최소 노출 위반]'),
    ROLE_MASKING: flow('역할 기반 Projection', '업무 목적과 역할을 확인해 필요한 식별 정보만 제공합니다.', 'A[Role + purpose] --> B[Field policy]\n  B --> C[Masked DTO]\n  C --> D[Access audit]'),
    WITHDRAWAL: flow('탈퇴 시점의 분리 처리', '접근 token을 폐기하고 즉시 파기와 보존 예외를 나눕니다.', 'A[탈퇴 요청] --> B[Token revoke]\n  B --> C{Field policy}\n  C --> D[즉시 파기]\n  C --> E[분리 보존]'),
    PURGE_WITH_RETENTION: flow('보존기간 만료 파기', 'DB, 로그와 backup 복원본까지 재노출 여부를 검사합니다.', 'A[Retention 만료] --> B[DB purge]\n  B --> C[Log redaction]\n  C --> D[Backup restore test]'),
  },
  'spreadsheet-operations': {
    IN_MEMORY_EXPORT: flow('전체 메모리 적재', 'row와 workbook 객체가 함께 쌓이며 heap budget을 넘는 경로를 모델링합니다.', 'A[10만 row 조회] --> B[전체 List]\n  B --> C[Workbook memory]\n  C --> D[Memory pressure]'),
    STREAMING_EXPORT: flow('Paging + Streaming', '조회 page와 workbook window를 제한해 peak memory를 일정하게 유지합니다.', 'A[기준 시각 고정] --> B[2천 row page]\n  B --> C[Streaming write]\n  C --> D[96 MB peak]'),
    INVALID_UPLOAD: flow('오류 파일 반영 차단', '업로드를 staging에서 검증하고 오류가 있으면 운영 반영을 멈춥니다.', 'A[1만 row upload] --> B[Schema 검증]\n  B --> C[Row rules]\n  C -->|18 오류| D[Apply 차단]'),
    STAGED_IMPORT: flow('정상 행 선택 반영', '정상 행은 멱등 upsert하고 오류 행은 사유를 포함해 반환합니다.', 'A[Staging] --> B{Validation}\n  B -->|9982 정상| C[Idempotent apply]\n  B -->|18 오류| D[오류 보고서]'),
  },
  'business-metrics': {
    ONE_OFF_SQL: flow('정의 없는 반복 추출', '담당자별 조건 차이가 같은 이름의 지표를 다르게 만듭니다.', 'A[가입자 수 요청] --> B[개별 SQL]\n  B --> C[12623건]\n  D[기존 보고서 12480건] --> E[143건 불일치]'),
    DEFINED_METRIC: flow('Versioned 지표 계약', 'cutoff와 포함·제외 조건을 공유해 같은 결과를 재현합니다.', 'A[Metric v3] --> B[KST cutoff]\n  B --> C[상태 + 제외 조건]\n  C --> D[12480건 일치]'),
    EXPORT_RECONCILIATION: flow('화면과 Export 대조', '같은 filter contract로 조회해 합계와 파일 행 수를 맞춥니다.', 'A[Shared filters] --> B[화면 합계]\n  A --> C[Excel export]\n  B --> D[Reconcile]\n  C --> D'),
    INDEXED_QUERY: flow('결과를 지키는 조회 개선', '실행계획과 index 전후 결과 집합을 함께 비교합니다.', 'A[EXPLAIN] --> B[Index 적용]\n  B --> C[2800ms → 180ms]\n  C --> D[결과 동일성]'),
  },
  'notification-delivery': {
    NORMAL: flow('Outbox 기반 정상 전달', '업무 commit과 발송 의도를 보존하고 callback으로 최종 상태를 확정합니다.', 'A[결제 commit] --> B[(Outbox)]\n  B --> C[Provider send]\n  C --> D[Delivery callback]'),
    TIMEOUT_RETRY: flow('응답 유실 뒤 상태 조회', '같은 request key를 조회해 이미 처리된 메시지를 다시 보내지 않습니다.', 'A[Provider send] --> B[Timeout]\n  B --> C[Status query]\n  C --> D[기존 결과 재사용]'),
    RATE_LIMIT: flow('Rate limit 재시도', 'Retry-After와 jitter를 지켜 provider와 내부 queue를 보호합니다.', 'A[Send] --> B[HTTP 429]\n  B --> C[Backoff + jitter]\n  C --> D[재시도 성공]'),
    PERMANENT_FAILURE: flow('영구 실패 격리', '재시도해도 해결되지 않는 수신처 오류는 마스킹된 DLQ로 보냅니다.', 'A[수신처 거절] --> B{오류 분류}\n  B --> C[자동 retry 중단]\n  C --> D[(Redacted DLQ)]'),
    MANUAL_REPLAY: flow('승인된 수동 재처리', '운영자 검토 뒤 기존 request key로 중복 여부를 확인합니다.', 'A[DLQ 검토] --> B[승인 ticket]\n  B --> C[동일 request key]\n  C --> D[최종 전달 확인]'),
  },
  'maintenance-mode': {
    NORMAL: flow('정상 제공', 'dependency smoke가 통과한 상태에서 읽기와 쓰기를 모두 엽니다.', 'A[Dependency smoke] --> B[Read open]\n  A --> C[Write open]\n  B --> D[정상 서비스]\n  C --> D'),
    DEGRADED: flow('기능별 부분 장애', '안전한 조회는 유지하고 불확실한 쓰기만 gate에서 차단합니다.', 'A[의존성 장애] --> B{Feature gate}\n  B -->|Read| C[계속 제공]\n  B -->|Write| D[일시 제한]'),
    MAINTENANCE: flow('Versioned 점검 상태', '권한 있는 변경과 한 공지 원본으로 웹, 앱과 API 응답을 맞춥니다.', 'A[승인된 mode v12] --> B[Write gate]\n  A --> C[Notice source]\n  C --> D[Web App API]'),
    RECOVERY: flow('검증 뒤 정상 복귀', '의존성 green 이후 실제 사용자 경로와 backlog를 확인합니다.', 'A[Dependency green] --> B[User smoke]\n  B --> C[Queue 확인]\n  C --> D[Gate open + 종료 공지]'),
  },
  'image-upload-pipeline': {
    UNRESTRICTED: flow('원본 직접 공개', '검증과 변환 없이 원본을 저장해 모든 화면에서 큰 파일을 내려받습니다.', 'A[12MB JPEG] --> B[요청 MIME 신뢰]\n  B --> C[(MinIO original)]\n  C --> D[브라우저 12MB 전송]'),
    REJECT_OVERSIZE: flow('저장 전 Admission control', 'stream byte, magic bytes와 픽셀 수를 검사해 자원 사용 전에 차단합니다.', 'A[Upload stream] --> B{Byte + magic + pixels}\n  B -->|허용| C[다음 처리]\n  B -->|초과| D[413 거절]'),
    SYNC_OPTIMIZE: flow('요청 내 동기 변환', 'EXIF를 제거하고 display·thumbnail variant가 만들어진 뒤 응답합니다.', 'A[검증된 이미지] --> B[EXIF 제거]\n  B --> C[1920px WebP]\n  C --> D[(Display + thumbnail)]'),
    ASYNC_OPTIMIZE: flow('비동기 처리 접수', '격리 원본과 PROCESSING 상태를 먼저 남기고 변환 job을 발행합니다.', 'A[검증된 원본] --> B[(Quarantine)]\n  B --> C[PROCESSING]\n  C --> D[Queue job]\n  C --> E[Placeholder]'),
    ASYNC_COMPLETE: flow('Worker 변환 완료', '멱등 worker가 variant와 READY를 확정하고 원본 보존 정책을 적용합니다.', 'A[Queue job] --> B{Checksum key}\n  B --> C[Variants 생성]\n  C --> D[READY]\n  D --> E[원본 보존 또는 삭제]'),
  },
};

export function PracticeScenarioFlow({ current, mode, slug }: { readonly current: DomainScenarioRun | null; readonly mode: string; readonly slug: PracticeSlug }) {
  const scopeRef = useRef<HTMLElement>(null);
  const selected = FLOW_BY_SLUG[slug][mode] ?? Object.values(FLOW_BY_SLUG[slug])[0];
  return (
    <section className="domain-lab-panel partner-flow operational-flow" ref={scopeRef}>
      <header><span>STEPS</span><h2>정책 실행 흐름</h2></header>
      <div className="partner-flow-heading"><strong>{selected.title}</strong><p>{selected.summary}</p></div>
      <div aria-label={`${selected.title}: ${selected.summary}`} className="mermaid" key={`${slug}:${mode}`} role="img">{selected.source}</div>
      <MermaidDiagrams scopeRef={scopeRef} signal={`practice-flow:${slug}:${mode}`} />
      {current && <div className="practice-proof"><span>EXECUTION EVIDENCE</span><strong>{current.headline}</strong><p>실행 ID와 {current.steps.length}개 처리 단계가 PostgreSQL 최근 실행 이력에 저장됐습니다.</p></div>}
    </section>
  );
}

function flow(title: string, summary: string, body: string): Flow {
  return { title, summary, source: `flowchart LR\n  ${body}` };
}
