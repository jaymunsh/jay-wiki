# jay-wiki 4개 대분류·11개 DB 탭 편집 계획

작성일: 2026-07-10
최근 갱신: 2026-08-21

## 목적

이 문서는 jay-wiki에서 공개할 글의 전체 지도다. 현재 DB 시드에 들어 있는 글, 구축 과정에서 남긴 워크북, 기술별 콘텐츠 가이드를 한데 모으되, 세 종류를 같은 무게로 취급하지 않는다.

- **공개됨**: `scripts/seed-portfolio-wiki.mjs`에 이미 정의된 문서. 시드 스크립트 실행 여부에 따라 운영 DB 반영 상태는 달라질 수 있다.
- **P0**: 이미 구현하거나 운영한 사실이 있고, 실행 로그·화면·명령·이미지 SHA 같은 증거를 붙여 바로 작성할 글.
- **P1**: 현재 기능을 설명하는 보강 글. P0 이후에 작성한다.
- **P2**: 기능이 더 진행되거나 반복 운영 기록이 쌓인 뒤 작성한다.

### 실무 경험 기반 글의 표기 기준

회사에서 실제로 겪은 문제는 포트폴리오와 분리해 숨기지 않는다. 익명화한 `현업 사례`, 당시 본인의 담당 범위와 한계,
jay-wiki에서 다시 만든 리허설, 현재 보완한 설계를 한 글에서 연결한다. 회사 코드·고객정보·내부 schema와 확인되지 않은
수치는 제외하되, 이커머스·상품권·외부 API처럼 사용자가 밝힌 경력 도메인은 명시할 수 있다.

| 출처 표기 | 의미 | 공개 증거 |
|---|---|---|
| 실무 경험 재구성 | 확인된 회사 경험의 문제 구조를 익명화해 재현 | 당시 역할·안전장치·결과의 사실 확인 + 현재 리허설 |
| 포트폴리오 운영 검증 | jay-wiki 환경에서 직접 실행·관측 | 실행 이력, 상태, metric·log·trace, 복구 결과 |
| 정책 비교 모델 | 실무형 문제의 대응 방식을 고정 입력으로 비교 | 결정론적 결과, 구현 코드, 실제 운영과의 한계 |

우선 공개 후보는 `운영 데이터 정정의 안전장치`, `PG 대사 파일의 불일치 격리`, `고객 알림 실패와 재발송 경계`,
`WebView 브릿지 계약과 장애 대응`이다. 각 글은 실제 수행 여부와 담당 범위를 확인한 뒤 P0/P1을 확정한다.
- **보류**: 조사 또는 초안은 있으나, 현재 프로젝트의 구현 사실로 공개하면 과장될 항목.

목표는 글 수가 아니다. 각 글은 아래 다섯 질문에 답해야 한다.

1. 왜 이 선택 또는 작업이 필요했나?
2. 실제로 무엇을 바꾸거나 실행했나?
3. 무엇으로 결과를 확인했나?
4. 어디서 막혔고 어떻게 복구했나?
5. 다음에 무엇을 개선하거나 보류했나?

## 현재 콘텐츠 인벤토리

### 현재 시드 원본의 위키 글: 86편

현재 운영 계약은 11개 탭(대시보드, 인프라, 백엔드, 데이터, 프론트엔드, 운영·관측,
시나리오·시연, 보안, 운영 검증, 개발 방식·AI, 콘텐츠·품질)이다. 아래 표의 19개 항목과
옛 수치는 2026-07-16 편집 계획 스냅샷으로, 현재 탭 집합·글 수의 근거로 사용하지 않는다.

| 탭 | 글 수 | 현재 글 |
|---|---:|---|
| 대시보드 | 1 | `jay-wiki 한눈에 보기` |
| 설계·구축 > 인프라 | 6 | miniPC 하드웨어·용량 설계, Tunnel, 재부팅 복구, 서비스 경계, k3s 매니페스트 |
| 설계·구축 > 백엔드 | 5 | BFF 경계, OAuth public origin, ADMIN/USER, Saga 계약, 오류 응답 |
| 설계·구축 > 데이터 | 7 | DB 위키, restore drill, 검색 비교, nori image, MinIO 자산, 전체 스키마 ERD, 시드·revision 경계 |
| 설계·구축 > 프론트엔드 | 2 | `프론트 전면 개편의 기준`, `운영 위키의 읽기 성능과 반응형 안정성을 개선한 방법` |
| 운영·검증 > 관측 | 1 | Loki·Tempo로 metrics·logs·traces 연결 |
| 운영·검증 > 운영 | 4 | GHCR runner, backup·restore, MinIO 이미지 자산 수명주기, GitOps 콘텐츠 동기화 |
| 운영·검증 > 시나리오·시연 | 3 | Saga·Kafka, Redis chat, 검색 비교 |
| 운영·검증 > 보안 | 2 | Markdown XSS와 관리자 변경 경계, 계정·Secret 최소 권한 |
| 운영·검증 > 운영 검증 | 5 | 운영 반영·backup·trace·asset·반응형 회귀 확인 기록 |
| 개발 과정·확장 > 개발 프로세스 | 3 | delivery loop, 가설 기반 디버깅, 증거 수준과 주장 경계 |
| 개발 과정·확장 > AI 활용 | 2 | AI 에이전트 개발 방식, Keychain·TOTP 수동 운영 경계 |
| 개발 과정·확장 > 거버넌스 | 4 | 오픈소스·콘텐츠 출처, 문서·이미지 보존, 공개 서비스 법적 경계, MinIO 공개 자산 |
| 개발 과정·확장 > 회고 | 2 | 포트폴리오 회고 방식, troubleshooting |
| 개발 과정·확장 > 로드맵 | 1 | 콘텐츠 이식 이후의 우선순위 |
| 프로젝트·랩 > 개인 프로젝트 | 3 | donts3p, mding, Jaycron 로컬 우선 앱 개발기 |
| 프로젝트·랩 > 팀 프로젝트 | 2 | 공시톡톡 RAG 챗봇 MVP 회고, Quantinue 모의 자동매매 설계·운영 회고 |
| 프로젝트·랩 > 기술 실험 | 1 | M1 Max에서 Ollama와 oMLX 로컬 LLM runtime 비교 |
| 프로젝트·랩 > 도구·워크플로 | 2 | cmux와 Orca ADE의 실제 적용 방식과 한계 기록 |

