# jay-wiki 현재 프로젝트 상태

기준일: 2026-09-07

이 문서는 2026-09-07 시점의 상태 기록이다. 현재 공개 소스·비공개 운영 배포 절차는 [배포 안내](./deploy-runbook.md)를 우선한다.

자세한 구축 과정은 `archive/진행상황.md`(추적 안 함), 단계별 구현은 `archive/workbook/README.md`(추적 안 함), 앞으로 공개할 글은 [wiki-editorial-plan.md](./wiki-editorial-plan.md), 외부 진입점은 [README.md](../README.md)를 본다.

## 2026-09-07 현재 운영 기준

**운영에 반영된 마지막 커밋은 `6a1304d`(2026-09-04)다.** `develop`에 커밋 여섯 편이 배포 대기 중이고,
그중 위키 글 한 편은 이미지 16장이 `web/public/`에 있어 배포해야 화면에 뜬다.

| 무엇 | 현재 값 |
|---|---:|
| 위키 (시드·export·로컬 DB 일치) | **89편 / 11탭** |
| 블로그 (운영 DB) | **63편** |
| 시나리오 | 23편 (실제 인프라가 도는 것은 **9편**) |

검증 기준선은 다음과 같다. **시드를 고쳤으면 아래 넷에 시드 검사 넷을 더 돌린다** —
`--dry-run`, 시드 실행, `check-wiki-consistency.mjs --seed-only`, `export-portfolio-wiki.mjs`.
export를 빠뜨리면 CI가 `git diff`로 잡는다.

| 무엇 | 개수 |
|---|---:|
| Spring 테스트 | 279 |
| web 테스트 | 139 |
| payment-api | 17 |
| shipping-api | 14 |
| lint 경고 | 정확히 7 (`--max-warnings 7`) |

lint 경고 7건은 전부 `react-hooks/set-state-in-effect` 하나다. 화면 다섯 개의 데이터 로딩 효과를
재구성해야 없앨 수 있는데 그 화면들은 vitest가 회귀를 못 잡으므로, 줄이는 것보다 상한선으로
새 경고를 막는 쪽을 택했다.

### 2026-08-21 이후에 바뀐 축

| 무엇 | 상태 | 정본 |
|---|---|---|
| **블로그 발행이 배포에서 떨어졌다** | 2026-09-02부터 `ssh miniPC`로 클러스터 안의 내부 문을 쓴다. GitHub Actions도 TOTP도 안 지나고 몇 초 걸린다. 양방향은 `blog-sync.mjs`, 한 편은 `publish-blog-post.mjs` | `scripts/blog-sync.mjs`, `scripts/publish-blog-post.mjs` |
| **블로그 그림이 MinIO로 갔다** | 초안이 참조하는 그림을 발행 스크립트가 운영 MinIO에 올리고 원본은 `posts/jay-blog/assets/`에 남긴다. `web/public`이 아니라 컨테이너에 안 구워지므로 그림 한 장 때문에 배포를 부르지 않는다 | `docs/blog-writing-guide.md`의 「이미지」 |
| **당시 커밋한 초안의 발행 방식** | 당시에는 배포가 초안을 자동 발행할 수 있었다. 공개 소스와 운영 배포를 분리한 뒤에는 비공개 운영 저장소의 명시적 배포 선택에 따른다 | [배포 안내](./deploy-runbook.md) |
| **운영 DB에 도구로 붙는 길이 생겼다** | miniPC를 tailnet에 넣고 Beekeeper Studio의 SSH 터널을 Tailscale 주소로 건다. Beekeeper가 `ProxyCommand`를 지원하지 않아 Cloudflare 터널을 못 타는 것이 유일한 이유다 | 이 문서의 「운영 DB 접근」 |
| **위키 편수** | 86편 → **89편**. 탭 구조(11개)는 그대로다 | `scripts/seed-portfolio-wiki.mjs` |

### 운영 DB 접근 (2026-09-07)

Beekeeper Studio에서 SSH 터널을 켜고 다음 값으로 붙는다. 두 주소가 **다른 계층**이라는 점만 주의한다.
`Host`는 터널을 통과한 뒤 찾아갈 DB 주소이고, `SSH Hostname`은 터널이 들어갈 문의 주소다.

| 칸 | 값 |
|---|---|
| Host | `10.43.202.14` (`pg-postgresql`) / `10.43.55.36` (`pg-services`) |
| Port · Database · User | `5432` · `portfolio` · `postgres` |
| SSH Hostname | miniPC의 Tailscale 주소 (`100.x`). 집에서는 `192.168.0.82`도 된다 |
| SSH User · Key | `jaymunsh` · `~/.ssh/id_ed25519_minipc` |

`kubectl port-forward`는 필요 없다. miniPC 호스트에서 ClusterIP로 kube-proxy DNAT를 통해 직접 닿는다.
비밀번호는 `kubectl -n data get secret pg-postgresql`에서 꺼낸다. 스키마는 `public` 하나다 —
로컬 초기화 스크립트의 `batch` 스키마는 도커 최초 기동 때만 만들어지므로 운영에는 없다.

## 2026-08-21 운영 기준 (역사 기록)

2026-08-21 배포 커밋 `d2c2b4d`가 운영에 반영됐다. 운영·시드·export·로컬 PostgreSQL은 위키
86편·11개 탭으로 일치하며, `node scripts/check-wiki-consistency.mjs`와
`node scripts/check-content-sync.mjs --fast`를 통과했다. 블로그는 20편이다.

