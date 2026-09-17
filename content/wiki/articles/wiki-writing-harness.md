

- 이 위키에 글 한 편을 쓰면 진입부터 운영 화면까지 실제로 무엇이 어떤 순서로 도는가?
- 기계가 잡는 것은 문법·백틱·참조 무결성뿐이라 그 검사를 로컬과 클러스터에서 같은 스크립트로 두 번 돌리고, 나머지는 사람 판단과 명시적 승인에 두기로 했다.
- develop → main 머지가 deploy.yml 268행에서 sync-wiki-content-k8s.sh 를 부르고, 클러스터 Job 이 시드를 --allow-remote-write 로 실행해 사람 손 없이 화면에 반영되는 것을 확인했다.

jay-wiki 산출물의 절반은 코드가 아니라 글이다. 코드는 타입 검사와 테스트로 걸러지고 그 구조는
[AI 에이전트와 jay-wiki를 개발한 방식](/wiki/ai-assisted-development-harness)에 있다.
글은 다르다 — 컴파일되지 않고, 틀린 문장은 아무 오류도 내지 않는다. 그래서 글에는 별도의
파이프라인이 있다. 이 글은 그 파이프라인을 글 한 편이 지나는 순서 — 진입, 작성, 기계 검사,
사람, 배포 — 대로 짚는다. 다 읽고 나면 글을 쓰면 무엇이 어떤 순서로 돌고, 잘못되면 어느
단계에서 죽는지가 남아야 한다.

~~~mermaid
flowchart TB
  Entry["진입<br/>CLAUDE.md → wiki-writing 스킬 → 가이드"] --> Write["작성<br/>scripts/seed-portfolio-wiki.mjs 편집"]
  Write --> Check["기계 검사<br/>node --check · dry-run · 일관성 검사"]
  Check -->|걸리면| Dead["throw 또는 exit 1<br/>운영까지 못 간다"]
  Check -->|통과| Human["사람<br/>kind 판정 · diff 리뷰"]
  Human -->|고쳐 쓰기| Write
  Human -->|develop → main 머지| Deploy["deploy.yml 이<br/>sync-wiki-content-k8s.sh 를 부른다"]
  Deploy --> Job["클러스터 일회성 Job<br/>시드를 --allow-remote-write 로 실행"]
  Job --> Prod[("운영 PostgreSQL → 화면")]
~~~

## 진입 — 맥락 없는 새 세션도 같은 문을 순서대로 지난다

파이프라인의 첫 단계는 검사가 아니라 규칙을 만나는 경로다. CLAUDE.md 가 글 작업 전에
스킬을 열라고 지시한다 — 위키 글은 wiki-writing, 블로그 글은 blog-writing. 그리고 스킬의
첫 지시가 docs/wiki-writing-guide.md 를 먼저 읽으라는 것이다. 규칙 문서는 있어도 안 읽으면
없는 것과 같아서, 읽는 것 자체를 사슬로 만들었다.

스킬은 가이드의 요약이 아니다. 가장 자주 깨진 규칙 넷만 강제한다 — 가이드를 읽기 전에
시드를 편집하지 않는다, String.raw 본문에 백틱을 쓰지 않는다, 탭을 지우기 전에 글을 먼저
옮긴다(시드는 upsert 라 DB 를 자동 삭제하지 않는다), 쓰고 나서 dry-run 과 일관성 검사를
돌린다. 넷 다 실제 사고에서 나온 항목이다. 에이전트가 맥락 없는 새 세션에서 시작해도
같은 문을 같은 순서로 지난다 — 이 파이프라인이 사람의 기억에 기대지 않는 이유가 이
사슬이다.

같은 사슬을 글 밖으로도 넓혔다. 2026-08-13 에 배포에도 같은 모양을 깔았다 — deploying
스킬이 배포·서버에 반영 같은 트리거를 잡고, docs/deploy-runbook.md 가 명령이 들어간 순서를
갖는다. 그러면서 사슬의 약한 곳이 드러났다. 말에 걸려야 스킬이 열리므로, 꼭 막아야 하는
하나(main 직접 push)는 PreToolUse 훅으로 내려 말과 무관하게 돌게 했다. 자세한 것은
[배포 규칙과 하네스](/wiki/deploy-rules-and-harness)에 있다.

## 작성 — 정본은 시드 파일 하나다

위키 글의 정본은 scripts/seed-portfolio-wiki.mjs 한 파일이고, 운영 PostgreSQL 은 그
결과물이다. 새 글을 쓴다는 것은 이 파일의 배열에 항목 하나를 더하는 일이라, 모든 변경이
Git diff 한 장으로 보인다.

형식 규칙의 일부는 문서가 아니라 이 파일 상단 주석에 있다. 탭별 sortOrder 부여 규칙이
그렇다 — 축적형 탭(verification, retrospective)은 새 글이 0 을 받고 기존 글이 전부 1씩
밀리며, 나머지 탭은 읽기 순서형이라 흐름상 맞는 위치에 넣고 뒤를 민다. 규칙을 문서에 두면
안 읽고도 편집할 수 있지만, 작업 대상 파일 안에 두면 글을 추가하려고 파일을 여는 순간
규칙이 먼저 보인다.