2026-07-11에 직전 기준 28편을 로컬 PostgreSQL과 miniPC 운영 DB에 반영했다. 2026-07-12에는 운영 검증 탭과
근거 기반 글 5편을 로컬 DB에 추가해 당시 원본과 로컬 조회 결과를 33편으로 맞췄다. 2026-07-15에는 대분류 정보 구조와
AI 활용 기록, LAB 하위 분류와 이미지 자산 ADR을 추가해 로컬 기준 17개 DB 탭·35편으로 갱신했다. 이어 miniPC 하드웨어와
용량 설계 글을 추가한 뒤 `거버넌스` 탭을 분리하고 라이선스·콘텐츠 출처 및 문서·이미지 보존 기준을 배치해
18개 탭·38편으로 확장한 뒤 개인정보·OAuth·게시판·저작권을 코드와 연결한 출시 점검 글을 추가해
39편으로 확장했다. 2026-07-17에는 IOKit assertion과 LaunchAgent 복구를 다룬 donts3p 개발기를 개인 프로젝트에 추가해
40편으로 확장했다. 2026-07-18에는 IndexedDB·Service Worker·zip 백업 경계를 다룬 mding 개발기를 추가해 41편으로 확장했다.
2026-07-20에는 공시톡톡 팀 프로젝트의 통합·AI 재구축·검증 한계를 다룬 회고를 추가해 42편으로 확장했다.
이후 Jaycron, 도구 사용기, 로컬 LLM 실험, 운영·보안·개발 프로세스 글을 추가했고, 2026-08-01에는 Quantinue의
독립 JOB·판단 원장·장중 감시와 7거래일 운영 한계를 다룬 팀 프로젝트 회고를 추가해 54편으로 확장했다.
2026-08-02에는 실물 스키마 조회를 근거로 19개 테이블을 7개 도메인 ERD로 나눈 전체 스키마 지도와, 시드와 revision이 서로 다른 축임을 정리한 글을 데이터 탭에 추가해 56편이 됐다.
이미지 작성 규칙은 공개 글이 아니라 관리자 `/admin/guide`에서 제공한다. miniPC 운영 DB 반영은
backup과 remote dry-run 검토 뒤 별도로 실행한다.

### 이미 존재하는 원본 문서

> 2026-07-10: 시드 스크립트가 백틱 하나 때문에 실행되지 않고 있었다. 지금은 고쳤고,
> 재실행해도 slug 기준 upsert 라 중복이 생기지 않는다. 2026-07-11부터는 현재 DB와 내용이 다른 문서만
> 저장하므로 무변경 재실행은 revision과 updatedAt을 올리지 않는다. `--dry-run`은 쓰기 없이 변경과 운영에만
> 남은 문서를 보고한다.
>
> 또한 예전 MarkdownSyncRunner 가 빈 DB 에 `intro`, `redis` 두 글을 넣고 있었다. 러너는 제거했지만,
> 운영 DB 에 이미 들어간 글은 남아 있으므로 관리자 화면에서 정리한다.

| 원본 | 용도 | 공개 글로 바꾸는 원칙 |
|---|---|---|
| `workbook/00-setup.md` ~ `workbook/09-cicd-backup.md` | 구축 순서와 완료 조건 | 튜토리얼 전체를 복사하지 않고 실제 선택과 검증 결과를 중심으로 분리한다. |
| `workbook/09-backup-phase-b-plan.md` | 외부 백업 계획 | R2가 완성되기 전에는 `계획` 또는 `NEXT`로만 표현한다. |
| `tech/*.md` | 기술별 글감과 시연 카탈로그 | 현재 구현·운영 증거가 있는 항목만 발행한다. 일반 기술 설명은 보조 자료다. |
| `docs/superpowers/specs/2026-07-08-order-saga-simulator-design.md` | Saga 설계 초안 | 구현 결과와 실패 주입·보상 결과를 더해 설계 결정 글로 전환한다. |
| `docs/archive/**` | 폐기된 설계·프로토타입 문서 | 인용하지 않는다. 결정이 바뀐 배경으로만 참조한다. |
| Git 이력의 `docs(...)` 커밋 | 배포·smoke·관측 검증 흔적 | 실행 날짜, 커밋 SHA, 화면 또는 로그를 붙인 운영 기록의 근거로 사용한다. |

### 공개하지 않을 원본 또는 표현

