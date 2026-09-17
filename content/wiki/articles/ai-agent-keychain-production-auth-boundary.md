
- AI 에이전트가 운영 관리자 비밀번호를 대화, 파일, 로그 어디에도 남기지 않고 운영 콘텐츠 반영을 실행하게 만든 방법이다.
- 비밀번호는 macOS Keychain에서 실행 순간에만 읽고 TOTP와 write 승인은 사람이 유지해, Secret 값과 실행 절차와 최종 승인을 분리하기로 판단했다.
- dry-run에서 신규 글 5편과 보존할 extra 18개를 확인하고 현재 TOTP로 write를 승인해 5편을 생성한 뒤, 재-dry-run의 change 0과 공개 글 HTTP 200으로 검증했다.

AI 에이전트가 코드 수정뿐 아니라 운영 배포와 데이터 동기화까지 맡기 시작하면 곧 Secret 문제가 생긴다.
에이전트가 매번 관리자 비밀번호를 물으면 작업 흐름이 끊긴다. 그렇다고 비밀번호를 대화, .env, shell history나 저장소 문서에
남기면 편의를 위해 인증 경계를 없애는 셈이다.

jay-wiki는 처음 이 문제를 **비밀번호는 macOS Keychain에서 실행 순간에만 읽고, TOTP와 실제 write 승인은 사람이 제공하는 방식**으로
정리했다. 지금은 이 경로를 운영자의 수동 편집·복구용으로 유지하고, Git에서 검토된 기준 콘텐츠는 제한된 내부 GitOps Job으로
동기화한다.

## 계기: 운영 글 5편을 동기화하려다 멈췄다

MinIO publication과 애플리케이션 배포를 마친 뒤 운영 PostgreSQL에 신규 위키 글 5편을 seed하려 했다.

dry-run은 탭 변경 0건, 신규 글 5편과 보존할 운영 전용 항목 18개를 정상적으로 보여줬다. 그러나 write 단계에서 에이전트는 현재
관리자 비밀번호를 알 수 없었다. 기본값을 추측한 로그인은 401로 거절됐고, Cloudflare Access가 보호하는 SSH도 인증 세션이 만료돼
Kubernetes Secret을 직접 읽을 수 없었다.

이 실패에서 얻은 결론은 “에이전트에게 비밀번호를 알려주자”가 아니었다.

> 에이전트가 Secret 값을 알 필요는 없지만, 승인된 로컬 자격 증명을 일관된 이름으로 사용할 방법은 필요하다.

## 비교한 선택지 — Keychain 이 권한과 비용의 균형점이었다

| 방식 | 장점 | 제외하거나 제한한 이유 |
|---|---|---|
| 저장소 .env | 구현이 가장 단순하다 | 평문 파일, 백업·동기화·오첨부와 실수 커밋 위험이 있다 |
| shell profile 환경변수 | 여러 명령에서 바로 읽는다 | 자식 프로세스와 진단 출력에 전파되고 교체 시점을 놓치기 쉽다 |
| 대화에 매번 전달 | 별도 구현이 없다 | 대화 기록에 Secret이 남고 사용자 개입이 반복된다 |
| 운영 Secret 직접 조회 | 서버가 SoT가 된다 | SSH Access가 필요하고 조회 권한 자체가 더 강한 경계다 |
| macOS Keychain | OS 암호화 저장소와 접근 통제를 사용한다 | 해당 Mac과 로그인 세션에 종속되며 최초 등록은 사람이 해야 한다 |

개인 개발 장비 한 대에서 동작하는 운영 도구라는 범위에는 Keychain이 가장 작은 권한과 적은 운영 비용의 균형점이었다.

## 인증 흐름은 세 스크립트로 역할을 나눴다

~~~mermaid
flowchart TB
  Human[사람] -->|최초 등록 또는 변경| Keychain["macOS Keychain<br/>jay-wiki-production-admin"]
  Agent[AI 에이전트] --> Wrapper[seed-production-wiki.sh]
  Wrapper -->|실행 순간 조회| Keychain
  Wrapper -->|기본 동작| DryRun[운영 diff dry-run]
  Human -->|현재 6자리 + write 승인| Wrapper
  Wrapper -->|password + 일회성 TOTP| API[Next.js BFF / Spring auth]
  API --> DB[(운영 PostgreSQL)]
~~~

역할은 세 스크립트로 나눴다.

| 스크립트 | 책임 |
|---|---|
| store-production-admin-password.sh | 현재 서비스 관리자 비밀번호를 Keychain에 최초 등록하거나 갱신 |
| seed-production-wiki.sh | 기본 dry-run, 명시적 write에서만 현재 TOTP 입력과 seed 실행 |
| rotate-production-admin-password.sh | Kubernetes Secret 갱신, backend rollout 성공 후 Keychain 교체 |

DB 비밀번호, MinIO root 계정이나 TOTP seed는 이 흐름에 포함하지 않는다. Keychain account는 웹 서비스 관리자 admin이고,
서버에서는 backend/jaywiki-secrets.APP_ADMIN_PASSWORD와 대응한다.

## 왜 TOTP는 저장하지 않았나

