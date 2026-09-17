# 보안 후속 2차 — 구현과 운영 전환 조건

> **최신 상태:** 이 문서는 당시 구현 이력이다. 이후 실제 운영 전환·복원·외부 검사 결과는 [9월 10일 운영 기록](security-operations-2026-09-10.md)을 따른다. 아래 미완료 표기를 현재 남은 작업으로 중복 집계하지 않는다.

> 이후 사용자 요청으로 유지보수도 진행했다. [유지보수 후속 기록](maintenance-followup-2026-09-09.md)에
> 원고 분리·수치 자동화·실제 편집 E2E와 그 과정에서 발견한 요청 판별 회귀의 수정을 기록했다.
> 아래 운영 전환 목록은 당시 상태이며, 이후 결과는 9월 10일 운영 기록을 따른다.

사용자 요청: 유지보수 작업을 제외하고 남은 보안 개선을 진행한다.
작업 브랜치: `fix/security-followup-20260908`. 이전 체크포인트: `85a3065`.
이 문서는 로컬 구현과 운영 적용을 구분한다. 이번에 SSH는 Cloudflare Access 인증 요구로 실패했다.
운영 배포·인프라 변경·main 머지는 하지 않았다. 기존 블로그 초안의 수정도 그대로 보존했다.

## 구현

| 항목 | 보안 문제와 판단 근거 | 변경과 한계 |
|---|---|---|
| 보안 Redis 분리 | 기존 `redis-values.yaml`의 allkeys-lru는 메모리 압박 시 OTP 재사용 방지·시도 제한 키도 제거할 수 있다 | `SecurityRedisConfiguration`으로 별도 연결. OTP, 게시판 제한, JWT 폐기만 전용 template 사용. 새 Redis는 인증·noeviction·AOF appendfsync always·PVC·backend 전용 NetworkPolicy. 운영 전환은 아직 |
| JWT 로그아웃 | 쿠키 삭제만으로는 복사한 JWT를 만료 전 재사용할 수 있다 | 토큰 SHA-256을 만료까지 폐기 목록에 저장. 발급마다 UUID jti. 폐기 조회 실패는 503으로 인증 중단. 전체 계정 세션 일괄 폐기·암호 변경 시 전체 기기 로그아웃은 미구현 |
| CSRF 요청 경계 | 쿠키는 브라우저가 자동으로 전송하므로 인증만으로 사용자의 쓰기 의도를 확인할 수 없다 | Spring BrowserOriginFilter에서 Origin/Fetch Metadata 검사. BFF 쿠키 쓰기는 Origin 필수. 서버 호출은 전용 비단순 헤더. spreadsheet export와 server actions도 경계 적용. Spring 기본 CSRF 토큰을 활성화한 것은 아님 |
| 자동 발행 선택 | 저장소에 들어온 미검토 초안을 배포가 일괄 발행할 수 있었다 | `posts/jay-blog/publish-manifest.txt`에 선택한 파일만 발행. 기본 목록은 비어 있으며 Kubernetes 호출 없이 종료 |
| 초안 운반 | 압축본 600KB 제한을 넘어 배포가 막혔고 단순 상향은 ConfigMap 한도를 해결하지 못한다 | Kubernetes exec로 emptyDir에 전달, SHA-256 검증 후 실행. 비루트 Job·300초 제한·raw 32MiB/archive 16MiB 제한. 별도 저장소 자격 증명 없음 |
| 기준 초기화 | 기준 해시가 없는 초안을 강제로 쓰면 운영 편집을 잃을 수 있다 | `/internal/content-sync/blog-posts/preview`는 글을 생성/갱신하지 않음. 동일 내용만 해시 반환. 다르면 conflict, 없으면 missing이며 해시를 주지 않음 |
| DB 복원 | 덤프 파일 존재나 목차 조회만으로 복구 가능성을 증명할 수 없다 | 기존 외부 사본으로 3 DB 실제 복원. 복원 스크립트에 읽기 전용 백업 마운트·120초 초기화 제한·첫 SQL/복원 오류 시 중단 추가 |