- MD 파일 기반 위키 구현은 현재 구조가 아니다. `workbook/01-wiki-site.md`는 DB 본문·revision 전환의 배경으로만 인용한다.
- Spring Cloud Gateway는 현재 공개 경로의 핵심이 아니다. 현재 경계는 Next.js BFF이므로, Gateway 일반론을 구현된 기능처럼 쓰지 않는다.
- Spring Batch는 현재 시연 가능한 핵심 기능이 아니다. 구현 전에는 로드맵 또는 설계 메모로만 둔다.
- Cloudflare R2 외부 복제는 Phase B다. 완료 전에는 `운영 중`이나 `백업 완료`라고 쓰지 않는다.

## 발행 순서

### 1차: 운영 증거를 먼저 남긴다

1. `git push부터 miniPC k3s rollout까지` - 실제 GitHub Actions 실행 한 건
2. `복원 리허설 #1` - dump가 아닌 restore 결과와 소요 시간
3. `배송 실패 요청 하나를 trace로 찾기` - Saga, Loki, Tempo, Prometheus 연결
4. `Kafka DLQ를 의도적으로 만든 날` - Outbox, retry, DLQ 증거
5. `재부팅 뒤 서비스를 복구하는 순서` - k3s, Tunnel, runner, PVC 확인
6. `10만 건 검색 비교의 실제 결과` - 동일 검색어의 수치와 판단

### 2차: 구축 과정의 결정을 설명한다

7. DB 본문·revision 전환
8. Next.js BFF와 OAuth 경계
9. MinIO 자산 제공과 외부 저장소 경계
10. 홈 정보 구조와 시나리오 진입 설계
11. HPA와 서비스 제어 리허설
12. 장애 회고 묶음

### 3차: 반복 운영과 다음 단계

13. 월간 운영 상태 기록
14. R2 외부 복제 및 외부 restore 리허설

---

## 대시보드

이 탭은 기술 사전이 아니라 방문자의 탐색 순서를 정하는 곳이다. 구조를 설명하는 글은 짧게 유지하고, 각 글이 어떤 실행 화면 또는 운영 증거로 이어지는지 명확히 한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 확인할 증거 |
|---|---|---|---|
| 공개됨 | `jay-wiki 한눈에 보기` / `jaywiki-main-map` | 프로젝트 목적, miniPC·위키 선택 이유, 시스템 경계, 5분 탐색 순서 | 시나리오 허브, 운영 맵, 관련 위키 링크 |
| P1 | `이 프로젝트를 읽는 순서` / `project-reading-guide` | 면접관, 백엔드 개발자, 운영 관점별로 무엇을 먼저 볼지 안내 | 각 경로가 실제 문서·시나리오로 이동하는 링크 |
| P1 | `현재 운영 상태: 배포부터 복구까지` / `current-operating-state` | 현재 릴리스, 핵심 서비스 상태, 마지막 검증일을 요약 | image SHA, GitHub Actions run, backup rehearsal 날짜 |
| P2 | `릴리스 노트` / `release-notes` | 기능 목록이 아닌 운영적으로 달라진 점을 버전별로 기록 | 링크된 커밋, 배포 run, 검증 결과 |

## 설계·구축 > 인프라

이 탭은 “미니PC 한 대에 k3s를 올렸다”가 아니라, 외부 공개·내부 경계·재시작을 어떻게 감당했는지 기록한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `미니PC k3s와 Cloudflare Tunnel 배포 구조` / `minipc-k3s-cloudflare` | Next.js만 공개하고 내부 서비스는 cluster DNS로 유지한 구조 | `workbook/06-deploy.md`, Tunnel config, k8s manifest |
| P0 | `재부팅 뒤에도 서비스가 돌아오는지 확인하기` / `minipc-reboot-recovery-drill` | 재부팅 후 k3s node, PVC, cloudflared, runner가 돌아오는 순서와 실패 지점 | 실제 재부팅 시간, `kubectl get pods`, public HTTP smoke |
| P0 | `locally configured Cloudflare Tunnel을 잘못 이해한 날` / `cloudflare-tunnel-config-postmortem` | 대시보드 변경이 아닌 `config.yml` 변경이 필요했던 원인과 복구 | config validate, service restart, HTTP 200 |
| P1 | `미니PC를 데이터와 앱의 경계로 사용한 이유` / `minipc-boundary-decision` | 비용 절감이 아니라 스토리지·네트워크·복구를 직접 다루기 위한 선택 | 네임스페이스, PVC, systemd, 운영 체크리스트 |
| P1 | `k3s manifest를 서비스별로 나눈 기준` / `k3s-manifest-boundaries` | namespace, Deployment, StatefulSet, Service, Secret, PVC 역할 | `infra/k8s/` 매니페스트와 실제 Pod 상태 |
| P1 | `외부 공개는 하나, 내부 서비스는 여럿` / `public-ingress-internal-services` | Traefik, Tunnel, Next.js BFF가 만드는 공개 경계 | 외부 URL과 내부 Service DNS 비교 |
| P2 | `미니PC 장애를 가정한 복구 runbook` / `minipc-disaster-recovery-runbook` | 디스크·노드·Tunnel 장애를 구분한 복구 절차 | 재부팅 및 restore drill 결과가 쌓인 뒤 발행 |

## 설계·구축 > 백엔드

