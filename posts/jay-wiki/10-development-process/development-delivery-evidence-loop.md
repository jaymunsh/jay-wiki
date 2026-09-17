---
title: "요청을 코드가 아니라 운영 증거까지 연결하는 개발 루프"
slug: development-delivery-evidence-loop
tab: "개발 방식·AI"
parentId: development-process
sortOrder: 0
kind: wiki
tags: development-process,delivery,testing,visual-qa,documentation,operations
source: scripts/seed-portfolio-wiki.mjs
---
- 기능이 끝났다는 판단을 코드가 아니라 방문자가 보는 운영 화면과 증거로 내리는 개발 루프를 어떻게 돌리는가?
- push했다가 아니라 방문자가 보는 상태까지 같아야 완료로 보고, 위험과 영향 범위에 따라 검증 깊이를 조절하기로 판단했다.
- 집필 단계는 dry-run으로 diff를 보고, 운영 반영은 배포 속 시드 Job의 멱등 출력(Already in sync)으로 확인하며, 배포는 commit SHA image와 rollout status, 공개 HTTP smoke를 연결해 확인한다.

기능 구현이 끝났다는 말은 여러 의미를 가진다. 코드는 작성됐지만 테스트가 없을 수 있고, 로컬에서는 보이지만 모바일에서 깨질 수 있으며,
Git에는 반영됐지만 운영 DB와 배포 image는 이전 상태일 수 있다.

jay-wiki는 이 간극을 줄이기 위해 요청을 받은 순간부터 방문자가 운영 화면에서 결과를 확인할 때까지를 하나의 개발 루프로 관리한다.
이 글이 설명하는 것은 특정 도구 사용법이 아니라 **변경을 완료했다고 판단하는 과정**이다. 변경 범위, 실패 경계와 검증 증거를
남겨 다음 작업과 면접 설명에서 같은 판단을 재현하는 것이 목적이다.

## 요청에서 운영 smoke까지 한 루프로 잇는다

~~~mermaid
flowchart TB
  Request[요청과 의도] --> Explore[코드·DB·운영 상태 조사]
  Explore --> Scope[변경 범위와 완료 조건]
  Scope --> Implement[작은 구현]
  Implement --> Test[자동 테스트]
  Test --> Visual[브라우저·모바일 QA]
  Visual --> Docs[문서·상태·export 갱신]
  Docs --> Diff[Git diff 검토]
  Diff --> Deploy[CI·SHA rollout]
  Deploy --> Smoke[운영 smoke와 기록]
  Smoke --> Learn[남은 위험과 다음 개선]
~~~

각 단계가 항상 같은 크기인 것은 아니다. 문구 한 줄은 전체 운영 배포가 필요하지 않을 수 있지만, 인증·DB·공통 UI처럼 영향 범위가 넓은
변경은 뒤 단계까지 생략하지 않는다.

## 1. 먼저 요청을 동작으로 바꾼다

“더 안전하게”, “직관적으로”, “자동화하자”는 말만으로 구현을 시작하지 않는다. 누가 어떤 상황에서 무엇을 해야 하는지, 실패하면 무엇이
보여야 하는지로 바꾼다.

이번 콘텐츠 동기화의 요구도 “TOTP를 매번 주지 않기”가 아니었다.

- 운영 관리자 인증은 약해지지 않아야 한다.
- Git에서 검토된 글만 자동 반영해야 한다.
- DB revision과 검색 색인 같은 기존 저장 규칙을 유지해야 한다.
- token은 대화와 runner 로그에 나타나지 않아야 한다.
- 실패하면 backup과 재실행 경로가 있어야 한다.

이렇게 완료 조건을 먼저 쓰면 편리하지만 위험한 관리자 우회와 제한된 GitOps 경로를 구분할 수 있다.

## 2. 저장소가 가르치는 기존 경계를 먼저 읽는다

새 추상화를 만들기 전에 controller, service, seed, workflow, manifest와 상태 문서를 함께 확인한다. jay-wiki의 article 저장은 단순 DB upsert가
아니라 revision snapshot, MinIO 자산 연결과 OpenSearch event를 포함한다. 이 사실을 모르고 SQL 동기화를 만들면 기능은 빨리 끝나도 기존
계약을 깨뜨린다.

따라서 인증 입구만 새로 만들고 저장은 기존 ArticleService와 TabService를 재사용했다. 구현량보다 책임 경계를 유지하는 쪽을 선택했다.

## 3. 실패하는 검증을 먼저 만든다

보안 경계는 정상 요청만 확인하면 부족하다. 먼저 token 미설정, 누락과 오입력이 모두 실패하고 service가 호출되지 않는 테스트를 만들었다.
이후 정상 token만 저장할 수 있게 최소 구현을 추가했다.

이 글의 초판은 “영향 범위에 맞는 테스트”라는 정성 기준까지만 말했는데, 지금은 그 기준에 숫자가 붙었다. Spring 테스트 198개,
web 테스트 110개, tsc 통과, lint 경고 정확히 8개 — 경고가 하나만 늘어도 빌드가 깨진다. 기준이 바뀐 게 아니라 조여진 것이다.

프론트 변경은 화면을 눈으로 한 번 보는 데서 끝내지 않는다. 데스크톱과 390px 모바일에서 제목·표·시간·Mermaid가 잘리지 않는지,
페이지 가로 폭과 console 오류를 함께 확인한다.

## 4. 문서도 변경 산출물에 포함한다

구현과 문서를 나중에 따로 맞추면 실제 상태가 달라진다. 변경할 때 다음 문서의 역할을 구분해 함께 갱신한다.

