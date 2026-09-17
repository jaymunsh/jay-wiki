
- 관리자 인증을 약하게 만들지 않고 검토된 위키 기준 콘텐츠를 운영 DB에 반복 반영하는 경계를 어떻게 나눴나?
- 사람의 관리자 인증(비밀번호+TOTP)과 배포 시스템의 권한을 분리해, 별도 machine token 경로를 만들기로 했다. 처음 tab·article upsert 둘이던 쓰기는 2026-08-16 탭 삭제·블로그 발행이 더해져 넷이 됐다.
- 내부 endpoint는 token이 없거나 틀리면 404로 응답하고, 시드는 필드 단위 diff로 차이가 없으면 저장 API를 호출하지 않으며, revision editor에 gitops: 뒤 배포 commit의 짧은 SHA를 남겨 변경 주체를 추적한다.

위키의 기준 글은 scripts/seed-portfolio-wiki.mjs에서 검토하고, 실제 서비스의 원본은 PostgreSQL에 저장한다.
이 둘을 맞출 때마다 관리자 비밀번호와 Google Authenticator 코드를 AI 에이전트에게 전달하는 방식은 반복 작업에 맞지 않았다.

그렇다고 관리자 로그인에서 TOTP를 없애거나, 특정 헤더만 넣으면 공개 API가 ADMIN이 되는 예외를 만들면 안 된다.
해결한 문제는 인증을 약하게 만드는 일이 아니라 **사람의 관리자 작업과 배포 시스템의 제한된 작업을 서로 다른 경계로 나누는 것**이었다.

## 두 작업은 권한이 다르다

| 작업 | 인증 | 허용 범위 |
|---|---|---|
| 운영 관리자 편집·이력·계정 작업 | 관리자 비밀번호 + TOTP | 관리자 UI와 기존 ADMIN API |
| Git으로 검토된 기준 콘텐츠 동기화 | 별도 machine token | tab·article upsert 둘 + ready 확인 하나 |

이 표의 예전 판은 허용 범위를 한 군데 틀리게 적었다.

- 예전 서술 ~~tab·article upsert 두 endpoint만~~
  - 2026-08-13 정정: 매핑은 셋이다. 같은 token으로 GET /internal/content-sync/ready 가 열려 있다.
    데이터를 읽지도 쓰지도 않고 204만 주는 준비 확인용이라 시드가 쓰기 전에 최대 60초 폴링한다.
    쓰기가 둘뿐이라는 취지는 그대로다.
  - 2026-08-16 정정: 쓰기가 넷이 됐다 — 탭 upsert, 문서 upsert, 빈 탭 DELETE(/internal/content-sync/tabs/{tabId}),
    블로그 글 upsert(/internal/content-sync/blog-posts). token 하나, 404 규칙 하나는 그대로다.
    무엇이 왜 늘었는지는 아래 결말 절에 있다.

machine token은 관리자 세션이나 JWT를 만들지 않는다. revision 되돌리기, 사용자 관리, 게시판과 자산 삭제에도 사용할 수 없다.
따라서 이 경로를 관리자 백도어로 취급하지 않고, 목적이 좁은 서비스 자격 증명으로 관리한다.

- 예전 서술 ~~문서 삭제에도 사용할 수 없다~~
  - 2026-08-16 정정: 위키 문서 삭제는 여전히 안 되지만, **빈 탭** 삭제는 이 token으로 된다.
    upsert 만 있던 문에 처음 들어온 지우는 경로라, 가드를 서버가 쥐었다 — 글이 든 탭은 409로 거부하고
    한 번에 둘까지만 지운다. 잃을 것이 없는 대상으로 좁힌 채로만 삭제를 허락한 것이다.

## 검토된 commit이 클러스터 안 Job으로 DB에 닿는다

~~~mermaid
flowchart TB
  Commit[검토된 Git commit] --> CI[GitHub Actions]
  CI --> Runner[miniPC self-hosted runner]
  Runner --> Deploy[SHA image rollout]
  Deploy --> Backup[PostgreSQL backup Job]
  Backup --> Job[일회성 content sync Job]
  Secret[Kubernetes Secret] -->|Job Pod에 주입| Job
  Secret -->|backend Deployment에도 주입| Internal
  Job -->|ClusterIP + 전용 header| Internal[Spring internal content sync]
  Internal --> Service[기존 TabService / ArticleService]
  Service --> DB[(PostgreSQL)]
  Service --> Revision[(revision)]
  Service --> Search[OpenSearch index event]