Redis의 noeviction은 메모리가 부족하면 쓰기를 거절한다. 인증 상태를 버리고 통과시키는 것보다
요청을 실패시키는 선택이며, 가용성 저하와 메모리·디스크 모니터링이 필요하다.
AOF/PVC는 장비 장애에 대한 외부 백업을 대신하지 않는다. 현재 전용 Redis는 단일 인스턴스이고
클러스터 내부 Redis 통신에 TLS를 적용하지 않았다.

공식 판단 근거:
- https://redis.io/docs/latest/develop/reference/eviction/
- https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html
- https://docs.k3s.io/security/secrets-encryption

## 로컬 검증

- Redis 테스트: 캐시와 보안 키 격리, 메모리 압박에서 키 보존/새 쓰기 거부,
  로그아웃 JWT 재사용 차단, 별도 발급 JWT 유지, 교차 Origin 및 Origin 없는 쿠키 요청 거부.
- 추가 검증: Redis 재시작 후 폐기 키 유지, Redis 응답 중단 시 인증 503.
- 전체 회귀의 최종 결과는 이 문서 아래 검증 결과에 기록한다.
- 초안 68편: 원문 1,671,103바이트, 새 번들 약 603KB. 기존 ConfigMap 전송은 사용하지 않는다.
- 빈 발행 목록에서 `scripts/publish-blog-drafts-k8s.sh`가 Kubernetes 호출 없이 종료함을 확인.
- 운영 Job 실행 및 실제 NetworkPolicy 효과는 아직 미검증이다.

### 장비 밖 사본 복원 증거

사용한 사본: `.local-backups/deploy-20260907T065924Z` (Git 제외).
실행: `scripts/rehearse-local-restore.sh .local-backups/deploy-20260907T065924Z`.
SHA-256 3개 일치. 임시 PostgreSQL 18 컨테이너에서 `pg_restore --exit-on-error` 성공 후 컨테이너 삭제.

| DB | 관찰된 행 수 | DB 복원 소요 |
|---|---|---|
| portfolio | article 89, revision 355, blog_post 64, post 100007, user 4 | 2.7초 |
| payment | payment 31, outbox 59 | 0.1초 |
| shipping | shipping 2, outbox 2 | 0.1초 |

이는 해당 사본의 복원 증거다. 운영 현재 행 수와 동일하다는 뜻도, 전체 서비스 RTO 측정도 아니다.
이번 사본의 MinIO tar는 내부 저장 형식이므로 일반 파일처럼 풀어 업로드하면 안 된다.
실제 MinIO 복원 및 앱에서 이미지 조회, 설정/암호화 키 복구는 아래 미완료 항목이다.

## 다음 에이전트의 운영 전환 순서

### 1. 접근과 배포 준비

1. 사용자가 `cloudflared access login https://ssh.leneu.cloud`로 인증한 뒤 `ssh miniPC` 연결을 확인한다.
   인증이 막힌 상태에서 다른 경로로 우회하지 않는다.
2. 현재 브랜치와 `git status`를 확인하고 기존 블로그 초안 수정은 별도 변경으로 보존한다.
3. `.claude/skills/deploying/SKILL.md`, `docs/deploy-runbook.md`를 읽는다.
   main 머지는 자동 운영 배포이므로 사용자에게 배포라는 점을 명시하고 확인한다.
4. 운영 image digest, replicas, Helm values, NetworkPolicy, 서비스 연결 상태를 읽기 전용으로 대조한다.
   Secret 값·kubeconfig·JWT·개인정보는 로그나 문서에 출력하지 않는다.

### 2. Redis 전환 — 빈 인스턴스로 바로 바꾸지 않는다

준비 스크립트 `scripts/prepare-security-redis.sh`는 data Secret 생성, backend에 같은 Secret 복사,
전용 Redis 배포/준비 확인까지만 한다. 앱은 전환하지 않는다. 저장소 루트에서 실행한다.
`infra/k8s/backend/security-redis-client-patch.yaml`은 별도 patch이며 단독 apply 문서가 아니다.