검증 기준선은 Spring 246개 테스트, web 125개 테스트, TypeScript 통과, lint 경고 7개
(`--max-warnings 7`)이다. 이번 변경으로 production build 뒤 공개 딥링크·본문·CSS/JS 자산·
모바일 가로 overflow를 확인하는 Playwright 스모크를 PR CI와 배포 후 workflow에 연결했다.

## 2026-08-02 이후에 달라진 것

아래 본문은 대부분 07-21~08-02 기준으로 쓰였다. 그 뒤 여드레에 바뀐 축은 넷이다.

| 무엇 | 상태 | 정본 |
|---|---|---|
| **블로그가 생겼다** | `blog.leneu.cloud`. 같은 앱·같은 이미지에서 `middleware.ts` 가 host 로 가른다. 운영 20편 | `web/src/app/blog/**`, 정본 본문은 운영 DB |
| **재부팅 복구 리허설 2회 완료** | 2회차 다운타임 60초, 수동 조치 없음. 관문을 통과해 **무인 자동 재부팅을 켰다**(04:00) | `docs/minipc-reboot-drill-runbook.md` |
| **문서 정렬 계약이 다시 뒤집혔다** | `start` 탭만 읽기 순서, 나머지는 `updatedAt` 내림차순. 아래 08-02 절의 서술은 낡았다 | `WikiArticleRepository.findForTab` |
| **저장소를 정리했다** | 안 쓰는 문서는 `archive/`(추적 안 함), 글 원고는 `posts/{jay-wiki,jay-blog}`, `spring/jaywiki` → `spring/` | `README.md` 의 「저장소 구성」 |

검증 기준선도 바뀌었다 — **당시 Spring 246개 / web 125개 / lint 경고 7개**(`--max-warnings 7`) / `tsc` 통과.
아래 본문에 남은 78개·9개 같은 수는 그때의 값이다. **현재 값은 이 문서 맨 앞의 「2026-09-07 현재 운영 기준」에 있다.**

## 한 줄 요약

jay-wiki는 miniPC 한 대의 k3s에서 운영되는 풀스택 위키·시연 사이트다. 위키·검색·게시판·Redis 채팅·Saga·Kafka·관측·CI/CD·백업 리허설까지 구현했고, 현재 운영 콘텐츠는 4개 대분류와 11개 문서 탭, 89편이다. 블로그는 `blog.leneu.cloud`에 63편이다.

## 현재 구조

```text
Browser
  → Cloudflare Tunnel / Traefik
  → Next.js web + BFF
  → Spring Boot jaywiki
  → PostgreSQL · Redis · Kafka · OpenSearch · MinIO

Spring Boot ↔ FastAPI payment-api
            ↔ partner-simulator

관측 셋은 각자 다른 길로 간다 (한 화살표로 묶지 않는다)
  추적  앱 → OTel Collector → Tempo   (Collector 파이프라인은 traces 하나뿐)
  지표  Prometheus 가 직접 scrape
  로그  promtail → Loki
                              → 셋 다 Grafana

git push → GitHub Actions → GHCR → miniPC self-hosted runner
  → kubectl rollout → PostgreSQL backup → internal content sync Job → public smoke test
```

외부 공개 경로는 Next.js web 중심으로 유지하고, Spring API와 데이터 서비스는 k3s 내부 Service DNS로만 연결한다.

## 구현 완료

> 2026-07-14 운영 기준: Google Authenticator TOTP secret을 miniPC Kubernetes Secret에 등록했다. 비밀번호 단독 차단, 실제 OTP ADMIN 로그인·JWT 발급, OTP 재사용 거부를 운영 API에서 확인했다. HPA는 60% 기준에서 rollout 부하로 `1→2` 실제 확장을 확인한 뒤, 최근 6시간 CPU 평균 `26m`·p95 `73m`·최대 `518m`를 근거로 평시 과민 확장을 줄이는 80% 기준으로 조정했다.

> 로컬 Next.js는 `HPA_REHEARSAL_REMOTE_URL`을 통해 miniPC의 공개 HPA snapshot을 읽는다. 원격 응답의 제어 권한은 항상 제거하므로 로컬은 읽기 전용이고, 운영 사이트의 OTP 인증 ADMIN만 고정 부하 Job을 실행한다.

| 영역 | 현재 구현 | 대표 확인 방법 |
|---|---|---|
| 위키 | PostgreSQL 본문 SoT, 탭, revision, 관리자 편집·되돌리기 | 문서 수정 후 version/revision 조회 |
| 게시판 | 10만 건 시드, 페이징, 익명/USER 작성, 댓글, Redis 조회수 | `/board`, `/board/search` |
| 검색 | 게시판 LIKE·tsvector·OpenSearch 비교, 위키 OpenSearch+nori 우선 검색과 PostgreSQL fallback, 자동완성·highlight | `/board/search`, `/search`, `X-Search-Engine` |
| 인증 | 관리자 비밀번호 + TOTP, httpOnly JWT, role별 화면 경계. 소셜 로그인은 제거했다(개인정보 처리 부담) | `/api/bff/auth/me`의 `adminTotpEnabled` |
| Redis 시연 | WebSocket 랜덤채팅, 방 정원, ZSET 대기열, 자동 승격 | `/chat`, members/queue/events view |
| Saga | Spring orchestrator와 FastAPI payment-api, 실패 주입과 보상 | `/saga/order` 배송 실패 시나리오 |
| Kafka | Outbox, fan-out, retry, DLQ, consumer 결과 화면 | `/kafka/order` |
| 도메인 리허설 | 상품권·주문 상태 전이, 외부 API 장애, 트래픽 제어, 쿠폰 동시성, 정산 재실행, Connection Pool 고갈, JPA N+1 정책 비교 | `/scenarios/[id]`, PostgreSQL HTTP·시도·단계·RPS·p95·lag·복구 이력 |
| 관측 | Prometheus, Grafana, Alertmanager, Loki, Tempo, OTel Collector | metric, log, trace, Service Graph |
| 운영 | GitHub Actions, GHCR, miniPC self-hosted runner, PostgreSQL backup CronJob, 제한된 GitOps 위키 동기화 | deploy workflow, rollout, content sync Job, restore rehearsal |
| 운영 제어 | backend HPA scale-out, 관리자 서비스 제어판 | HPA 1→2, OpenSearch 0→1→0 |
| 포트폴리오 UX | 23편 실무 사례 허브, k3s 중심 오케스트레이션 맵, 영역별 상세 책임 | 홈의 프로젝트 맵과 `/scenarios` |
| 배포 안전망 | application 이미지 롤백과 ImagePullBackOff 경로를 운영에서 검증. 잘못되지만 Ready인 이미지 경로는 남음 | capture/rollback 스크립트, OpenSearch deploy 스크립트, deploy workflow |

