# 문서 형상관리 구현 확인과 대표 글 개편 비교

작성일: 2026-07-14

## 목적

이 문서는 두 가지를 한 번에 확인하기 위한 자료다.

1. jay-wiki의 문서 형상관리가 실제로 어디까지 구현됐는지 확인한다.
2. 현재 대표 문서인 `Spring API를 외부에 직접 열지 않은 이유`와 권장 개편안을 비교한다.

개편안을 바로 운영 DB에 반영하지는 않는다. 현재 글과 비교하고 서사 구조를 확정한 뒤 시드 원본과 DB를 갱신한다.

---

## 1. 문서 형상관리는 구현돼 있는가

결론부터 말하면 **구현돼 있다**. 정확히는 Git을 복제한 시스템이 아니라 PostgreSQL 기반의 문서 스냅샷 버전관리다.

### 저장 구조

| 역할 | 저장 위치 | 설명 |
|---|---|---|
| 현재 문서 | `public.tb_article` | 최신 제목, 본문, 버전과 수정 시각 |
| 과거 스냅샷 | `public.tb_revision` | 수정 직전의 제목과 본문, 버전, 편집자, 생성 시각 |
| 카테고리 | `public.tb_tab` | 문서가 속한 탭과 탭 순서 |

근거 코드는 다음 위치에 있다.

- 스키마: `spring/src/main/resources/db/migration/V2__content_db.sql`
- 저장·되돌리기: `spring/src/main/java/cloud/leneu/jaywiki/wiki/ArticleService.java`
- revision API: `spring/src/main/java/cloud/leneu/jaywiki/wiki/ArticleController.java`
- 관리자 이력 화면: `web/src/app/admin/articles/[slug]/revisions/page.tsx`
- 회귀 테스트: `spring/src/test/java/cloud/leneu/jaywiki/ArticleRevisionTest.java`

### 수정 흐름

1. 신규 문서는 `version=1`로 `tb_article`에 저장한다.
2. 기존 문서를 수정하면 현재 버전을 `tb_revision`에 먼저 복사한다.
3. `tb_article`에 새 내용을 저장하고 version을 1 올린다.
4. 관리자 화면은 과거 버전, 편집자, 저장 시각을 조회한다.

### 되돌리기 흐름

되돌리기는 현재 행의 version을 과거 숫자로 낮추지 않는다.

예를 들어 현재 v2에서 v1을 선택하면 현재 v2를 revision에 보존한 뒤, v1의 제목과 본문으로 **새로운 v3**를 만든다. 따라서 되돌리기 자체도 이력으로 남고 다시 복구할 수 있다.

### 자동화된 검증

`ArticleRevisionTest`에서 다음 동작을 실제 PostgreSQL Testcontainers로 확인한다.

- v1 생성 시 revision이 비어 있는지
- v2 수정 시 v1 스냅샷이 생성되는지
- 연속 수정 시 revision이 누적되는지
- 과거 버전으로 되돌릴 때 새 version이 생성되는지
- 문서 목록이 최근 수정 시각 내림차순인지

### 현재 구현 범위와 한계

| 항목 | 상태 | 설명 |
|---|---|---|
| 버전 번호 | 구현 | 수정 및 되돌리기 때 증가 |
| 이전 본문 보존 | 구현 | 수정 직전 title/body 스냅샷 |
| 편집자·시각 기록 | 구현 | revision에 editor/createdAt 저장 |
| 과거 버전 목록 | 구현 | 관리자 이력 화면에서 조회 |
| 과거 버전 복원 | 구현 | 과거 내용을 새 버전으로 저장 |
| 버전별 본문 API | 구현 | 특정 revision 본문 조회 가능 |
| 두 버전 diff UI | 미구현 | 현재 화면은 변경 줄 비교를 제공하지 않음 |
| summary·tags 등 전체 메타데이터 복원 | 미구현 | 현재 revision은 title/body만 보존 |
| 수정 사유 | 미구현 | 커밋 메시지에 해당하는 필드가 없음 |
| 동시 수정 충돌 감지 | 미구현 | optimistic locking 또는 예상 version 검증 없음 |
| 삭제 문서 복원 화면 | 미구현 | revision은 남지만 삭제 문서를 UI에서 복원하지 않음 |