백엔드 글은 프레임워크 소개보다 경계, 계약, 권한, 실패 처리의 선택을 설명한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `Spring API를 외부에 직접 열지 않은 이유` / `spring-bff-auth-boundary` | Browser → Next.js BFF → Spring 내부 API 경계 | `/api/bff`, Service DNS, httpOnly cookie |
| P0 | `Google OAuth가 공개 URL을 잃지 않게 한 방법` / `oauth-public-origin-smoke` | 프록시의 forwarded proto 문제와 `APP_PUBLIC_ORIGIN` 선택 | OAuth 302, callback URL, secure cookie smoke |
| P1 | `로컬 ADMIN과 Google USER를 분리한 이유` / `admin-user-role-boundary` | 관리자 편집 권한과 일반 사용자 작성 권한을 같은 로그인 UI 안에서 분리 | role별 화면, 게시판 author 저장 결과 |
| P1 | `Spring과 FastAPI를 Saga 경계로 나눈 이유` / `spring-fastapi-payment-contract` | 결제 승인은 별도 서비스 계약으로, orchestration은 Spring에 둔 이유 | authorize/cancel 요청, contract test, trace |
| P1 | `API 오류를 운영 가능한 형태로 만드는 기준` / `api-error-contract` | RFC7807, validation, correlation ID, 사용자 메시지의 경계 | 실제 오류 응답과 trace/log 연결 |
| P2 | `게시판 쓰기와 권한 검증의 경계` / `board-write-authorization` | 익명·USER·ADMIN의 작성·삭제·조회수 책임 | API test, UI 권한 차이, Redis view counter |
| 보류 | `Spring Cloud Gateway 도입 판단` / `gateway-decision-record` | 현재 BFF를 대체하지 않는다. 서비스 경계가 더 커질 때 비교한다. | 구현 전에는 로드맵·ADR 성격으로만 유지 |
| 보류 | `Spring Batch 도입 판단` / `batch-decision-record` | 배치가 필요한 실제 작업이 생기기 전에는 일반론을 공개하지 않는다. | backup CronJob과 혼동하지 않기 |

## 설계·구축 > 데이터

데이터 탭은 저장소의 이름보다 Source of Truth, 색인, 캐시, 자산, 복구 책임의 차이를 보여준다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `Markdown 파일에서 DB 위키로 전환한 이유` / `postgres-db-wiki-revision` | 배포 컨테이너의 파일 대신 PostgreSQL을 본문 SoT로 선택하고 revision을 만든 이유 | `tb_article`, `tb_revision`, version/revert 동작 |
| 공개됨 | `시드와 revision은 서로 다른 축이다` / `content-origin-and-history-boundary` | 원본이 어디 있는가와 이력을 남기는가를 분리하고, 둘을 켰을 때 치른 대가를 기록 | 시드 6,608줄·55편, revision 192행, 삭제 문서 5편의 잔존 이력 7행 |
| 공개됨 | `전체 DB 스키마를 도메인별 ERD로 읽기` / `db-schema-erd-map` | 19개 테이블을 7개 도메인 ERD로 나누고 원본·파생, 실행 원장·도메인 데이터, FK를 건 곳과 걸지 않은 곳의 경계를 설명 | 로컬 PostgreSQL 18.4 `pg_catalog` 조회, `V1~V12`, JPA 엔티티 18개 |
| P0 | `PostgreSQL 18 백업을 실제로 복원한 기록` / `postgres-restore-drill-1` | pg_dump, sha256, `pg_restore --list`, 임시 DB restore와 실제 소요 시간 | `scripts/rehearse-postgres-restore.sh` 실행 결과, row count 비교 |
| P0 | `10만 건 검색 비교의 실제 숫자` / `search-comparison-results` | LIKE, tsvector+GIN, OpenSearch+nori를 같은 쿼리에서 비교 | 응답 시간, 결과 수, highlight, fallback |
| P1 | `OpenSearch nori 이미지를 별도로 만든 이유` / `opensearch-nori-image` | 기본 이미지의 analyzer 한계와 custom image 배포 방식 | `infra/opensearch/Dockerfile`, image tag, query 결과 |
| P1 | `Redis를 캐시 이상으로 쓴 세 가지 장면` / `redis-runtime-state` | 조회수, 채팅 room/queue, rate limit/heartbeat의 상태 수명 차이 | Redis keys, TTL, ZSET, Stream 화면 |
| P1 | `MinIO에서 포트폴리오 자산을 제공하는 이유` / `minio-portfolio-assets` | 기술 로고와 오브젝트 자산을 same-origin route로 제공한 이유 | MinIO bucket, asset route, 장애 시 텍스트 fallback |
| P1 | `색인 데이터와 원본 데이터를 분리한 기준` / `source-of-truth-and-indexes` | PostgreSQL 원본, Redis 단기 상태, OpenSearch 재색인 가능 데이터의 구분 | backup 대상 표, reindex 절차 |
| P2 | `외부 R2 복제 뒤의 restore drill` / `r2-external-restore-drill` | R2에서 내려받아 복원할 수 있는지 확인한다. | Phase B 완료 후만 발행 |

## 설계·구축 > 프론트엔드