## 검증 기록

아래 항목은 코드만 있는 계획이 아니라, 문서 또는 Git 이력에 실행·운영 검증이 남아 있는 기능이다.

| 검증 축 | 확인된 사실 | 근거 |
|---|---|---|
| miniPC 배포 | 공개 홈과 BFF smoke, backend/frontend k3s 배포를 확인 | 공개 운영 기록과 `7fab22d` |
| CI/CD | public 저장소는 GHCR SHA 이미지를 만들고, private ops가 miniPC 배포를 담당 | [.github/workflows/release.yml](../.github/workflows/release.yml), [배포 경계](deployment-security-boundary.md) |
| 브라우저 회귀 | production build 기준 딥링크·본문·CSS/JS 자산·desktop/mobile overflow를 Playwright로 확인하고 PR CI와 배포 후 job에 연결 | `web/tests/browser/public-surface.spec.ts`, `.github/workflows/ci.yml` |
| 기준 콘텐츠 배포 | 관리자 TOTP와 분리한 내부 upsert, 사전 backup, Git SHA revision 주체와 no-op 동기화 경로 구성 | [GitOps 콘텐츠 동기화 runbook](./gitops-wiki-content-sync-runbook.md) |
| PostgreSQL 복구 | backup CronJob, sha256, `pg_restore --list`, 임시 DB restore 리허설을 기록 | [복구 문서](../posts/jay-wiki/03-data/postgres-restore-drill-1.md) |
| 관측과 알림 | Prometheus/Grafana/Alertmanager, backend down 및 Telegram 복구 알림을 확인 | `26d386d` |
| trace | Spring Saga와 FastAPI payment-api가 같은 Tempo trace로 연결됨 | `5fd910d` |
| Kafka | 정상, 재시도, DLQ와 Kafka metric·alert를 운영 환경에서 확인 | `8c597e5`, `416254d`, `822bb06` |
| Redis 채팅 | 공개 WebSocket, 정원 3명, 대기열·자동 승격을 smoke로 확인 | `c992c09` |
| OAuth | Google start/callback URL과 secure cookie 조건을 운영 smoke로 확인 | `a9762fe`, `5882a4c` |
| 재부팅 복구 | k3s, cloudflared, runner, StatefulSet, public HTTP가 재부팅 뒤 회복됨 | [재부팅 복구 문서](../posts/jay-wiki/01-infra/minipc-reboot-recovery-drill.md) |
| 결제 타임아웃 | 응답 없는 payment-api에 5초 read timeout이 걸리고 503 problem+json 반환 | 로컬에서 hang 서버로 재현, `PaymentClient` |
| 시드 스크립트 | 11개 DB 탭 86편 기준, 무변경 재실행은 version·updatedAt 유지 | `check-wiki-consistency.mjs`, `check-content-sync.mjs --fast` |

## 2026-07-10에 정리한 사용자 경험

- 홈을 프로젝트 허브로 다듬고, 시나리오·문서·운영 기록의 진입점을 연결했다.
- 이벤트 트래픽 폭주 시나리오에서 직접 처리·rate limit·Kafka buffer·느린 Consumer·중복 제거·backlog 복구를 동일한 고정 입력으로 비교한다. 현재 수치는 miniPC 부하 실측이 아닌 결정론적 정책 모델이며 실제 성능 증거는 격리된 k6·Prometheus·Kafka 지표 연동 이후로 구분한다.
- 쿠폰 경합, 정산 배치 재실행, Connection Pool 고갈, JPA N+1을 각각 네 가지 정책 모드로 비교한다. 실행과 단계는 PostgreSQL에 남지만 현재 수치는 정책 모델이며, 실제 동시성·원장·HikariCP·Hibernate benchmark와 구분한다.
- `/scenarios`는 `실무 사례` 허브다. 거래·정합성, 분산 처리·외부 연동, 성능·데이터, 인프라·복구,
  운영 도구·거버넌스의 다섯 영역에서 실행형 리허설과 익명화된 경력 사례를 함께 탐색한다.
- 운영 데이터 정정, 개인정보 마스킹·파기, 대용량 Excel, 반복 업무 통계, 알림 재처리와 점검 공지는
  실패 방식과 개선 정책을 선택해 실행하는 결정론적 리허설이다. 결과와 3~4개 처리 단계는 PostgreSQL에 남지만 실제 운영 DB,
  개인정보, Excel benchmark나 알림 provider를 호출하지 않는다.