따라서 외부에 설명할 때는 `Git과 같은 형상관리`보다는 다음 표현이 정확하다.

> PostgreSQL을 Source of Truth로 두고, 수정 직전 문서를 revision으로 보존하며 되돌리기도 새 버전으로 기록되는 스냅샷 버전관리를 구현했다.

---

## 2. 현재 대표 문서의 상태

비교 대상은 `posts/jay-wiki/02-backend/spring-bff-auth-boundary.md`다.

### 현재 글의 장점

- Browser, Next.js BFF, Spring, PostgreSQL의 경계가 빠르게 보인다.
- 직접 공개하지 않은 이유가 표로 정리돼 있다.
- ADMIN/USER 권한과 upstream 장애의 502 변환까지 다룬다.
- 단순 아키텍처 소개에 그치지 않고 실제 실패 경험이 들어 있다.

### 현재 글의 아쉬운 점

- 결론이 첫 문장부터 제시돼 문제를 발견하고 선택한 과정이 약하다.
- Spring 직접 공개, Gateway, BFF 중 무엇을 비교했는지가 없다.
- 인증, 권한, 장애 전달이 각각 좋은 내용이지만 하나의 사건 흐름으로 연결되지 않는다.
- 검증 방법과 현재 한계가 명확한 절로 분리돼 있지 않다.
- 다음 문서 또는 실행 가능한 시나리오로 이어지는 탐색 경로가 없다.

---

## 3. 개편안 초안

아래는 같은 사실을 기승전결이 보이도록 다시 구성한 비교용 초안이다.

### Spring API를 외부에 직접 열지 않은 이유

#### 문제: 공개 주소가 늘수록 경계도 늘어났다

jay-wiki의 첫 화면은 Next.js지만 실제 문서, 계정과 게시판 데이터는 Spring Boot가 관리한다.

브라우저가 Spring API를 직접 호출하게 만들 수도 있었다. 그러나 그렇게 하면 Next.js와 Spring 양쪽에 공개 주소, CORS, 인증 쿠키, 오류 응답 정책을 각각 관리해야 한다. 내부 서비스가 추가될 때마다 브라우저가 알아야 하는 주소도 늘어난다.

이 프로젝트에서 필요한 것은 API를 많이 공개하는 구조가 아니라, **외부 진입점은 하나로 유지하면서 내부 서비스의 책임은 분리하는 구조**였다.

#### 선택지: 직접 공개, Gateway, BFF

| 선택지 | 장점 | 현재 프로젝트에서의 부담 |
|---|---|---|
| Spring 직접 공개 | 경로가 단순하고 중간 계층이 적음 | 공개 주소, CORS, 쿠키와 장애 응답 경계가 분산됨 |
| Spring Cloud Gateway | 서비스 라우팅과 정책 집중에 유리 | 현재 서비스 규모에서는 별도 운영 계층이 하나 더 생김 |
| Next.js BFF | 브라우저 진입점과 인증 경계를 한곳에 유지 | upstream 장애와 응답 전달을 BFF가 책임져야 함 |

현재 규모에서는 Next.js가 이미 모든 사용자 요청의 진입점이었다. 그래서 Browser와 Spring 사이에 별도 Gateway를 추가하기보다 Next.js BFF를 공개 경계로 선택했다.

#### 구현: 브라우저는 내부 서비스 주소를 모른다

요청은 다음 순서로 흐른다.

`Browser → Cloudflare Tunnel → Next.js → /api/bff → Spring Service DNS → PostgreSQL`

브라우저에는 Next.js 주소만 공개한다. Spring, FastAPI, PostgreSQL, Redis와 Kafka는 k3s 내부 네트워크에 두고 Next.js 또는 백엔드 서비스가 내부 DNS로 접근한다.

로컬 관리자 로그인과 Google OAuth의 최종 결과도 같은 경계로 모았다. Spring이 `jw_token` httpOnly 쿠키를 발급하고, BFF의 인증 조회가 ADMIN 또는 USER 상태를 전달한다. 화면에서 편집 버튼을 숨기는 것과 별개로 변경 요청은 서버에서 ADMIN 권한을 다시 검사한다.

#### 예상과 달랐던 점: 프록시는 장애 책임도 가져간다