| 기록 | 역할 |
|---|---|
| 진행상황 | 시간순으로 무엇을 바꾸고 어떻게 검증했는지 |
| current project status | 현재 구현·검증·보류 상태 |
| 상세 runbook | 운영자가 실행할 명령과 실패 대응 |
| 공개 위키 글 | 방문자가 읽을 목적·판단·결과·한계 |
| Markdown export | seed 기준 콘텐츠를 Git에서 검토하는 snapshot |

내부 runbook을 그대로 공개하지 않는다. 같은 사실을 실행자와 방문자의 필요에 맞게 분리한다.

다만 이 표의 마지막 행이 지금은 지켜지지 않는다.

- 예전 서술 ~~Markdown export를 변경 산출물에 함께 갱신한다~~
  - 2026-08-13 정정: export가 시드를 못 따라가고 있다. posts/jay-wiki/는 md 49편에
    마지막 갱신이 2026-08-10(커밋 f75a0c3)인데, 시드는 63편이고 2026-08-13까지 계속 바뀌었다.
    디렉터리 이름도 옛 탭 구조(05-observability, 11-ai-usage, 14-roadmap)라 현재 12탭과 어긋난다.

이 글이 세운 완료 기준을 이 저장소가 export 쪽에서 지키지 못하고 있다.

## 5. 상태가 여러 곳에 있다면 끝에서 다시 맞춘다

이 프로젝트의 변경은 Git 파일 하나로 끝나지 않는다. 위키 콘텐츠는 seed, 로컬 PostgreSQL, Markdown export와 운영 PostgreSQL에 걸쳐 있고,
애플리케이션은 source, container image와 k3s Deployment에 걸쳐 있다.

콘텐츠 반영 절차는 초판과 달라졌다.

- 초판 서술 ~~콘텐츠는 dry-run으로 diff를 보고, write 뒤 다시 dry-run해 0 changes를 확인한다~~
  - 2026-08-13 정정: 운영 반영 경로에는 dry-run이 없다. 배포가 클러스터 안 Job으로 시드를
    --allow-remote-write로 한 번 실행하고 끝이며, 재-dry-run 단계가 없다. 0 changes 확인은
    사람이 보는 단계가 아니라 시드 자체의 멱등 출력(Already in sync)으로 대체됐고,
    사람이 도는 dry-run은 집필 절차에만 남았다.

시점이 재미있다 — 이 자동화(커밋 bdece27)는 2026-07-22 머지로, 이 글의 검토일 2026-07-21 바로
다음 날이다. 검토 시점엔 맞았고 하루 뒤 낡았다. 완료 판정을 증거로 내리자는 글이 스스로 그 증거의
유통기한을 보여준 셈이다.

배포는 commit SHA image, rollout status와 공개 HTTP smoke를 연결한다. “push했다”가 아니라 방문자가 보는 상태까지 같아야 완료다.
이 원칙은 지금 브랜치 규율로 명문화됐다 — 작업은 전부 develop에 모으고, develop → main 머지가 곧 배포다. 위키 글은 배포가 시드를
자동 실행하므로 두 번 머지해야 완료다. develop까지만 가면 화면이 안 바뀐다.

상태 일치를 사람 눈에만 맡기지도 않는다. check-wiki-consistency.mjs가 운영과 시드의 유령 글·유령 탭·고아 parentId를 잡고 어긋나면
비영으로 끝난다. 다만 ci에도 deploy에도 연결돼 있지 않아 사람이 돌려야 한다.

## Definition of Done — 질문마다 최소 증거를 붙인다

| 질문 | 최소 증거 |
|---|---|
| 요구를 충족했나 | 사용 장면과 실패 조건이 구현 결과와 일치 |
| 기존 기능을 깨지 않았나 | 영향 범위에 맞는 자동 테스트 통과 — 기준선은 Spring 198개·web 110개·lint 경고 8개 |
| 사용자가 볼 수 있나 | 실제 브라우저와 반응형 화면 확인 |
| 운영할 수 있나 | Secret·backup·rollback·관측 경계 확인 |
| 설명할 수 있나 | 목적·선택·검증·한계를 문서화 |
| 상태가 일치하나 | DB·export·image·공개 경로의 최종 확인 |

## 검증 깊이는 전부 돌거나 아예 안 도는 두 갈래다

모든 작은 변경에 전체 절차를 적용하면 속도가 느려진다. 그래서 위험과 영향 범위에 따라 검증 깊이를 조절한다 — 다만 이 조절은
파이프라인 안에서는 성립하지 않는다. 배포의 verify 잡은 변경 범위와 무관하게 항상 전 스택을 돈다. 조절은 대신 경로 필터로
이루어진다. docs/나 posts/ 전용 커밋은 배포 자체가 안 걸린다. 깊이를 단계별로 고르는 게 아니라, 전부 돌거나 아예 안 도는
두 갈래다. PR에는 별도 ci.yml이 spring·web·payment-api·shipping-api 4잡으로 돌지만 partner-simulator만 CI에 빠져 있다.

현재는 개인 프로젝트라 코드 리뷰의 독립성이 제한된다. AI 에이전트가 조사와 검증을 도울 수 있지만 최종 범위와 공개 정보, 운영 반영 판단은
사람이 맡는다. 그리고 이 글 자체가 한계의 사례다 — Markdown export는 이 글의 DoD 마지막 행을 통과하지 못하고 있고, 상태 일치 검사는
도구는 있지만 파이프라인에 묶이지 않았다. 앞으로는 변경 유형별 checklist와 실패율, lead time을 기록해 절차가 실제 품질에 기여하는지
확인할 필요가 있다.