- Excel 사례는 예외적으로 검색 비교에 사용하는 `tb_post` 10만 건을 PostgreSQL fetch size 2,000과 Apache POI
  `SXSSFWorkbook` row window 500으로 실제 `.xlsx` 파일로 생성한다. 관리자만 실행할 수 있고 동시 생성은 1건으로 제한한다.
  로컬 검증 파일은 100,001행(헤더 포함), 3.7MB였으며 본문과 password hash를 export하지 않았다.
- 상품 이미지 업로드 사례는 12MB·6000×4000 JPEG 고정 입력으로 무제한 저장, 사전 거절, 동기 최적화와 비동기
  처리 상태를 비교한다. 현재는 실제 decoder나 MinIO write를 호출하지 않는 정책 모델이며, 실제 구현 증거는 decode sandbox,
  worker 자원 제한, variant와 원본 lifecycle 검증을 추가한 뒤 별도로 표시한다.
- 시나리오 탐색은 허브에서 최종 실행·종합 화면으로 한 번만 이동한다. 도메인 리허설은 `/scenarios/[id]`에 통합했고, Saga·Kafka·채팅·검색·모니터링은 기존 실행 화면에 사례 설명을 포함하며, 과거 `/domain-scenarios/*` 주소는 canonical 시나리오로 redirect한다.
- 기술 스택을 단순 나열하지 않고 `Public edge → k3s → workload/data/observability → delivery` 흐름으로 표현했다.
- 오케스트레이션 맵은 영역 선택 시 실제 데이터 흐름과 구성요소 책임을 보여준다.
- MinIO 버킷의 기술 로고를 same-origin asset route로 제공하고, 자산을 불러오지 못해도 텍스트 라벨은 남긴다.
- 1280px, 768px, 390px에서 오케스트레이션 맵의 라벨, 흐름, 선택 상세를 점검했다.
- 4개 대분류와 11개 DB 탭에 공개할 글의 현재 항목·작성 후보·보류 항목을 편집 계획으로 정리했다.

## 2026-07-12 로컬 공개 운영 요약

- `/monitoring`은 Prometheus aggregate만 읽는 `LIVE OPERATIONS` 패널을 제공한다. traffic(최근 30분 plot, 요청률, 5xx, p95),
  event flow(Kafka 소비/DLQ, Saga), runtime(Spring API, Pod, node CPU/메모리)를 보이며 15초 간격으로 갱신한다.
- 외부에는 raw query·metric label·Grafana session을 노출하지 않는다. Grafana는 Cloudflare Access와 Grafana 로그인으로 보호된
  별도 화면을 유지한다.
- 로컬에서는 Prometheus를 띄우지 않으므로 기본 패널은 `unavailable` 상태가 정상이다. 필요할 때만 로컬 `.env.local`에
  `OPERATIONS_REMOTE_URL=https://portfolio.leneu.cloud/api/operations`을 설정해 운영의 공개 aggregate API를 서버 측에서 읽을 수 있다.
  추적되는 예시는 `web/operations.remote.env.example`에 둔다.
  이 경우 화면은 `REMOTE · miniPC LIVE`로 출처를 구분하며, Prometheus 주소·label·로그·trace는 여전히 브라우저로 전달하지 않는다.
  운영 k3s Deployment env와 서버 route는 구현됐고, 2026-08-21 production rollout 뒤 공개 aggregate 경로를 확인했다.
- 홈 대시보드는 오케스트레이션 맵과 위키 탐색에 집중한다. `LIVE OPERATIONS`는 전용 `/monitoring` 페이지에서 기본 펼침으로
  제공하며, 접기 제어는 두지 않는다. Grafana의 Metrics, Loki Logs, Tempo Traces는 이 페이지의 별도 외부 링크로 연다.
  source 상태·갱신 시각은 패널 안에 둔다. iframe으로 원본 로그·trace를 공개 화면에 삽입하지 않는다.
- 전용 페이지에는 `Traffic → Event flow → Runtime` 순서의 짧은 읽기 가이드를 둔다. 별도 용어집은 탐색 구조를 늘리고
  본문 설명과 중복돼 제거했으며, 필요한 개념은 각 지표와 관련 문서의 문맥에서 설명한다.
- 공개 집계에는 miniPC `Node Ready`, CPU·메모리·루트 디스크 사용량과 PostgreSQL backup CronJob의 마지막 성공 시각도 포함한다.
  각각 node exporter와 kube-state-metrics에서 읽고, 5xx가 전혀 없을 때도 PromQL이 `0`을 반환하게 해 `--`와 구분한다.
  배포 SHA, 서비스별 Ready, restore 검증처럼 아직 고정 수집 경로가 없는 값은 공개 화면에 넣지 않는다.

관련 커밋: `e723790`, `255f7db`, `1bb2811`, `8fbdb8c`, `356eae9`, `05f1014`, `d005f29`.

## 2026-07-10 코드·문서 정비

검증 과정에서 드러난 결함을 고쳤다. 기능 추가는 없다.