프론트엔드 탭은 장식 과정이 아니라, 기능이 많은 운영 프로젝트를 사용자가 이해하는 구조로 바꾼 결정을 남긴다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `프론트 전면 개편의 기준` / `nextjs-frontend-redesign` | 홈, 시나리오, 위키, 프로필 메뉴의 정보 구조를 다시 잡은 이유 | 현재 홈, 시나리오 허브, 권한별 UI |
| P0 | `프로젝트 맵을 기술 목록이 아닌 흐름으로 만든 이유` / `orchestration-map-information-design` | k3s 중심의 흐름, 영역 선택 상세, 모바일 읽기 순서를 설계한 과정 | orchestration map, 1280/768/390 QA 캡처 |
| P1 | `첫 화면에서 무엇을 먼저 보여줄지 결정한 기준` / `home-hub-information-architecture` | 기능 개수 대신 시스템 흐름·시나리오·운영 기록을 중심으로 만든 이유 | hero CTA, 문서 탭, 탐색 경로 |
| P1 | `DB 위키 편집과 revision을 UI로 읽히게 한 방법` / `wiki-editor-revision-experience` | 관리자 편집, version, rollback, 문서 순서의 UX | editor, revision list, role visibility |
| P1 | `Mermaid와 라이브 시나리오를 함께 두는 기준` / `static-diagram-and-live-proof` | 다이어그램은 구조, 시나리오는 실행 증거라는 역할 분리 | Mermaid, Saga/Kafka 실행 화면 링크 |
| P2 | `모바일에서 운영 도구를 읽히게 만드는 규칙` / `mobile-operational-ui-rules` | 긴 기술 라벨, 표, 선택 상세가 모바일에서 무너지지 않게 한 기준 | 390px visual QA와 실제 변경 사례 |
| 공개됨 | `운영 위키의 읽기 성능과 반응형 안정성을 개선한 방법` / `wiki-navigation-and-responsive-stability` | URL 기반 문서 탐색, stale response 차단, Mermaid·탭·표의 컴포넌트 내부 overflow | 390/768/1280 QA, 딥링크, Mermaid 내부 스크롤 |

## 운영·검증 > 관측

metrics, logs와 traces를 연결해 시스템에서 무슨 일이 일어나는지 설명한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `Loki와 Tempo로 요청 하나를 추적하는 방법` / `observability-loki-tempo-grafana` | Saga 실패를 metrics, logs, trace로 함께 확인하는 방법 | Grafana, Loki query, Tempo trace, Service Graph |
| P0 | `배송 실패 요청 하나를 끝까지 추적한 기록` / `saga-trace-investigation-1` | 실패 주입 후 지표·로그·trace에서 같은 요청을 찾는 실제 절차 | trace ID, Loki log, Prometheus series, Tempo screen |
| P0 | `HPA 1에서 2로 scale-out을 확인한 날` / `hpa-scaleout-rehearsal` | 부하를 주고 replica가 늘어난 사실과 복구 뒤 상태를 기록한다. | HPA/POD/Grafana |
| P0 | `백엔드 다운 알림을 실제로 복구한 기록` / `backend-down-alert-rehearsal` | Alertmanager와 Telegram 알림이 장애·복구를 모두 알려주는지 확인한다. | alert timestamps |

## 운영·검증 > 운영

실제 배포, 백업, 저장소와 자산 수명주기를 유지하는 절차와 증거를 기록한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `GHCR와 self-hosted runner로 자동 배포하기` / `cicd-ghcr-runner` | tar 배포에서 Actions, GHCR, miniPC runner로 전환한 이유 | `.github/workflows/deploy.yml`, runner, rollout |
| 공개됨 | `백업은 복원해보기 전까지 백업이 아니다` / `postgres-backup-restore` | Phase A 백업·restore 원칙과 Phase B 필요성 | backup CronJob, restore rehearsal |
| 설계 확정 | `위키 이미지와 MinIO 자산 수명주기를 관리하는 방법` / `wiki-image-asset-lifecycle` | same-origin proxy, 운영 MinIO 공동 사용, revision 참조와 지연 삭제 기준 | asset API와 DB 구현 후 증거 갱신 |
| P0 | `릴리스 기록 #1: git push부터 public smoke test까지` / `release-record-1` | 특정 배포 한 건을 SHA 단위로 기록한다. build, registry, runner, rollout, smoke test를 모두 남긴다. | Actions run URL, image SHA, `kubectl rollout status`, public curl |
| P0 | `되돌릴 수 없는 파이프라인을 고친 날` / `deployment-rollback-safety` | 스모크가 실패해도 이미지가 그대로 남던 문제와, 롤백 조건을 스모크 실패로 좁힌 이유 | `deploy-ghcr-images.sh`의 ERR trap, `rollback-deployment.sh` |
| P1 | `GHCR pull secret이 없으면 무엇이 깨지는가` / `ghcr-pull-secret-incident` | registry credential 누락과 k3s image pull 실패를 진단한 사례 | Pod events, secret creation, successful pull |
| P1 | `self-hosted runner를 systemd로 고정한 이유` / `runner-service-recovery` | 임시 nohup runner 충돌을 없애고 재부팅 뒤에도 job을 받게 만든 과정 | systemd unit, runner labels, successful deploy job |
| P1 | `운영 Secret을 파일과 분리한 기준` / `kubernetes-secret-operational-boundary` | JWT, GHCR pull token, backup, Telegram Secret을 git과 분리한 이유 | `secret.example.yaml`, create scripts, secret names only |
| P1 | `배포 롤백 runbook` / `deployment-rollback-runbook` | immutable SHA image 기준으로 어느 시점에 어떤 명령으로 되돌릴지 정한다. | 스크립트는 있다. 실제 rollback rehearsal 뒤 발행 |
| P2 | `운영 월간 점검표` / `monthly-operations-review` | 배포, backup, alert, image, node 상태를 매월 점검한다. | 체크리스트와 날짜별 결과 |

## 운영·검증 > 시나리오·시연