글쓰기 규칙 자체 — 세 줄 요약, kind 별 본문 뼈대, 문체, 마크다운 함정 — 는 이 글의 주제가
아니다. 전부 docs/wiki-writing-guide.md 에 실패 사례와 함께 적혀 있고, 이 파이프라인에서
그 문서가 맡는 자리는 하나다. 작성 단계에서, 편집보다 먼저 읽히는 것.

## 기계 검사 — 로컬에서 세 겹이 돌고, 걸리면 여기서 죽는다

글을 다 쓰면 명령 셋을 차례로 돌린다. 스킬의 마지막 규칙이 바로 이것이라, 진입에서 걸린
사슬이 여기까지 끌고 온다.

첫 겹은 문법이다.

~~~
node --check scripts/seed-portfolio-wiki.mjs
~~~

본문은 String.raw 템플릿 안에 있어서, 백틱이 하나라도 들어가면 템플릿이 그 자리에서 끝나고
뒤의 Markdown 이 JavaScript 로 해석된다. 글 한 편의 오타가 아니라 시드 전체의 실행 불능이고,
백틱 사고는 이 첫 관문에서 걸린다.

둘째 겹은 dry-run 이다.

~~~
node scripts/seed-portfolio-wiki.mjs --dry-run
~~~

세 가지를 던진다. assertNoBacktick 은 본문에 백틱이 있으면 article body must not contain
a backtick 으로, assertUniqueSlugs 는 중복 slug 를 duplicate slug 로, parentId 가 TABS 에
없는 글은 article points at unknown tab 으로 — 셋 다 해당 slug 를 붙여 throw 한다.

던질 것이 없으면 dry-run 은 운영 응답을 실제로 받아 와 시드와 비교한다. 글마다 parentId,
parentId, title, summary, body, kind, tags, status, lastReview, tocEnabled, sortOrder 열 필드를 하나씩 대조해
전부 같으면 변경 목록에서 빼고, 마지막에 한 줄로 요약한다.

~~~
Dry run: 0 tab changes, 2 article changes, 0 extras   파일에서 2편을 고쳤다
~~~

여기서 extras 는 운영 DB 에만 있고 파일에 없는 글이다. 시드는 upsert 라 이런 글을 지우지
않고 보고만 한다 — 운영에서 직접 편집된 유일본을 시드가 말없이 지우는 사고를 막기 위해서다.
그리고 dry-run 은 이름 그대로 아무것도 쓰지 않는다.

셋째 겹은 운영과의 대조다.

~~~
node scripts/check-wiki-consistency.mjs
~~~

운영 API 인 portfolio.leneu.cloud 의 /api/bff/tabs 를 실제로 불러 시드와 맞춰 본다. 네 가지를
본다 — 유령 글(운영에 있는데 시드에 없는 글), 유령 탭, 대분류에 없는 탭, 시드의 parentId 가
seedTabs 에 없는 고아. 어긋나면 목록을 찍고 exit 1 로 끝나고, 없으면 어긋난 곳이 없다고 답한다.

시드에는 안전장치가 세 겹 더 있다. 원격 대상이 HTTPS 가 아니면 non-local seed target must
use HTTPS 로 exit 1 이다 — 예외는 하나뿐인데, 클러스터 내부 서비스 주소(.svc.cluster.local)에
내부 동기화 토큰이 함께 있을 때고, 뒤에 나올 배포 Job 이 바로 이 예외로 지나간다.

원격 쓰기는
--allow-remote-write 를 명시해야 하며, 그 거절 메시지가 태도를 그대로 말한다 — remote seed
writes require --allow-remote-write after reviewing --dry-run output. 관리자 자격증명도 내부
토큰도 없으면 역시 exit 1 이다. **지우거나 덮어쓰는 동작이 기본값에 하나도 없다는 것이 이
단계의 요점이다.** 걸리는 모든 경우가 쓰기 전에 죽고, 쓰려면 dry-run 을 봤다는 표시를
사람이 직접 남겨야 한다.

## 사람 — 기계가 못 보는 것이 남고, diff 에서 걸린다

기계 검사를 전부 통과해도 남는 것이 있다. kind 판정(이 글이 설명인가 사건인가 결정인가),
사실이 낡았는지, 문체, 화면에서 표가 넘치는지. 기계에 안 맡긴 이유는 하나가 아니다 —
kind 판정은 본문을 읽고 서사가 있는지를 가리는 일이라 grep 이 안 되고, 사실 검증은 대조할
정본이 저장소 밖(운영 DB, miniPC 의 설정 파일)에 있는 주장이 많아 기계가 닿는 범위부터 좁다.