| 영역 | 무엇을 고쳤나 | 왜 |
|---|---|---|
| Saga | `PaymentClient`에 connect 2초, read 5초 타임아웃 | 결제 서비스가 느려지면 요청 스레드가 무한 대기했다 |
| 예외 | 결제 서비스 장애를 409가 아닌 503으로 매핑, 범용 `Exception` 핸들러 추가 | 인프라 장애가 비즈니스 충돌로 보였고, 미처리 예외는 problem+json이 아니었다 |
| BFF | upstream 연결 실패를 502 problem+json으로 감쌈 | 백엔드가 죽으면 브라우저에 미처리 500이 그대로 나갔다 |
| 시드 | `String.raw` 본문의 백틱 제거, `assertNoBacktick` 검사 추가 | **시드 스크립트가 `ReferenceError`로 아예 실행되지 않고 있었다** |
| 위키 | 기존 15편을 갱신하고 인프라·백엔드·데이터 12편을 추가 | 구축 과정과 현재 코드·매니페스트 근거가 탭별로 비어 있었다 |
| 부트스트랩 | `MarkdownSyncRunner` 제거, `web/docs`를 아카이브로 이동 | 빈 DB에 편집 계획에 없는 글 2편(`intro`, `redis`)이 생겼다 |
| 인프라 | `00-namespaces.yaml`에 `data`, `obs` 추가 | 클린 클러스터에서 파이프라인이 실패했다 |
| 인프라 | PostgreSQL·Redis·MinIO Helm values를 `infra/k8s/data/`로 편입 | miniPC 홈 디렉터리에만 있어 재현이 불가능했다 |
| CI/CD | 배포 전 이미지 캡처와 실패 복구 경로, 잡별 `timeout-minutes`, 웹 lint·test 단계 | revision 기반 rollback은 중간 `:local` revision을 가리킬 수 있어 실제 이미지 기준으로 변경 |
| 백업 | `scripts/rehearse-postgres-restore.sh` 추가 | 복원 절차가 문서에만 있었다 |
| 웹 | ESLint flat config 신설, 백엔드 base URL 단일화, 시나리오 데이터 분리(440→167줄) | lint 스크립트가 설정 파일 없이 동작하지 않았다 |
| 로컬 | docker-compose PostgreSQL 16 → 18, 마운트 지점을 `/var/lib/postgresql`로 | 운영은 18.4인데 "동일 메이저"라고 적혀 있었고, pg18은 마운트 규칙이 바뀌었다 |
| 문서 | 루트 `README.md`·`infra/README.md` 신설, 구문서 `docs/archive/`로 이동 | 외부 진입점이 없었고 SoT를 자칭하는 문서가 셋이었다 |

### 검증 방법

- Spring 테스트 전체 통과. 로컬 PostgreSQL 18 + Spring 기동 후 시드 2회 실행(중복 없음).
- 응답하지 않는 가짜 결제 서버를 세워 요청이 정확히 5초에 503으로 끊기는지 확인.
- 웹 `lint`(0 errors), `type-check`, `build` 통과.

## 2026-07-11 안전한 편집·동기화 경계 보강

| 영역 | 변경 | 확인 |
|---|---|---|
| 관리자 편집 | Next Server Action에서 ADMIN 세션을 확인하고 JWT 쿠키를 Spring 변경 요청에 전달 | 쿠키가 없던 기존 요청과 전달 후 요청을 회귀 테스트로 고정하고 CI에 웹 테스트 추가 |
| Markdown | raw HTML을 escape한 뒤 최종 HTML을 allowlist sanitize하고 Mermaid fenced block만 전용 렌더러로 전달 | img/onerror와 javascript/data 링크 회귀 테스트 |
| 문서 탐색 | 탭·문서 선택을 `?article=<slug>`와 동기화 | 공유, 새로고침, 브라우저 history의 선택 기준을 URL로 통일 |
| 콘텐츠 시드 | DB와 다른 탭·문서만 저장하고 `--dry-run`에서 변경·추가 잔존 문서를 보고 | 무변경 재실행 전후 version 7과 updatedAt이 동일 |
| 면접 기록 | `docs/interview/06-프로젝트-설명-가이드.md` 신설 | 구축 순서, 결정, 트레이드오프, 장애, 검증 증거를 한 문서로 연결 |
| 로컬 검증 서버 | IPv4 Python/IPv6 Next의 3000 포트 충돌 제거, production build로 단일화 | home과 CSS 200, production build 성공 |
| 모바일 문서 | 페이지 가로 overflow를 차단하고 Mermaid·탭·표의 overflow를 각 컴포넌트 내부로 제한 | 390px 페이지 폭과 다이어그램 스크롤 경계 |
| 프론트 탐색 | URL을 문서 선택의 계약으로 두고, stale fetch가 최신 선택을 덮지 못하게 처리 | 딥링크, 연속 선택, 활성 탭의 브라우저 QA |
| 보안 문서화 | 8. 보안 탭과 프론트·보안 개선 기록을 추가 | Markdown XSS, Mermaid strict renderer, 관리자 Server Action 경계를 독립 문서로 설명 |

이 문단은 운영 반영 전의 기준을 보존한 역사 기록이다. 현재는 2026-08-21 배포에서 backup,
dry-run diff, 레거시 문서 보존 정책, 전체 CI와 public smoke를 순서대로 수행했다.

당시 로컬 검증은 웹 Vitest 6개, TypeScript, lint(0 errors), production build, Spring 전체 테스트를 통과했다.
production server는 동일 문서 요청 30회와 CSS 요청에 모두 200을 반환했다. CDP 기준 390px document/body는
`390/390`, Mermaid는 `314px` 컨테이너 안에서 `716px` 콘텐츠를 내부 스크롤하며 페이지 가로 overflow는 없다.
768px와 1280px도 page scrollWidth와 clientWidth가 일치했고 딥링크·활성 탭·한글·타임스탬프를 확인했다.

### 2026-07-11 운영 반영 완료