이 탭은 기술 소개가 아니라 방문자가 실패·재시도·대기열·검색 차이를 직접 실행해 보는 곳이다. 현재 AI는 구현된 기능이 아니므로 시연 탭의 본체는 Saga, Kafka, Redis, 검색이다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `Saga, Outbox, Kafka를 주문 시나리오로 분리한 이유` / `saga-kafka-outbox-order` | 위키 도메인에 패턴을 억지로 붙이지 않고 주문 시나리오로 분리한 이유 | `/saga/order`, `/kafka/order`, Outbox table |
| 공개됨 | `랜덤채팅 대기열을 Redis ZSET으로 만든 이유` / `redis-random-chat-queue` | 정원, 대기열, 자동 승격을 Redis 자료구조로 나눈 이유 | `/chat`, SET/ZSET/STREAM debug view |
| 공개됨 | `10만 게시판과 검색 비교를 만든 이유` / `search-comparison-100k` | 같은 데이터에서 세 검색 방식을 비교하는 이유 | `/board/search`, 100k corpus, nori highlight |
| P0 | `Saga 배송 실패에서 보상이 끝날 때까지` / `saga-shipping-failure-runbook` | `SHIPPING_REQUEST` 실패 주입부터 payment cancel, inventory release까지의 결과를 기록 | scenario ID, timeline, trace, tests |
| P0 | `Kafka notification을 DLQ로 보내는 실험` / `kafka-dlq-rehearsal` | 정상·한 번 실패·계속 실패를 비교하고 retry/DLQ 상태를 남긴다. | consumer timeline, DLQ metric, alert |
| P0 | `정원 3명인 채팅방에서 4번째 사용자가 들어오면` / `redis-chat-queue-rehearsal` | 가상 사용자로 queue와 자동 승격을 재현한다. | members, queue rank, Stream event |
| P1 | `검색 장애에서 PostgreSQL fallback으로 내려가는 방법` / `search-fallback-behavior` | OpenSearch unavailable 상황에서도 자동완성이 어떤 기준으로 동작하는지 설명 | fallback response, error log, UI result |
| P1 | `시나리오 화면을 데모가 아니라 검증 도구로 만든 기준` / `scenario-as-verification-tool` | 실패 주입과 상태 노출이 포트폴리오 증거가 되는 이유 | Saga/Kafka/Chat control and evidence |

## 개발 과정·확장 > 개발 프로세스

이 탭은 AI 도구와 무관하게 jay-wiki를 계획, 구현, 검증하고 배포하는 반복 가능한 작업 절차를 기록한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| P1 | `요청부터 운영 검증까지 이어지는 개발 루프` / `development-delivery-loop` | 조사, 작은 변경, 테스트, browser QA, commit, rollout과 기록의 순서 | Git 이력, CI run, 진행상황 문서 |
| P1 | `로컬과 miniPC 환경을 분리해 검증한 기준` / `local-production-verification-boundary` | 로컬 기능 검증과 운영 smoke의 책임 차이 | local test, public smoke, kubectl evidence |

## 개발 과정·확장 > AI 활용

이 탭은 AI를 제품 기능처럼 포장하지 않는다. AI 에이전트를 조사, 구현, 검증과 기록에 사용하면서 사람이 유지한 결정과
실패를 되돌린 방법을 실제 Git·테스트·운영 근거로 설명한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `AI 에이전트와 jay-wiki를 개발한 방식` / `ai-assisted-development-harness` | AI 작업 하네스, 사람의 결정 경계, 검증과 롤백 | Git 이력, 테스트, browser QA, 상태 문서 |
| P1 | `AI가 만든 결과를 그대로 반영하지 않은 이유` / `ai-output-review-and-rollback` | UI 롤백과 운영 가정 수정 사례를 통해 승인 기준 설명 | revert commit, 화면 비교, 운영 검증 로그 |
| P1 | `긴 개발 세션의 맥락을 유지한 방법` / `agent-context-continuity` | 상태 문서, 편집 계획, export와 Git을 세션 기억으로 사용 | docs, wiki export, commit history |
| P2 | `AI 활용 효과를 측정할 조건` / `ai-assistance-measurement` | 시간 절감·결함률을 측정하기 전에는 생산성 수치를 주장하지 않음 | 반복 작업 데이터가 쌓인 뒤 발행 |

## 개발 과정·확장 > 거버넌스

이 탭은 사이트를 만든 순서가 아니라 변경 가능한 자산을 어떤 기준으로 반입·소유·보존하는지 기록한다.
보안 구현과도 구분해, 정책과 책임 경계가 실제 데이터 수명주기에 어떻게 연결되는지를 설명한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `오픈소스 라이선스와 콘텐츠 출처를 관리하는 기준` / `open-source-license-content-governance` | 폰트, 패키지, 컨테이너, 기술 로고와 이미지의 반입 기준 | package metadata, 공식 라이선스, `THIRD_PARTY_NOTICES.md` |
| 공개됨 | `문서와 이미지 자산의 소유·보존 기준` / `wiki-content-asset-retention-governance` | PostgreSQL revision, MinIO asset, 출처와 삭제 경계 | asset API, `tb_revision`, `tb_article_asset` |
| 공개됨 | `개인 포트폴리오 서비스를 공개하기 전 확인한 법적 경계` / `personal-service-legal-launch-boundary` | 개인정보, OAuth, UGC, 저작권과 출시 차단 항목 | 실제 entity·cookie·외부 서비스, 공식 법령 |
| P1 | `의존성을 추가하고 업데이트하는 기준` / `dependency-change-governance` | 직접·전이 의존성 검토, SBOM, 버전 변경 승인 | lockfile diff, image SBOM, CI artifact |
| P1 | `운영 정보를 공개할 때 가리는 기준` / `public-operations-data-boundary` | 상태와 증거는 공개하되 Secret·개인정보·공격 표면은 감추는 원칙 | monitoring BFF, redaction, access runbook |