전환 전에 반드시:

1. 기존 Redis의 실제 버전·DB 번호·키 prefix·TTL·보안 키 자료형을 확인한다.
   `AdminTotpService`, `BoardRateLimitInterceptor`, `TokenRevocations`의 prefix와 대조한다.
2. 기존 보안 키가 갱신되는 동안 단순 복사하면 경쟁 조건이 생긴다. 원래 replica 수를 기록하고
   백엔드 쓰기를 중지한 유지보수 구간에서 TTL을 보존해 보안 키를 이전한다.
   여기서 유지보수 구간은 운영 전환을 위한 일시 중단이며, 사용자 요청에서 제외한 코드 유지보수와 별개다.
3. 이전 도구는 아직 구현하지 않았다. source GET+PTTL을 원자적으로 읽고 대상 SET NX PX로
   저장하는 방식 등으로 만료와 덮어쓰기를 다룬다. 버전이 다른 Redis 간 DUMP/RESTORE 호환을 가정하지 않는다.
   만료된 키는 건너뛰고, 키 이름/IP/값 대신 개수·TTL 범위만 증거로 남긴다.
4. 이전 pod가 backend 네임스페이스와 `app: jaywiki` 정책을 만족하도록 한시적으로 허용하고 끝나면 삭제한다.
5. 새 앱 버전이 배포된 상태에서 전용 Redis patch를 적용한다. REQUIRED=true·host·password 세 가지 확인.
   REQUIRED=false이고 host가 비어 있으면 로컬 호환을 위해 기존 Redis를 사용하므로, 이것을 분리 완료로 보고하지 않는다.
6. 정상 로그인·OTP 재사용 거절·게시판 제한·로그아웃 JWT 재사용 거절·Redis 중단 시 거절을 확인한다.
7. 성공 후 환경값을 정식 deployment 설정에 반영해 다음 배포에서 유지되게 한다.
   현재 overlay는 배포 파이프라인에서 자동 적용하지 않는다.

롤백: 새 저장소에서 생긴 폐기/OTP 상태를 기존 저장소로 되돌리지 않고 앱만 되돌리면 보안 상태를 잃는다.
역방향 이전 또는 JWT 전체 무효화와 OTP 유효 구간 대기 등 별도의 안전한 계획을 먼저 만든다.
두 Redis의 비밀번호·PVC를 성급히 삭제하지 않는다.

### 3. 기준 해시와 발행

새 preview endpoint가 있는 서버에, 기존 내부 싱크 인증 전달 방식을 사용해 실행한다.
토큰을 CLI 인수나 문서에 적지 않는다.

```bash
node scripts/publish-blog-drafts.mjs --initialize-baselines --write posts/jay-blog/drafts/<검토한파일>.md
```

`--write`는 이 모드에서 **로컬 초안 해시 기록**을 뜻하며 운영 글은 쓰지 않는다.
conflict/missing이면 중단하고 본문·태그·날짜·시리즈를 대조한다. 최신 해시를 강제로 붙여 재시도하지 않는다.
각 초안의 비교/기록은 순차 처리하므로 뒤에서 충돌하면 앞에서 기록한 동일 글 해시는 남는다.
성공 후 초안 diff를 확인하고 의도한 파일만 publish-manifest에 추가한다.
Job 안에서 반환된 다음 해시는 저장소로 돌아오지 않으므로 이후 로컬 기준 재수집이 필요하다.

### 4. 남은 인프라 보안 — 미완료