~~~

APP_CONTENT_SYNC_TOKEN은 Job뿐 아니라 backend Deployment에도 필수로 주입된다. 서버가 비교할 기대값이 거기서 온다.

GitHub Actions 로그에는 token 값이 남지 않는다. 다만 runner가 값을 아예 안 보는 것은 아니다 —
Secret이 비어 있으면 배포 단계가 runner에서 openssl rand로 토큰을 만들어 Secret에 넣는다. 그 뒤로는 존재 여부만 확인한다.
평소 경로에서 runner는 Job을 만들 뿐이고, kubelet이 기존 Kubernetes Secret의 APP_CONTENT_SYNC_TOKEN을 Job 컨테이너에 직접 주입한다. Job에는 Kubernetes API token도 자동 마운트하지 않았다.

시드 원본도 배포 이미지에 굽지 않는다. seed-portfolio-wiki.mjs를 ConfigMap으로 말아 node:24-alpine Job에 readOnly로
마운트하므로 이미지와 콘텐츠의 수명주기가 분리된다. 배포 트리거의 경로 필터에는 scripts/** 가 있어서
위키 본문 한 줄만 고쳐도 배포 전체가 돈다.

내부 호출은 http://jaywiki.backend.svc.cluster.local:8080처럼 클러스터 DNS로만 허용한다. 시드 스크립트는 machine token을
사용한 평문 HTTP를 localhost나 .svc 주소에서만 받아들이며, 일반 원격 HTTP 대상에는 실행 전에 실패한다.

## DB를 직접 고치지 않고 기존 서비스로 저장한다

Job이 SQL로 tb_article을 갱신하면 빠르지만 기존 애플리케이션 계약을 건너뛴다.

- 변경 전 본문을 tb_revision에 남기는 동작
- 본문이 참조한 MinIO 자산 연결
- OpenSearch 재색인 이벤트
- 예전 서술 ~~status, lastReview와 sortOrder 검증~~
  - 2026-08-13 정정: 요청에 걸린 제약은 slug(NotBlank + 패턴), parentId(NotBlank),
    title(NotBlank) 셋뿐이고 status·sortOrder·lastReview에는 제약이 없다.
    서비스가 하는 일은 검증이 아니라 기본값 채우기다 — status는 null이면 draft,
    sortOrder는 null이면 기존 값 유지, lastReview는 LocalDate 역직렬화 실패만 걸린다

내부 endpoint도 관리자 편집과 같은 TabService와 ArticleService를 호출한다. 인증 입구는 다르지만 저장 규칙은 하나다.
revision의 editor에는 gitops: 뒤에 배포 commit의 짧은 SHA를 남겨 변경 주체를 추적한다. 다만 revision 스냅샷은 기존 문서를
수정하는 분기에서만 찍히므로, gitops 표시는 그 배포가 덮어쓴 직전 본문에 붙는 것이고 신규 문서에는 revision 행이 없다.

## 재실행은 멱등하고 복구는 revision이 맡는다

시드는 쓰기 전에 현재 tab·article을 token도 쿠키도 없는 공개 GET으로 읽어 필드 단위 diff를 계산한다 —
읽기는 공개, 쓰기만 token이라는 경계가 시드 안에서도 유지된다. 차이가 없으면 저장 API를 호출하지 않으므로 version과
updatedAt이 불필요하게 늘지 않는다. DB에만 있는 문서는 extra로 보고하지만 자동 삭제하지 않는다.

Job 이름은 commit SHA로 유일해지고, 실행 전에 같은 이름의 Job을 지우고 새로 만들어 재배포에도 안전하다.

배포 순서는 다음과 같다.

1. 애플리케이션 테스트와 이미지 빌드를 통과한다.
2. 현재 Deployment 이미지를 rollback 대상으로 캡처한다.
3. 새 backend image가 Ready가 된 뒤 PostgreSQL 수동 backup Job의 완료를 기다린다.
4. content sync Job을 실행한다.
5. Job 실패 로그를 남기고 파이프라인을 실패시킨다.
6. 공개 smoke test까지 통과해야 배포를 완료한다.

동기화는 upsert만 수행하므로 백업이 자동 rollback을 뜻하지는 않는다. 잘못된 본문은 revision 되돌리기나 검토된 후속 commit으로
복구한다. 스키마·이미지 배포 실패는 기존 이미지 rollback 경계를 따른다.

## 역할은 적고 token 값은 어디에도 남기지 않는다

공개 문서에는 endpoint의 역할, 권한 범위, 실패 처리와 검증 기준을 적어도 된다. token 값, Secret의 base64 값,
관리자 비밀번호, TOTP seed와 현재 코드는 어떤 로그·문서·Git에도 남기지 않는다.

Spring 내부 endpoint는 token이 없거나 틀리거나 서버 설정이 비어 있으면 모두 404로 응답한다. 404보다 중요한 사실은
/internal/** 이 Spring Security 규칙 밖이라는 점이다 — ADMIN 규칙은 /api/** 에만 걸리고 마지막 규칙이
anyRequest().permitAll()이라, 유일한 방어선은 ContentSyncAuthorizer 한 곳이고 비교는 MessageDigest.isEqual로
상수 시간이라 timing 공격이 성립하지 않는다.

public Next.js BFF에는 이 경로의 proxy를 만들지 않았고 Spring Service는 ClusterIP다. 다만 같은 클러스터에서 임의 Pod 실행
권한을 얻은 공격자는 Secret 주입이나 내부 네트워크를 노릴 수 있으므로, runner와 Kubernetes 배포 권한은 여전히 강한 운영
권한으로 취급한다.

## 결말 — 같은 문이 두 번 더 시험받았다 (2026-08-16)

이 ADR 이 그은 경계는 「인증을 깎지 않고, 목적이 좁은 기계 경로를 따로 둔다」였다. 블로그 자동 발행이 들어올 때 그 주장이 다시 시험받았다. 가장 짧은 길은 TOTP 씨앗을 GitHub Secrets 에 넣는 것이었다 — 다섯 줄이면 됐다. 기각했다. 비밀번호 옆에 2차 인증 씨앗을 두면 2FA 가 1FA 가 된다. 더 나은 길이 이미 있는데 보안을 깎을 이유가 없다. 그래서 블로그는 위키가 쓰던 것과 같은 문으로 들어왔다 — 같은 token, 같은 404, endpoint 하나 추가.

블로그 쪽에서 이 ADR 과 같은 결의 판단이 하나 더 나왔다. **무엇이 바뀌었는지는 서버가 판단한다.** 클라이언트가 비교하려면 운영 본문을 읽어야 하는데, 공개 조회 API 는 조회수를 올린다 — 배포마다 가짜 조회가 편마다 하나씩 쌓인다. 조회수 없는 읽기 경로를 새로 뚫는 대신, 본문을 이미 들고 있는 서버가 견준다. 인증을 깎지 않으려고 경로를 좁게 유지한 것과 같은 원칙이다 — 경로를 늘리지 않고, 이미 가진 쪽이 일한다.

탭 DELETE 는 성질이 다르다. 이 문의 쓰기는 지금까지 전부 upsert 라 잘못 보내도 revision 과 백업으로 돌아올 수 있었는데, 삭제는 처음으로 **되돌릴 수 없는** 동작이다. 그래서 조건을 서버가 쥔다 — 글이 든 탭은 409(클라이언트가 세어 보내면 그 사이에 글이 들어와도 모른다), 한 번에 둘까지(시드 형식이 깨져 정본 탭 집합이 통째로 비는 사고 대비). 지울 수 있는 대상 자체를 잃을 것이 없는 빈 탭으로 좁힌 것이다. 이 경계 전체가 어떤 기준으로 움직였는지는 deploy-automation-boundary 에 있다.

## 남은 개선 — 회전 리허설과 감사 이벤트가 다음이다

- machine token 회전 리허설과 직전 token 폐기 시간을 기록한다.
- sync 결과를 배포 SHA와 함께 별도 구조화 감사 이벤트로 남긴다.
- runner 침해를 가정한 namespace RBAC와 egress 정책을 더 좁힌다.
- 백업 artifact에서 실제 복원하는 정기 drill을 content sync 배포와 별도로 유지한다.

자동화의 목표는 사람의 승인을 없애는 것이 아니다. Git review를 승인 지점으로 옮기고, 배포 시점에는 최소 권한의 기계 경로가
같은 저장 규칙을 반복하도록 만든 것이다.