## 개발 과정·확장 > 회고

회고는 모든 버그를 나열하는 곳이 아니다. 선택을 바꾸었거나 재발 방지 규칙을 만든 사건을 하나의 글로 남긴다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `운영 회고를 포트폴리오에서 읽히게 만드는 방법` / `portfolio-retrospective-map` | 회고 글의 구조와 왜 기능 목록만으로 부족한지 설명 | 회고 템플릿, 관련 운영 글 |
| 공개됨 | `트러블슈팅 회고: 상태, 환경, 경계의 가정` / `troubleshooting-log` | Flyway, Cloudflare, SSH, Next, OpenSearch의 공통 실패 패턴 | 증상-원인-해결 표 |
| P0 | `Next.js dev 서버와 .next가 충돌한 날` / `next-routes-manifest-postmortem` | dev 서버가 켜진 상태에서 build가 산출물을 바꾸며 `routes-manifest` ENOENT가 발생한 사건 | error log, clean restart, 재발 방지 순서 |
| P0 | `백틱 하나가 시드 스크립트를 멈춘 날` / `seed-script-backtick-postmortem` | `String.raw` 본문의 인라인 백틱이 템플릿을 조기 종료시켜, 문법 검사는 통과하고 실행은 실패한 사건 | `node --check` 통과 vs 실행 시 ReferenceError, `assertNoBacktick` |
| P0 | `느린 의존은 죽은 의존보다 위험하다` / `payment-timeout-postmortem` | 결제 클라이언트에 타임아웃이 없어 보상 로직에 닿기 전에 스레드가 묶이던 문제, 409를 503으로 바로잡은 이유 | hang 서버 재현, 5초 후 503 problem+json |
| P1 | `pg_dump 클라이언트 버전이 서버보다 낮았던 문제` / `postgres-backup-version-mismatch` | PostgreSQL 18 서버와 구버전 client mismatch를 발견하고 고친 과정 | failed command, `postgres:18-alpine`, restore success |
| P1 | `GHCR image pull이 실패했을 때 먼저 볼 것` / `ghcr-pull-diagnosis` | Secret, image name, tag, Pod event를 어떤 순서로 확인할지 정리 | Kubernetes event, pull secret, rollout |
| P1 | `OAuth callback이 http로 만들어진 이유` / `oauth-forwarded-origin-postmortem` | reverse proxy forwarded header와 public origin 설정의 차이 | redirect URL, deployed env, smoke |
| P1 | `Cloudflare Tunnel 설정 위치를 잘못 짚은 문제` / `tunnel-dashboard-vs-config-postmortem` | dashboard와 locally configured tunnel의 관리 경계 | config path, validation, restart |
| P1 | `OpenSearch nori는 기본 이미지에 없었다` / `opensearch-nori-postmortem` | plugin 포함 custom image가 필요했던 이유 | Dockerfile, deployed image, query |
| P2 | `runner가 두 번 실행되던 문제` / `runner-service-conflict-postmortem` | nohup과 systemd runner 중복을 제거한 사례 | service status, runner registration |

## 운영·검증 > 보안

보안 탭은 도구 이름을 나열하지 않는다. 외부 입력이 어느 경계에서 신뢰되지 않는지, 권한이 UI가 아니라 서버에서 어떻게
검증되는지, 어떤 회귀 테스트가 있는지를 설명한다.

| 상태 | 제목 / 권장 slug | 핵심 내용 | 기반 문서 또는 증거 |
|---|---|---|---|
| 공개됨 | `Markdown XSS와 관리자 편집 경계를 막은 방법` / `markdown-security-and-admin-edit-boundary` | raw HTML escape, allowlist sanitize, strict Mermaid와 ADMIN Server Action 재검증 | `web/src/lib/markdown.ts`, `web/src/lib/actions.ts`, Vitest |
| P1 | `공개 웹의 CSP와 외부 자산 정책` / `content-security-policy-and-assets` | same-origin MinIO 자산, 외부 이미지, CSP header를 어떤 기준으로 허용할지 결정 | 운영 header, CSP report, asset route |
| P1 | `OAuth 세션과 CSRF 경계 점검` / `oauth-session-csrf-review` | same-origin 쿠키, 로그인 만료, Server Action과 mutation endpoint의 CSRF 정책을 점검 | production browser test, cookie attributes, threat model |
| P2 | `의존성 취약점 대응 기록` / `dependency-vulnerability-response` | lockfile audit와 patch 기준을 운영 기록으로 남긴다 | audit 결과, upgrade PR, regression test |

## 개발 과정·확장 > 로드맵

로드맵은 희망 목록이 아니라 완료 조건과 보류 이유를 포함한 약속이다. 완료된 항목은 운영 글 또는 회고로 이동하고, 이 탭에는 앞으로 검증할 일만 남긴다.

## 운영·검증 > 운영 검증

운영 검증 탭은 기능 설명이 아니라 실제 실행 증거를 모은다. 완료 사실만 발행하고, 아직 실행하지 않은
Ready-but-broken 이미지 rollback, R2 restore, 실제 OAuth 로그인은 이 탭에 완료 글로 넣지 않는다.