비밀번호만 Keychain에 저장하고 TOTP seed는 Google Authenticator에 남겼다. 완전 자동화만 생각하면 TOTP seed까지 로컬에 저장해 6자리 코드를 생성할 수 있다. 하지만 그러면 같은 장비와 프로세스가 1차 인증과
2차 인증을 모두 소유한다. 편리해지는 대신 두 요소의 분리가 사라진다.

현재 정책은 다음과 같다.

- dry-run은 TOTP 없이 누구나 읽을 수 있는 운영 상태만 비교한다.
- 실제 write는 명시적인 --write와 현재 TOTP를 함께 요구한다.
- TOTP는 환경에 잠시 전달되고 프로세스 종료와 함께 폐기한다.
- TOTP seed, 현재 코드와 비밀번호는 로그·문서·Git에 기록하지 않는다.

따라서 AI는 반복 가능한 절차를 실행하지만, 운영 변경 시점의 승인은 사람이 유지한다.

## 비밀번호 변경도 한 작업으로 묶었다

서버 Secret만 바꾸면 다음 자동화에서 Keychain의 옛 비밀번호를 사용한다. 반대로 Keychain만 바꾸면 운영 로그인에 실패한다.

회전 스크립트는 다음 순서를 고정한다.

1. 새 비밀번호와 확인 값을 숨김 입력으로 받는다.
2. 8자 이상과 두 입력 일치를 확인한다.
3. Kubernetes Secret의 APP_ADMIN_PASSWORD를 패치한다.
4. backend를 재시작하고 rollout 완료를 기다린다.
5. 앞 단계가 성공한 뒤에만 Keychain을 새 값으로 갱신한다.

Spring의 AdminPasswordBootstrap이 시작 시 평문 Secret을 BCrypt로 바꿔 관리자 row와 동기화하므로 PostgreSQL 해시를 직접
수정하지 않는다. 서버 반영 실패 시 로컬 Keychain도 바꾸지 않아 두 상태가 엇갈리는 범위를 줄였다.

## 비대화형 실행은 TTY 가 없어 osascript 로 받는다

첫 구현은 shell의 read -s만 사용했다. 일반 Terminal에서는 동작하지만 에이전트가 실행하는 비대화형 command에는 stdin TTY가
없어 안내도 없이 즉시 종료됐다.

현재 스크립트는 TTY가 있으면 터미널 숨김 입력을, 없으면 macOS osascript의 hidden-answer dialog를 사용한다. 사용자는 같은
명령을 실행해도 환경에 맞는 안전한 입력창을 받는다.

운영 seed 중에는 Node의 network family auto-selection이 Cloudflare IPv4·IPv6 연결을 동시에 시도하다 timeout을 내는 현상도
확인했다. 전역 네트워크 설정을 바꾸지 않고 seed 프로세스에만 auto-selection 비활성화와 IPv4 DNS 우선순위를 적용해 public API
HTTP 200을 재검증했다.

## 검증 — no-op 재실행과 방문자 경로까지 확인했다

Keychain 등록 뒤 다음 순서로 운영 반영을 확인했다.

1. password 값을 출력하지 않고 Keychain entry 존재만 확인했다.
2. dry-run에서 0개 탭, 신규 글 5편과 보존할 extra 18개를 확인했다.
3. 현재 TOTP로 write를 승인해 5편을 생성했다.
4. 재-dry-run에서 tab change 0, article change 0을 확인했다.
5. 다섯 공개 글이 HTTP 200이고 LLM 글의 MinIO 파일 링크 4개가 포함됐는지 확인했다.

인증 성공만으로 완료하지 않고 변경 대상, no-op 재실행과 방문자 경로까지 검증했다.

## 현재 경계 — 이 방식은 이 Mac 밖으로 복제하지 않는다

- macOS Keychain은 이 Mac의 로그인 계정에 종속된다. 다른 runner나 서버에는 같은 방식을 그대로 복제하지 않는다.
- Keychain 접근 허용 정책과 장비 잠금이 약하면 로컬 사용자 경계도 약해진다.
- Cloudflare Access 세션이 필요한 비밀번호 회전은 완전 무인 작업이 아니다.
- 관리자 UI와 범용 ADMIN API write는 계속 비밀번호와 TOTP를 요구하며 사람 없는 CI에 넣지 않는다.
- 검토된 tab·article upsert만 별도 machine token과 내부 ClusterIP endpoint로 분리했다. 이 token은 관리자 세션을 만들지 못한다.
- 배포 Job은 Kubernetes Secret을 Pod에 직접 주입받으며 runner와 AI 대화에는 값을 노출하지 않는다.
- 향후 여러 운영자가 생기면 개인 Keychain보다 팀용 Secret manager와 감사 로그를 검토해야 한다.

## 결론 — Secret 값, 실행 절차와 최종 승인을 분리한다

AI 운영 자동화에서 중요한 것은 Secret을 더 잘 기억하게 하는 일이 아니라
**Secret 값, 실행 절차와 최종 승인을 분리하는 것**이다. 수동 운영은 Keychain과 TOTP로 승인하고, 기준 콘텐츠 배포는
Git review를 승인 지점으로 삼아 제한된 Job이 수행한다. 두 경로 모두 AI 에이전트가 비밀번호나 token 값을 대화와 저장소에
소유하지 않도록 유지한다.