처음에는 BFF가 Spring 응답을 그대로 전달하면 충분하다고 생각했다.

하지만 Spring이 정상적인 4xx나 5xx를 반환하는 상황과, Spring에 연결 자체가 되지 않는 상황은 달랐다. 연결 실패 시 fetch 예외가 처리되지 않아 Next.js 500과 스택 트레이스로 끝났고, 같은 페이지의 서버 컴포넌트는 빈 목록을 보여주고 있어 장애 표현도 일관되지 않았다.

현재는 다음 규칙을 적용한다.

| 상황 | BFF 동작 |
|---|---|
| Spring이 HTTP 오류 응답을 반환 | Spring의 problem+json과 상태 코드를 전달 |
| Spring 연결 자체가 실패 | BFF가 502 application/problem+json 생성 |

이 경험으로 BFF는 단순 프록시가 아니라 인증과 실패 계약을 함께 소유하는 경계라는 점을 확인했다.

#### 검증: 경계를 어떻게 확인했는가

- 외부에서는 Spring Service 주소로 직접 접근하지 못한다.
- 공개 URL의 `/api/bff`를 통해 문서와 인증 API가 동작한다.
- Spring 중단 시 BFF는 처리되지 않은 500 대신 502 problem+json을 반환한다.
- ADMIN과 USER는 같은 로그인 진입점을 사용하지만 변경 권한은 서버에서 분리된다.
- OAuth callback은 프록시 내부 주소가 아니라 설정된 public origin으로 돌아온다.

#### 현재 결론과 다시 검토할 조건

현재 서비스 수와 운영 규모에서는 Next.js BFF가 공개 경계를 하나로 유지하는 데 적절하다.

다만 서비스별 라우팅 정책, 독립적인 rate limit, 외부 API 소비자 또는 여러 프론트엔드가 생기면 Gateway 도입 비용보다 얻는 이점이 커질 수 있다. 그 시점에는 BFF를 무조건 확장하지 않고 Spring Cloud Gateway 또는 별도 API Gateway를 다시 비교한다.

#### 연결해서 볼 문서

- `Google OAuth가 공개 URL을 잃지 않게 한 방법`
- `local ADMIN과 Google USER를 분리한 이유`
- `장애를 HTTP 응답으로 숨기지 않는 기준`
- `미니PC k3s와 Cloudflare Tunnel 배포 구조`

---

## 4. 전후 비교

| 기준 | 현재 글 | 개편안 |
|---|---|---|
| 시작점 | 현재 구조 설명 | 실제 해결해야 했던 문제 |
| 선택 근거 | BFF 장점 중심 | 직접 공개·Gateway·BFF 비교 |
| 구현 설명 | 구조, 인증, UI 권한을 개별 설명 | 하나의 요청 경계로 연결 |
| 실패 경험 | BFF fetch 500 사례 | 최초 가정과 바뀐 장애 계약까지 연결 |
| 검증 | 본문에 분산 | 확인 항목을 별도 절로 분리 |
| 한계 | 명시되지 않음 | Gateway 재검토 조건 명시 |
| 다음 탐색 | 없음 | 관련 문서 네 편으로 연결 |

개편안은 새로운 기술을 추가하지 않는다. 이미 구현한 사실을 `문제 → 선택 → 구현 → 예상 밖의 실패 → 검증 → 한계` 순서로 재배치한다.

## 5. 다음 작업 제안

1. 이 비교본을 기준으로 대표 문서의 최종 문구를 확정한다.
2. `scripts/seed-portfolio-wiki.mjs`의 `spring-bff-auth-boundary` 본문을 갱신한다.
3. 시드 dry-run으로 변경 대상이 한 편인지 확인한다.
4. 로컬 DB에 반영해 기존 v5가 revision으로 남고 새 v6이 생성되는지 확인한다.
5. 관리자 이력 화면에서 v5와 v6을 비교하고 v5 되돌리기를 로컬에서 검증한다.
6. 같은 템플릿을 인프라, 데이터, 관측·운영 대표 글에 순차 적용한다.

이 과정 자체가 문서 형상관리 기능을 보여주는 시연이 된다. 개편 전 글을 revision으로 보존하고 개편 후 글을 새 버전으로 발행한 뒤, 필요하면 과거 버전으로 되돌릴 수 있기 때문이다.