| 상태 | 글 | 근거 |
|---|---|---|
| 공개됨 | `기준 콘텐츠를 운영 DB와 rollout까지 맞춘 기록` | backup, dry-run, upsert, SHA rollout, public smoke |
| 공개됨 | `백업 파일을 검증 가능한 운영 artifact로 남긴 방법` | dump, sha256, pg_restore, 임시 DB restore 기준 |
| 공개됨 | `배송 실패 요청 하나를 trace와 Service Graph로 확인한 기록` | Saga 보상, Tempo, Prometheus service graph |
| 공개됨 | `운영 favicon과 MinIO 기술 로고를 복구한 기록` | Docker public, MinIO upload Job, public asset HTTP 200 |
| 공개됨 | `문서 탐색과 반응형 읽기 기준을 실제 화면에서 확인한 기록` | 딥링크, 390/768/1280 QA, Mermaid 내부 overflow |
| 공개됨 | `없는 이미지로 배포를 깨뜨렸지만, 옛 파드 둘은 66번의 요청을 모두 받았다` | 잘못된 이미지 배포, 기존 SHA 복구 9초, public smoke 66회 성공 |
| 보류 | `R2 외부 복원 리허설 기록` | R2는 결제 수단 등록을 피하기 위해 보류. 개발 머신 사본 복원 리허설로 대체 |

| 상태 | 제목 / 권장 slug | 핵심 내용 | 완료 조건 |
|---|---|---|---|
| 공개됨 | `콘텐츠 이식 이후 로드맵` / `roadmap-after-content` | 문서화, 시나리오 링크, R2, 재부팅 리허설을 정리 | 각 항목이 운영 글 또는 회고로 전환됨 |
| P0 | `R2 외부 백업 Phase B 실행 계획` / `r2-backup-phase-b-plan` | 복제 대상, 암호화·보존·비용·restore rehearsal 범위를 결정 | R2에 복제 후 외부에서 restore 성공 |
| P1 | `배포 rollback rehearsal 계획` / `rollback-rehearsal-plan` | SHA 태그 선택, 배포 전 이미지 캡처와 복구 기준, public smoke 확인을 정한다. | 실제 rollback과 forward deploy 기록 |
| P1 | `재부팅 복구 리허설 계획` / `reboot-recovery-plan` | 예상 다운타임, 확인 순서, 실패 시 수동 조치 목록 | 1회 이상 실제 drill 완료 |
| P2 | `콘텐츠 운영 규칙` / `documentation-maintenance-policy` | release, incident, drill 뒤 어떤 글을 갱신할지 정한다. | release/incident마다 최신 문서 반영 |

---

## 글 작성 템플릿

### 운영 기록과 회고

```md
# 제목

## 왜 이 작업이 필요했나

## 선택한 구조와 제외한 선택지

## 실제로 실행한 변경

## 검증 증거

## 막힌 지점과 복구

## 현재 기준과 다음 단계
```

### 시연 설명

```md
# 제목

## 이 시나리오가 설명하는 문제

## 정상 흐름

## 실패를 만드는 방법

## 화면에서 확인할 상태와 지표

## 실제 운영에서 이 패턴을 쓸 때의 주의점
```

### 문서별 필수 메타데이터

| 항목 | 규칙 |
|---|---|
| 날짜 | 실행 또는 검증한 날짜를 적는다. |
| 환경 | local, miniPC k3s, production 중 어디인지 명시한다. |
| 증거 | commit SHA, image SHA, run URL, trace ID, metric, command 결과 중 최소 하나를 남긴다. |
| 상태 | 완료, 현재 운영 중, NEXT, 보류를 구분한다. |
| 링크 | 관련 실행 화면과 선행·후속 글을 연결한다. |

## 편집 규칙

- 일반적인 기술 정의로 시작하지 않는다. 이 프로젝트에서 왜 필요했는지부터 쓴다.
- 코드 블록은 맥락을 설명하는 데 필요한 만큼만 둔다. 긴 매니페스트 전체는 파일 경로와 commit으로 연결한다.
- Mermaid는 한 그림에 노드 12개를 넘기지 않는다. 복잡한 구조는 흐름별로 나눈다.
- 스크린샷은 장식이 아니라 증거다. 어떤 상태를 보여주는지 캡션을 붙인다.
- `NEXT` 또는 `보류` 항목은 구현된 것처럼 표현하지 않는다.
- 같은 사건을 여러 탭에 중복해 길게 쓰지 않는다. 인프라·운영·회고 중 하나를 원문으로 정하고 나머지는 링크한다.

## 첫 편집 배치

다음 여섯 편을 먼저 쓰면, 구축 과정과 현재 운영 역량을 가장 빠르게 증명할 수 있다.

1. `release-record-1`
2. `postgres-restore-drill-1`
3. `saga-trace-investigation-1`
4. `kafka-dlq-rehearsal`
5. `minipc-reboot-recovery-drill`
6. `search-comparison-results`

`postgres-restore-drill-1`은 이제 `scripts/rehearse-postgres-restore.sh`를 한 번 돌리면 필요한 증거가 전부 나온다.
dump 파일명, sha256 검증 결과, 복원 소요 시간, 테이블별 row count를 그대로 옮겨 적으면 된다.

이후에는 각 실제 release, incident, drill이 끝날 때 관련 탭의 글 하나를 갱신하거나 회고 한 편을 추가한다. 이렇게 하면 문서가 기능 목록이 아니라 운영 이력으로 자란다.