실제로 2026-08-10 [사실검증](/wiki/wiki-fact-check-51-articles)에서 kind 오분류 16편을
걸러낸 것은 기계가 아니라 가이드의 판정 규칙이었다 — 전부 형식 검사를 통과한 글들이었다.
정본이 파일 하나라 이 판단이 일어나는 자리는 관리자 화면이 아니라 커밋 전의 diff 다.
관리자 화면에서 글을 고칠 수도 있지만 다음 시드 실행이 파일 버전을 변경 대상으로 잡으므로,
리뷰가 일어나는 곳은 화면이 아니라 diff 다.

## 배포 — 머지하면 그 시드가 클러스터 안에서 한 번 더 돈다

develop → main 머지가 배포다. deploy.yml 이 테스트와 빌드, 이미지 rollout 을 지나
콘텐츠 동기화 직전에 PostgreSQL 백업부터 뜬다 — 시드가 운영 DB 를 바꾸기 전의 마지막
안전판이다. 그 다음 .github/workflows/deploy.yml 268행이 scripts/sync-wiki-content-k8s.sh
를 부르고, 그 스크립트가 하는 일은 둘이다. 시드 파일 하나를 ConfigMap 으로 만들고,
backend 네임스페이스에 일회성 Job 을 띄운다. Job 이름은
jaywiki-content-sync-(커밋 SHA 앞 12자)다.

Job 안에서 도는 명령이 이 파이프라인의 마지막 문장이다.

~~~
node /sync/seed-portfolio-wiki.mjs --allow-remote-write
~~~

**로컬에서 dry-run 하던 바로 그 스크립트가 클러스터 안에서 한 번 더 도는 것이고, 대상만
운영 API 로 바뀐다.** 대상 주소는 JAYWIKI_API_BASE 로 넘어오는
http://jaywiki.backend.svc.cluster.local:8080 — 앞 절에서 말한 HTTPS 검사의 유일한 예외가
여기다.

내부 동기화 토큰이 Secret 에서 주입되므로 관리자 로그인 대신
/internal/content-sync/tabs 와 /internal/content-sync/articles 경로로 쓰고, 저장 요청의
editor 필드에는 gitops:커밋SHA 가 실린다. 이 변경이 사람 편집이 아니라 GitOps 실행이라는
것이 운영 이력에 그대로 남는다. 그리고 이 경로도 DB 를 직접 만지지 않는다 — 내부
컨트롤러가 관리자 화면과 같은 저장 로직(ArticleService.save)을 타므로, revision 스냅샷과
검색 색인이 우회되지 않는다.

Job 은 backoffLimit 0 이라 실패하면 재시도 없이 끝나고, activeDeadlineSeconds 300 이라
5분을 넘기면 죽는다. 배포 스크립트는 2초 간격으로 Job 상태를 지켜보다 성공이든 실패든
Job 로그를 워크플로 출력으로 끌어오고, 실패나 타임아웃이면 exit 1 로 배포를 깨뜨린다.
그리고 trap cleanup EXIT 로 끝나면서 Job 과 ConfigMap 을 지우고, 시작 전에도 한 번 지운다 —
같은 커밋을 다시 배포해도 이름이 겹쳐 죽지 않는다.

Job 이 성공하면 배포는 공개 화면 smoke 로 이어진다 — 첫 화면과 주요 API 를 curl 로 실제
호출해 200 이 아니면 배포를 실패로 만든다. 그래서 위키 글은 머지하면 사람 손 없이 화면에
반영된다. develop 까지만 가면 화면이 안 바뀌고, main 에 들어가야 이 Job 이 돈다. 블로그는
다르다 — 배포와 무관하고, 발행 스크립트를 사람이 돌린다.

## 가드레일마다 그것을 만든 실패가 있다

이 검사들은 설계에서 한꺼번에 나온 것이 아니다. assertNoBacktick 은 백틱 하나가 시드 전체를
ReferenceError 로 죽인 사고 뒤에 붙었고, --allow-remote-write 는 원격에 실수로 쓸 뻔한 뒤에
붙었다. 일관성 검사는 정본 없는 글 17편이 한 달 넘게 운영에 남아 있던 것이 발견된 뒤에
만들어졌다. 파이프라인의 단단한 자리마다 그 자리를 만든 사고가 하나씩 있다.

## 한계 — 이 파이프라인이 못 잡는 것

- 사실이 낡는 것. 글은 컴파일되지 않으니 틀린 문장은 아무 오류도 내지 않고, 다음 낡음은
  지금도 아무 검사에 안 걸린다.
- 문체와 읽히는가. 기계 검사의 영역 밖이다. 세 줄 요약의 형식(불릿 세 개, 문장 종결) 같은
  기계적인 부분까지 안 걸러지는 것은 결정이 아니라 아직 안 만든 것이다.
- 화면. vitest 가 node 환경이라 DOM 이 없어, 정렬·줄바꿈·넘침은 브라우저에서 눈으로 봐야 한다.
- 일관성 검사는 배포 파이프라인에 들어 있지 않다. 사람이 손으로 돌리고, 게이트로 넣을지는
  아직 정하지 않았다.