`main`의 `0e3cd19`를 대상으로 GitHub Actions `Build and deploy` workflow를 실행해 miniPC self-hosted runner에서
backend, payment-api, web 이미지를 GHCR SHA 태그로 rollout했다. `jaywiki`는 2/2, `jaywiki-payment-api`와
`jaywiki-web`은 각각 1/1 Ready를 확인했다.

PostgreSQL backup 뒤 운영 BFF에 기준 10개 탭·28편을 반영했다. 기존 backend image가 일부 문서의 `sortOrder`를
0으로 저장한 흔적이 있어 새 backend rollout 뒤 시드를 한 번 더 실행했고, 최종 dry-run은
`0 tab changes, 0 article changes, 17 extras`를 반환했다. extra 17편은 자동 삭제하지 않는 정책에 따라 보존했다.

공개 home, 보안 문서, 게시판 BFF, 채팅 상태 BFF는 모두 HTTP 200을 반환했다. push가 자동 deploy를 시작하지 않은
이유는 GitHub Actions run 조회 권한이 없어 확정하지 못했으며, 수동 실행은 정상적으로 runner까지 전달됐다.

### 남은 것

- 웹 lint는 0 errors, 7 warnings이며 effect 기반 fetch와 상태 파생 구조는 별도 재설계가 필요하다.
- 게시판 목록의 offset 페이징과 매 요청 `count(*)`, Saga `recent()`의 N+1(20건 × 5쿼리).
- Ready지만 기능이 깨진 이미지를 이용한 rollback 리허설과 Origin/CSRF 서버 측 검증은 아직 남아 있다.

## 현재 시드·로컬 문서

현재 시드 원본과 export·로컬 PostgreSQL에는 11개 DB 탭과 89편 위키 글이 일치한다.
**운영 DB는 86편이다** — 새 글 세 편이 `develop`에 있고 아직 배포되지 않았다.
4개 대분류 탐색 구조와 분리된 `운영·관측`·`운영 검증`·`개발 방식·AI`·`콘텐츠·품질` 탭을 사용한다.
시드는 DB에만 있는 글을 자동 삭제하지 않으므로, 이후에도 dry-run에서 extra가 나오면 사람이 보존·통합·삭제를 결정한다.
현재는 extra 없이 일치한다. 전체 목록과 다음 글 후보는 [wiki-editorial-plan.md](./wiki-editorial-plan.md)에 있다.

PostgreSQL은 실행 중인 최신 본문과 revision의 운영 SoT다. 시드 스크립트는 신규 환경 bootstrap과 검토된 기준 콘텐츠이며,
로컬에서는 `--dry-run` 검토 뒤 명시적으로 실행한다. 운영 GitOps 동기화는 배포 workflow에서 diff가 있는 upsert만 수행하고,
DB에만 있는 항목은 자동 삭제하지 않는다. 이 경로는 코드 구현과 로컬 E2E를 마쳤고, 2026-08-21 운영 배포에서 backup·upsert·public smoke 순서를 확인했다.

### 2026-08-02 문서 정렬 기준 변경과 `created_at` 도입 — **정렬 부분은 그 뒤 뒤집혔다**

> **아래 정렬 이야기를 그대로 믿지 않는다.** PR #17(`5009e3d`)이 다시 `updatedAt` 내림차순 우선으로
> 되돌렸고, 2026-08-10(`44b915d`)에 `start` 탭만 읽기 순서로 뺐다. 지금의 계약은 이렇다.
>
> | 탭 | 1차 정렬 |
> |---|---|
> | `start` | `sortOrder` 오름차순 (첫 화면이라 「한눈에 보기」가 항상 맨 위) |
> | 나머지 전부 | `updatedAt` 내림차순 |
>
> 정본은 `WikiArticleRepository.findForTab` 과 `READING_ORDER_TABS` 다. 호출부 셋이 전부
> `findForTab` 하나를 지난다. **배포가 시드를 돌리면 `updatedAt` 이 갱신되므로, 나머지 탭에서는
> 시드가 마지막에 건드린 순서가 화면 순서가 된다.**
>
> 아래 본문은 `created_at` 도입 경위 기록으로 남긴다. 정렬 관련 서술은 그때의 상태다.

탭 안의 문서 목록 정렬 기준을 바꿨다. 기존에는 `updated_at` 내림차순이라 글을 한 편 고칠 때마다 그 글이
카테고리 목록 맨 위로 올라갔고, 시드가 선언한 `sortOrder`(의도한 읽기 순서)는 동률일 때만 쓰이는 보조 기준이라
독자에게 사실상 보이지 않았다.

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| 정렬 메서드 | `findByParentIdOrderByUpdatedAtDescSortOrderAsc` | `findByParentIdOrderBySortOrderAscUpdatedAtDesc` |
| 1차 기준 | 최근 수정순 | `sortOrder` 오름차순(의도한 읽기 순서) |
| 2차 기준 | `sortOrder` | `updated_at` 내림차순 |

호출부는 `TabService`(2곳)와 `ArticleService`(1곳)다. `ArticleRevisionTest`의 옛 계약 테스트
`탭_문서는_마지막_수정_시각_내림차순으로_정렬한다`는 새 계약 테스트 두 개로 교체했다.

동시에 `V12__article_created_at.sql`로 `tb_article.created_at`을 추가했다. **정렬용이 아니라 "언제 쓴 글인지"
표시용**이다. 백필 값은 추정하지 않고 근거가 있는 것만 넣었다.

- 53편: 각 slug가 `scripts/seed-portfolio-wiki.mjs`에 처음 등장한 커밋 날짜(KST)
- 1편(Quantinue): 이 문서의 2026-08-01 추가 기록
- 근거가 없으면 `null`로 남긴다. `updated_at`으로 대신 채우지 않는다

