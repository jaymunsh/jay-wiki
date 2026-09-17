# jay-wiki

miniPC 한 대의 k3s에서 직접 운영하는 풀스택 위키·블로그·관리자·시연 사이트.

> 이 공개 저장소는 소스 검사와 GHCR 이미지 생성까지만 담당한다. miniPC 운영 배포는 별도
> private 운영 저장소에서 승인한 SHA로 실행한다. 절차는 [배포 안내](docs/deploy-runbook.md)에 있다.

| | 주소 | 라우트 |
|---|---|---|
| 위키 | **[portfolio.leneu.cloud](https://portfolio.leneu.cloud)** | `web/src/app/**` |
| 블로그 | **[blog.leneu.cloud](https://blog.leneu.cloud)** | `web/src/app/blog/**` |
| 관리자 | **[admin.leneu.cloud](https://admin.leneu.cloud)** | 공개 경로를 `web/src/app/admin/**`로 연결 |

한 앱이 `middleware.ts`에서 host를 보고 갈린다. 배포도 이미지도 하나다.

기술 이름을 나열하는 대신, 실행하고 관측하고 기록할 수 있는 운영 장면을 남기는 것이 목표다.
분산 트랜잭션은 실패를 주입해서 보상 흐름을 볼 수 있고, 검색은 같은 10만 건 코퍼스에서 세 방식을
나란히 비교할 수 있다. application 배포는 캡처 이미지로, OpenSearch는 Helm atomic upgrade로
복구하는 경로를 구현했다. 재부팅 복구는 리허설 2회를 마치고 무인 자동 재부팅까지 켰다.

## 구조

```text
Browser
  → Cloudflare Tunnel → Traefik
  → Next.js web (+ BFF)
  → Spring Boot jaywiki
  → PostgreSQL · Redis · Kafka · OpenSearch · MinIO

Spring Boot ↔ FastAPI payment-api          (Saga 결제 참여자)
            ↔ partner-simulator            (외부 HTTP 장애 재현)

관측은 셋이 각자 다른 길로 간다 (한 화살표로 묶이지 않는다)
  추적  앱 → OTel Collector → Tempo      (Collector의 파이프라인은 traces 하나뿐이다)
  지표  Prometheus 가 각 워크로드를 직접 scrape
  로그  promtail 이 노드에서 긁어 Loki 로
                                    → 셋 다 Grafana 에서 본다

public jay-wiki Actions → 검사·빌드 → GHCR에 SHA 이미지 보관
private ops 배포 버튼 → miniPC runner → k3s 반영 → smoke test → 실패 시 복구
```

외부에 공개되는 것은 Next.js web 하나뿐이다. Spring API와 데이터 서비스는 k3s 내부 Service DNS로만 닿는다.

### 저장소 구성

| 디렉터리 | 무엇 |
|---|---|
| `web/` | Next.js 프런트엔드. 위키(`app/**`)와 블로그(`app/blog/**`)가 **한 앱**이고 `middleware.ts`가 host로 가른다 |
| `spring/` | Spring Boot API. 위키·블로그 공용 |
| `services/` | 시나리오용 별도 서비스 — `payment-api`(Saga 참여자), `partner-simulator`(외부 장애 재현). FastAPI |
| `infra/` | k3s 매니페스트(`k8s/`), OpenSearch 이미지, 로컬 구성 |
| `scripts/` | 배포·백업·시드·발행 스크립트. 위키 원고는 `content/wiki/`에서 읽는다 |
| `content/wiki/` | 위키 본문 원본과 manifest. 시드·export가 함께 사용 |
| `posts/` | 사이트에 나가는 글. `jay-wiki/`는 생성 사본, `jay-blog/drafts/`는 편집·발행 원고. 운영 DB와 충돌을 대조하며 동기화하고 그림 원본도 보관 |
| `docs/` | 런북·설계·감사 문서. 사이트에 나가지 않는다 |
| `archive/` | 안 쓰는 옛 문서와 프로토타입. 추적하지 않는다 |

## 직접 눌러볼 수 있는 것

| 시나리오 | 화면 | 무엇을 보여주나 |
|---|---|---|
| 5분 포트폴리오 | [`/portfolio`](https://portfolio.leneu.cloud/portfolio) | 문제, 설계 결정, 대표 실패와 한계를 한 화면에 압축 |
| 운영 이력 | [`/operations/history`](https://portfolio.leneu.cloud/operations/history) | 실제 배포·장애·복구·리허설을 발생일과 사용자 영향 기준으로 정리 |
| Saga 보상 트랜잭션 | [`/saga/order`](https://portfolio.leneu.cloud/saga/order) | 배송 실패를 주입하면 결제 취소와 재고 해제가 순서대로 기록된다 |
| Kafka fan-out과 DLQ | [`/kafka/order`](https://portfolio.leneu.cloud/kafka/order) | Outbox 발행, consumer별 처리, 재시도, DLQ 격리 |
| Redis 대기열 | [`/chat`](https://portfolio.leneu.cloud/chat) | 정원 3명, ZSET 대기열, 퇴장 시 자동 승격 |
| 검색 3-way 비교 | [`/board/search`](https://portfolio.leneu.cloud/board/search) | 같은 쿼리로 LIKE, tsvector+GIN, OpenSearch+nori |
| 상품권 사용 정합성 | [`/scenarios/gift-card-consistency`](https://portfolio.leneu.cloud/scenarios/gift-card-consistency) | 중복 요청·응답 유실·취소의 멱등 상태 전이 |
| 외부 제휴 API 장애 | [`/scenarios/partner-api-resilience`](https://portfolio.leneu.cloud/scenarios/partner-api-resilience) | 실제 WebClient↔FastAPI 통신으로 timeout·429·5xx·HMAC callback 검증 |
| 주문·재고·결제 확정 | [`/scenarios/commerce-order-confirmation`](https://portfolio.leneu.cloud/scenarios/commerce-order-confirmation) | 마지막 재고·중복 callback·보상 상태 전이 |
| 실무 사례 허브 | [`/scenarios`](https://portfolio.leneu.cloud/scenarios) | 23편 실무 사례·운영 리허설의 문제, 검증과 운영 경계. 각 편에 **출처와 실행 여부** 배지가 붙는다 |

## 기술 스택

| 계층 | 사용 기술 |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript strict |
| Backend | Spring Boot 3.5 / Java 21, FastAPI / Python 3.12 |
| Data | PostgreSQL 18, Redis 7, Kafka 4 (KRaft), OpenSearch 3.7 + nori, MinIO |
| Infra | k3s 단일 노드, Cloudflare Tunnel, Traefik, Helm |
| Observability | Prometheus, Grafana, Alertmanager, Loki, Tempo, OpenTelemetry |
| Delivery | GitHub Actions, GHCR, self-hosted runner |

## 문서

| 문서 | 역할 |
|---|---|
| [docs/current-project-status.md](docs/current-project-status.md) | **여기서 시작한다.** 현재 상태, 검증된 것, 보류한 것 |
| [docs/wiki-editorial-plan.md](docs/wiki-editorial-plan.md) | 4개 대분류와 18개 DB 탭에 공개할 글의 편집 백로그 |
| [docs/interview/](docs/interview/) | **면접 준비 묶음.** 시나리오 23편의 원리·대본과 질문 색인, 프로젝트 설명 가이드, 경력 사례 인벤토리 |
| [docs/workbooks/](docs/workbooks/) | 구현 워크북. 관리자 서브도메인 분리의 인증·라우팅 설계와 회귀 검증 계획 |
| [docs/deploy-runbook.md](docs/deploy-runbook.md) | 공개 소스의 검사·이미지 빌드와 private 운영 배포의 경계 |
| [docs/blog-writing-guide.md](docs/blog-writing-guide.md) | 블로그 글의 형식·문체·이미지 규칙 |
| [docs/wiki-writing-guide.md](docs/wiki-writing-guide.md) | 위키 글의 형식과 제목 규칙 |
| [docs/account-access-runbook.md](docs/account-access-runbook.md) | 상세 운영 자료를 private 저장소로 옮겼다는 공개 안내 |
| [docs/frontend-security-improvement-log.md](docs/frontend-security-improvement-log.md) | 문서 탐색 안정성, 반응형 UI, Markdown·관리자 보안 경계의 개선 기록 |
| [docs/open-source-and-content-license-audit.md](docs/open-source-and-content-license-audit.md) | 폰트·패키지·컨테이너·로고·이미지의 라이선스와 출처 점검 |
| [docs/legal-launch-compliance-audit.md](docs/legal-launch-compliance-audit.md) | 개인정보·게시판·저작권을 코드와 연결한 공개 서비스 출시 점검 (소셜 로그인은 그 뒤 제거) |
| [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) | 직접 사용하는 주요 제3자 요소와 상표 고지 초안 |
| [posts/jay-wiki/](posts/jay-wiki/) | 위키 글을 개별 Markdown으로 읽는 스냅샷. **생성물이라 여기를 고치지 않는다** — 정본은 시드 |
| [docs/gitops-wiki-content-sync-runbook.md](docs/gitops-wiki-content-sync-runbook.md) | 검토된 기준 콘텐츠의 내부 동기화, token 회전과 실패 대응 |
| [infra/README.md](infra/README.md) | 매니페스트 구성과 설치 순서 |
| [web/README.md](web/README.md) · [spring/README.md](spring/README.md) | 프론트엔드·백엔드 로컬 실행, 구조와 검증 명령 |

## 로컬에서 띄우기

```bash
# 데이터 계층 (PostgreSQL, Redis, Kafka, OpenSearch, MinIO)
docker compose -f docker-compose.dev.yml up -d

# 백엔드
cd spring && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun

# 프론트엔드
cd web && npm ci && npm run dev

# 위키 글 시드 (재실행해도 안전하다 — slug 기준 upsert)
node scripts/seed-portfolio-wiki.mjs
```

## 글을 올리는 법

**코드가 아니라 글만 고쳤다면 배포가 필요 없다.** 블로그와 위키가 서로 다른 문을 쓴다.

```bash
# 블로그 — 로컬과 운영을 대조해 편마다 방향을 정하고, 그림까지 옮긴다
node scripts/blog-sync.mjs             # 무엇이 어느 방향으로 갈지 보여주기만 한다
node scripts/blog-sync.mjs --write     # 실제로 맞춘다

# 블로그 — 한 편만 올린다
node scripts/publish-blog-post.mjs posts/jay-blog/drafts/<slug>.md --write

# 위키 — 로컬 개발 서버의 http://localhost:3000/sync 또는 같은 일을 하는 터미널 명령
node scripts/content-ops.mjs check          # 로컬과 운영의 차이만 본다
node scripts/content-ops.mjs publish-wiki   # 로컬 → 운영 (TOTP)
```

**위키 글은 배포까지 가야 화면이 바뀐다** — 배포가 시드를 실행한다. 블로그는 반대로 배포와 무관하고
위 명령이 몇 초 만에 끝낸다. 그림은 MinIO 로 가므로 컨테이너 이미지에 안 구워진다.
자세한 것은 [docs/deploy-runbook.md](docs/deploy-runbook.md) 에 있다.

## 이 프로젝트가 지키는 규칙

- **아직 하지 않은 일을 한 것처럼 쓰지 않는다.** 로드맵의 각 항목에는 완료 조건이 붙어 있고,
  조건을 채우기 전에는 운영 글로 옮기지 않는다.
- **Secret은 커밋하지 않는다.** `infra/k8s/secret.example.yaml`은 자리표시자 템플릿이고,
  실제 값은 `.gitignore`로 막혀 있다.
- **백업은 복원해보기 전까지 백업이 아니다.** `scripts/rehearse-postgres-restore.sh`가
  sha256 검증과 임시 DB 복원, row count 비교까지 한 번에 실행한다.
- **현재 문서의 로컬 링크와 폐기된 상태 표현은 CI에서 검사한다.** 로컬에서는
  `node scripts/check-docs.mjs`로 같은 검사를 실행한다.

## 알려진 한계

단일 노드다. backend는 HPA로 평시 `2`, 최대 `3` replicas를 쓰고 frontend·payment·shipping 등은
기본 `1` replica다. PVC는 k3s `local-path`(단일 디스크)를 쓴다. 따라서 파드 수를 늘려도
노드 장애에 대한 고가용성이 생기는 것은 아니다.
PostgreSQL 백업은 miniPC 디스크에 남지만, 운영에 글을 반영할 때마다 개발 머신으로 사본을
한 벌 내보낸다(`scripts/pull-prod-backup.sh`). 그 사본만으로 복원되는 것까지 확인했다.
다만 두 기계가 같은 장소에 있어 **화재·도난 같은 동시 손실은 못 막는다** — 오브젝트 스토리지
복제(Cloudflare R2)는 결제 수단 등록을 피하려고 보류했다. 자세한 목록은
[docs/current-project-status.md](docs/current-project-status.md)의 "미완료 또는 의도적으로 보류한 항목"에 있다.

## 작업 로그

무엇을 언제 세웠는지만 적는다. 날짜는 해당 파일이 처음 들어온 커밋 기준이다.

| 날짜 | 무엇 |
|---|---|
| 2026-07-04 | 첫 커밋. Next.js 위키(뷰어·에디터·검색·관리자) |
| 2026-07-07 | miniPC k3s 배포. 매니페스트, GitHub Actions 배포 파이프라인, Prometheus |
| 2026-07-08 | OpenSearch + nori, FastAPI `payment-api`(Saga 참여자) |
| 2026-07-09 | 실무 사례 허브 `/scenarios` |
| 2026-07-11 | 백업 복원 리허설 스크립트 — 복원해보기 전까지 백업이 아니다 |
| 2026-07-16 | `partner-simulator` — 외부 HTTP 장애를 실제 통신으로 재현 |
| 2026-08-02 | 블로그 분리. 같은 앱에 host로 갈리는 두 번째 사이트 |
| 2026-08-08 | 재부팅 복구 리허설 런북 |
| 2026-08-09 | 재부팅 리허설 2회차 — 다운타임 60초, 수동 조치 없음. 무인 자동 재부팅 켬 |
| 2026-08-10 | 저장소 정리 — `archive/` 분리, 글 원고를 `posts/`로 통합, `spring/` 평탄화 |
| 2026-08-13 | 배포 런북. 배포는 `develop` → `main` 머지 하나로만 한다는 규칙을 문서로 고정 |
| 2026-08-16 | 글만 운영에 올리는 로컬 판 `/sync`. 코드가 안 바뀌었으면 배포를 안 부른다 |
| 2026-08-17 | `shipping-api` — 자기 DB를 든 배송 참여자 |
| 2026-08-22 | 소개 화면과 운영 이력 화면 |
| 2026-08-24 | 재부팅을 보이게 만드는 알림 셋 |
| 2026-09-02 | 그림이 든 블로그 글도 배포 없이 올린다. 그림은 MinIO로, 인증은 내부 토큰으로 |

프로젝트는 2026-07-04에 시작했다. 공개 저장소는 검토된 코드와 문서를 새 이력으로 분리했다.

## 저장소 안내

- [문서 지도](docs/README.md)
- [도구 지도](scripts/README.md)
- [배포 안내](docs/deploy-runbook.md)

## 라이선스

직접 작성한 소프트웨어 코드는 [MIT License](LICENSE)로 공개한다. 글·설계 기록·이미지·음원·
벤치마크 자료에는 이 라이선스를 일괄 적용하지 않는다. 콘텐츠별 이용 범위는
[CONTENT_LICENSE.md](CONTENT_LICENSE.md), 제3자 고지는
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에서 확인한다.