| 작업 | 목적 | 다음 행동 / 완료 증거 |
|---|---|---|
| MinIO·설정 복구 | DB만 살아나고 이미지/자격 증명이 없어 서비스가 멈추는 실패 방지 | 운영과 격리된 동일 호환 버전 MinIO에 사본 복원. 실제 객체 읽기와 앱 이미지 확인. Secret/설정은 암호화된 외부 사본으로 복구 |
| 최신 외부 사본·일정 | miniPC 자체 고장/분실에 대비 | 3 DB·객체·설정·암호화 키의 최신 사본 생성, 보존 주기와 실패 알림, 실제 RPO/RTO 기록 |
| k3s Secret 저장 암호화 | 디스크/etcd 사본만으로 Secret 평문이 노출되는 위험 감소 | 현재 버전·`secrets-encrypt status` 확인, 복구 가능한 키/데이터 사본 확보, 공식 버전별 절차로 활성화·기존 Secret 재암호화 검증 |
| 배포 runner RBAC | CI 침해가 곧 cluster-admin 권한 탈취가 되는 영향 제한 | bootstrap과 일상 배포 분리. deploy.yml의 Helm/RBAC/Secret/Job/exec 요구 권한 목록화, 전용 SA 정상 배포·범위 밖 조작 거절 확인. Job 생성권도 Secret 탈취 경로가 될 수 있음 |
| 데이터 서비스 인증 | 클러스터 내부 접근 성공만으로 데이터 조작을 허용하는 위험 감소 | Redis 캐시·OpenSearch의 실제 설정 확인. OpenSearch TLS/인증/최소 권한 계정과 Spring 클라이언트 변경을 같이 준비. 보안 플러그인만 켜서 검색을 깨뜨리지 않음 |
| 외부 경계 | LAN에서 닫혀 보여도 다른 경로로 공개될 수 있음 | Cloudflare Access/WAF·Tailscale ACL·호스트 firewall·IPv6 대조. 실제 외부망에서 허용/거절 증거 확보 |
| 배포 후 통합 검증 | 로컬 통과와 운영 설정의 차이를 확인 | 로그인·편집·발행·익명 댓글·export 정상 흐름, 잘못된 Origin/누락 Origin 거절, 재사용 JWT 거절, 이미지 스캔 Actions 실제 성공 |

신뢰 경계: Next 앞의 ingress가 forwarded protocol/host를 덮어쓰고 Spring은 내부 경로로만 접근 가능해야 한다.
`X-Jaywiki-Request`는 인증 비밀이 아니라 브라우저의 단순 교차 출처 요청을 구별하는 표식이다.
Origin 검사만으로 curl 같은 임의 클라이언트의 권한을 검증하지 않는다.

## 제외한 유지보수

사용자 흐름 E2E 전반 확장, 테스트 수 자동 문서화, 위키 원고 분리는 이번 범위에서 제외했다.
보안 회귀 테스트와 기존 호출부의 Origin 전달 수정만 수행했다.

## 검증 결과

- 전체 Spring 회귀: 289개, 실패·오류·skip 0. 이후 프록시 처리 회귀 테스트 1개를 추가했다.
  Spring `ForwardedHeaderFilter`가 헤더를 소비한 뒤의 서버명/포트를 쓰도록 실제 BFF 연동에서 수정했다.
  마지막 수정 후 관련 Spring 30개 테스트도 실패·오류·skip 0으로 통과했다.
- Web: 147개 통과. 타입 검사 통과, lint 오류 0·기존 경고 7.
- 발행 스크립트 자기검사 8개. 격리 HTTP 서버로 preview 경로만 호출하는지,
  동일 본문 해시 기록과 conflict/missing 시 파일 불변을 확인했다.
- 번들: 선택 파일만 포함, 경로 탈출·중복·심볼릭 링크 거절, 빈 목록 무동작 확인.
  kubectl 대역으로 Job YAML·체크섬·바이트 전송·ready marker·종료 정리도 확인했다. 실제 클러스터 검증은 아니다.
- 시드 dry-run·로컬 동기화·consistency·export 통과. 위키 원고/export 변경 없음.
- Spring 재기동 후 health 200. Spring 직접 호출 및 실제 Next BFF에서 동일 Origin 로그아웃 200,
  교차 Origin 403, BFF Origin 없는 쿠키 요청 403 확인.
- 실행 로그는 `/tmp/jaywiki-security-*.log`에 있다. 민감한 백업 원본은 저장소에 추가하지 않았다.