`ArticleService`는 신규 생성 분기에서만 `createdAt`을 넣는다. 수정 시 채우면 기존 글의 작성일이
"마지막으로 고친 날"로 바뀌기 때문이다.

**현재 상태와 남은 절차**

| 단계 | 상태 |
|---|---|
| Spring 컴파일·테스트 | 통과 (246개) |
| 마이그레이션 SQL 검증 | 로컬 DB에서 rollback 트랜잭션으로 54/54 백필 확인 |
| 로컬 Spring 반영 | **완료.** 2026-08-02 08:54 KST 재기동 뒤 Flyway V12 적용 확인 |
| 로컬 화면 순서 확인 | **완료.** `/api/tabs`에서 `sortOrder` 우선 순서 확인 |
| 운영 배포 | **완료.** `d2c2b4d`가 2026-08-21 운영에 반영됐고 public smoke 및 콘텐츠 일치 검증을 통과 |

현재 `created_at`은 엔티티와 단건 응답에는 포함되지만 탭 목록용 `ArticleSummaryDto`와 사이드바에는 노출하지
않는다. 사이드바 시각은 계속 `updated_at`을 보여준다. 작성일을 화면에 표시하려면 DTO·프론트 계약을 별도
변경해야 하며, 이번 정렬 변경의 완료 조건에는 포함하지 않는다.

Flyway 버전 번호에 주의한다. `V10`과 `V11`은 이미 커밋돼 있어(`V10__partner_api_http_evidence.sql`,
`V11__traffic_burst_metrics.sql`) 새 마이그레이션은 `V12`로 붙였다. 마이그레이션을 추가할 때는
`ls | sort -V`로 실제 최대 번호를 확인한다. 사전순 `ls`는 `V9` 뒤에 `V10`이 오지 않아 잘못 읽기 쉽다.

| 탭 | 현재 글 수 | 주제 |
|---|---:|---|
| 대시보드 | 2 | 전체 지도와 프로젝트 선택 이유 |
| 인프라 | 9 | miniPC 하드웨어·용량 설계, k3s, Cloudflare Tunnel, 재부팅 복구, 매니페스트 경계 |
| 백엔드 | 11 | BFF, 인증 경계, Saga 계약, 오류 응답, 도메인 리허설 엔진 |
| 데이터 | 11 | PostgreSQL SoT, restore drill, 검색 비교, nori, MinIO, 스키마 ERD, 시드·revision 경계 |
| 프론트엔드 | 6 | 정보 구조, 문서 탐색 안정성, 반응형 읽기 기준 |
| 운영·관측 | 20 | CI/CD, backup/restore, GitOps 동기화, metrics·logs·traces, Grafana 화면 읽기 |
| 시나리오·시연 | 5 | Saga/Kafka, Redis chat, 검색 비교 |
| 보안 | 4 | Markdown XSS, 계정·Secret 최소 권한 |
| 운영 검증 | 10 | 운영 반영, backup, trace, asset, 반응형의 실제 확인 기록 |
| 개발 방식·AI | 6 | delivery loop, 가설 기반 디버깅, AI 에이전트 하네스, 증거 수준 경계 |
| 콘텐츠·품질 | 5 | 라이선스·출처, 문서·이미지 보존, 법적 경계, 회고 방식 |
| **합계** | **89** | |

이 표는 `node scripts/export-portfolio-wiki.mjs` 산물인 `posts/jay-wiki/` 의 디렉터리별 파일 수와 일치한다.

아래 연혁은 당시 수치를 보존한 기록이다. 2026-07-11에 이전 시드에서 남은 레거시 16편을 로컬 DB에서만 정리했다. 2026-07-15 기준 시드 원본과 로컬 조회 결과는
모두 39편으로 일치했다. 2026-07-17 donts3p 글을 추가해 로컬 DB를 시드 기준 40편에 맞췄다. 이미지 작성 규칙은
공개 문서 수에 포함하지 않고 관리자 `/admin/guide`에서 제공한다. 2026-07-18 mding 개발기를 추가해 시드 기준은 41편이다.
2026-07-20 공시톡톡 팀 프로젝트 회고를 추가해 시드 기준은 42편이 됐다. 이후 Jaycron, 도구 사용기, 로컬 LLM 실험,
MinIO·AI 운영 경계, GitOps·Secret 경계와 개발 프로세스 문서를 추가해 2026-07-21 로컬 기준 53편이 됐다.
2026-08-01 Quantinue 팀 프로젝트 글을 추가해 시드·로컬 DB 기준은 54편이 됐다.
2026-08-02 전체 DB 스키마 ERD 지도와 시드·revision 경계 글을 데이터 탭에 추가해 시드·로컬 DB 기준은 56편이다.
miniPC 운영 DB 반영은 GitOps 첫 배포에서 backup·diff·upsert·public smoke 순서로 검증한다.

## 미완료 또는 의도적으로 보류한 항목

| 항목 | 상태 | 다음 완료 조건 |
|---|---|---|
| Cloudflare R2 외부 백업 | **대체함 (2026-08-16)** | 백업 사본을 반영 시점마다 개발 머신으로 내보내는 쪽으로 갈음했다. R2는 결제 수단 등록이 필요해 보류하고, 스크립트가 목적지만 바꾸면 되게 두었다. `docs/2026-08-16-backup-completeness-design.md` |
| miniPC 운영 DB 레거시 문서 정리 | **완료** | 정본 없는 글을 정리하고 운영·시드·export를 86편·11개 탭으로 맞췄다 |
| ~~Google OAuth 사용자 로그인~~ | **제거함 (2026-08)** | 소셜 로그인을 붙이면 개인정보처리방침, 수집 항목 고지, 파기 절차가 따라온다. 포트폴리오가 질 부담이 아니라고 판단해 걷어냈다. 인증은 관리자 비밀번호 + TOTP만 남긴다 |
| 배포 rollback 리허설 | **워크플로 롤백 스텝(2026-08-16)과 `trap ... ERR` ImagePullBackOff 경로(2026-08-19)를 실제 검증** | Ready지만 기능이 깨진 이미지 경로는 `docs/rollback-rehearsal-plan.md` 후보 3번 |
| Spring Cloud Gateway | 보류 | 현재 Next.js BFF 경계를 대체할 실제 필요가 생길 때 비교 |
| Spring Batch | 보류 | 반복 배치 처리의 실제 요구가 생길 때 도입 판단 |
| 문서 정렬 변경과 `created_at` | 코드·테스트·로컬 V12 적용과 탭 순서 확인 완료 | **운영 배포 완료 (2026-08-21, `d2c2b4d`)** |
| 저장소 공개 여부 | 미결정 | `jaymunsh/jaycron`과 `jaymunsh/jay-wiki`가 PRIVATE. 공개하면 위키 2편의 제거된 링크를 되살린다 |
| 공개 자산 위치 기준 | 문서와 관행 불일치 정리 중 | 프로젝트 스크린샷은 `web/public`, 관리자 업로드 이미지는 MinIO assetId로 거버넌스 글에 명시 |

## 다음 작업

관리자 위키 이미지 업로드는 로컬 구현과 MinIO 통합 검증을 마쳤다. 로컬과 운영의 PostgreSQL·MinIO는 분리하며,
운영 전용 service account Secret과 bucket 제한 policy는 배포 경로에 구성했다. 실제 이미지는 관리자 화면에서 다시 등록하고,
운영에서 revision 참조·삭제 차단까지 재검증해야 한다. 본문에는 환경 독립적인
`/api/wiki-assets/{assetId}`만 저장하고 article/revision 참조 중인 객체 삭제는 차단한다.

### 콘텐츠 우선순위

1. `release-record-1`: 실제 GitHub Actions 실행 한 건을 SHA, rollout, smoke test까지 기록한다.
2. `postgres-restore-drill-1`: 백업 파일이 아니라 복원 결과와 소요 시간을 기록한다.
3. `saga-trace-investigation-1`: 배송 실패 요청을 Prometheus, Loki, Tempo에서 같은 흐름으로 찾는다.
4. `kafka-dlq-rehearsal`: retry와 DLQ를 의도적으로 만든 결과를 기록한다.
5. `minipc-reboot-recovery-drill`: 이미 수행한 재부팅 복구 리허설을 인프라 글로 정리한다.
6. `search-comparison-results`: 10만 건 비교의 실제 수치를 기록한다.

### 기능 우선순위

1. ~~R2 Phase B 외부 백업과 restore rehearsal~~ → 개발 머신 사본으로 갈음, 복원 리허설 완료 (2026-08-16)
2. ~~Google OAuth의 실제 사용자 로그인·작성자 저장 최종 확인~~ → 소셜 로그인 제거 (위 표 참고)
3. SHA 기반 rollback rehearsal — 워크플로 스텝 실패와 뜨지 않는 이미지의 `trap ... ERR` 경로는 검증했다. 남은 것은 Ready지만 기능이 깨진 이미지 경로

## 문서 역할 분리

| 문서 | 역할 |
|---|---|
| [wiki-editorial-plan.md](./wiki-editorial-plan.md) | 4개 대분류와 현재 11개 DB 탭에 공개할 글의 편집 백로그 |
| [wiki-article-review-and-improvement-playbook.md](./wiki-article-review-and-improvement-playbook.md) | 현재 89편(초기 54편 전수 검토에서 출발)을 카테고리별로 검증·개선하는 실행 가이드 |
| [interview/](./interview/) | 면접 준비 묶음. 설명 가이드·질문 색인·시나리오 23편 대본 |
| [frontend-security-improvement-log.md](./frontend-security-improvement-log.md) | 탐색 안정성, 반응형 UI, Markdown·관리자 보안 경계의 개선 기록 |
| [wiki-image-upload-implementation.md](./wiki-image-upload-implementation.md) | 위키 이미지 저장·프록시·revision 삭제 경계와 운영 전환 절차 |
| [gitops-wiki-content-sync-runbook.md](./gitops-wiki-content-sync-runbook.md) | 기준 콘텐츠의 내부 동기화, token 회전과 실패 대응 |
| [README.md](../README.md) | 외부 방문자를 위한 진입점 |
| [infra/README.md](../infra/README.md) | 매니페스트 구성과 설치 순서 |
| 이 문서 | 현재 상태, 검증된 기능, 보류, 다음 행동의 짧은 기준점 |

## 갱신 규칙

- 배포, 복구 리허설, 장애 회고, 새 시나리오를 마칠 때 이 문서의 `검증 기록`과 `다음 작업`을 갱신한다.
- 구현이 끝나지 않은 항목은 완료 목록으로 옮기지 않는다.
- 운영에 실제 반영된 상태와 로컬에서만 검증된 상태를 구분해 적는다.
- 긴 명령, 로그, 화면은 이 문서에 복사하지 않고 관련 runbook·회고·Git commit으로 연결한다.
