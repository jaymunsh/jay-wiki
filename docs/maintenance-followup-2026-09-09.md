# 유지보수 후속 — 2026-09-09

> **최신 상태:** 이 문서는 당시 구현 이력이다. 이후 실제 운영 전환·복원·외부 검사 결과는 [9월 10일 운영 기록](security-operations-2026-09-10.md)을 따른다. 아래 미완료 표기를 현재 남은 작업으로 중복 집계하지 않는다.

사용자가 보안 후속의 유지보수 항목까지 마무리하고 블로그 글에 기록하도록 요청했다.
보안 운영 전환은 [2차 보안 기록](security-phase2-2026-09-09.md)의 미완료 목록을 유지한다.

## 위키 원고 분리

- 원본: `content/wiki/articles/<slug>.md` 89편과 `content/wiki/manifest.json`.
- 실행 코드: `scripts/seed-portfolio-wiki.mjs`, 공통 로더: `scripts/lib/wiki-source.mjs`.
- 시드·export·일관성·고아 문서·가이드북 링크 검사가 모두 같은 로더를 사용한다.
- 기존 JavaScript 문자열을 평가해 얻은 분리 전 스냅샷과 분리 후 자료를 비교했다.
  89개 본문과 전체 메타데이터 deep equality 통과. 본문 개행도 보존했다.
- 시드 dry-run 변경 0, 로컬 반영 변경 0, 11탭/89편 consistency 통과, `posts/jay-wiki` export diff 0.
- 배포 파일 생성기 `scripts/build-wiki-seed.mjs`는 모든 원고를 단일 mjs에 포함한다.
  번들 자체를 임시 디렉터리에서 `--dry-run`으로 실행해 변경 0 확인.
  ConfigMap 크기 검사는 로더 코드만이 아닌 전체 번들(압축 약 296KB)을 검사한다.
- deploy 경로 필터에 `content/wiki/**`를 포함했다. 원고만 고쳐도 기존 위키 발행 과정이 실행된다.
- 로더 테스트에서 백틱·`${...}` 보존, 중복·경로 탈출·없는 대표 글·심볼릭 링크 거절 확인.

## 테스트 수 자동 기록

```bash
python3 scripts/update-test-summary.py
```

전체 Spring/Vitest를 직접 실행하고 성공한 경우에만 `web/src/data/test-summary.json`과
`docs/test-summary.md`를 갱신한다. 부분 실행 보고서를 임의로 가져와 전체 수치로 기록하는 옵션은 없다.
포트폴리오 화면은 JSON의 합계를 읽고, CLAUDE.md는 생성 문서를 가리킨다.
Python 서비스와 브라우저 테스트는 이 숫자에서 제외하며 화면에도 Spring/웹 범위를 표시한다.

CI는 전체 실행 보고서의 수와 스냅샷을 비교한다. 바뀌면 갱신 명령 실행이 필요하다고 실패한다.
문서 검사도 같은 JSON에서 만든 Markdown인지 확인한다. 사람이 숫자를 여러 곳에서 고칠 필요가 없다.
검증 일시는 스냅샷 안에 기록한다. 이는 현재 운영 배포의 성공 횟수나 커버리지 지표가 아니다.

## 실제 편집 흐름 E2E

```bash
# 개발 Next 서버를 종료한 뒤 빌드한다. .next를 동시에 쓰지 않는다.
cd web
npm run build
npm run test:browser
npm run test:editorial
```

기존 공개 smoke와 별도인 editorial 설정은 실제 Spring `bootTestRun`과 Next를 사용한다.
Spring은 Testcontainers PostgreSQL/Redis를 사용하므로 운영·개발 DB를 수정하지 않는다.
포트는 loopback 3181/3101 고정, 기존 서버 재사용 금지, 종료 시 프로세스 그룹에 SIGTERM 전달.
테스트에 운영 BASE_URL을 받는 옵션은 없다. 서버 환경에 운영 자격 증명을 제공하지 않는다.

데스크톱과 모바일에서 다음 순서로 확인한다.

1. 비로그인 관리자 화면 진입은 로그인으로 이동한다. 틀린 비밀번호는 오류를 표시한다.
2. UI 로그인 후 새 글 두 편을 실제 폼으로 저장한다. 공개 글과 비공개 초안을 구분한다.
3. 익명 요청으로 초안을 읽을 수 없다.
4. 초안의 본문을 바꾸고 공개로 전환하며 이전 글을 지정한다.
5. 다시 편집 화면을 열어 본문/시리즈 저장을 확인하고, 상대 글의 연결도 확인한다.
6. 실제 blog 서브도메인 화면에서 본문을 읽고 시리즈 링크로 이동한다. 모바일 넘침도 확인한다.
7. 테스트 글만 삭제하고 로그아웃한다. 이전 JWT로 관리자 API를 다시 읽으면 거절된다.

이 과정에서 발견하고 수정한 회귀:

- `blogAdminActions.ts`의 서버 요청에 보안 표식 누락.
- CLI 발행/위키 시드의 로그인 요청에도 Origin을 전달하도록 수정하고 실제 로컬 실행 확인.
- Node fetch의 `Sec-Fetch-Mode: cors`를 브라우저로 오인하던 Origin 필터.
  Origin 없는 요청 중 명시적인 서버 표식이 있는 경우만 이 Node 메타데이터를 허용한다.
  브라우저 Fetch-Site가 있는 요청과 BFF의 Origin 없는 쿠키 쓰기는 계속 거절한다.
- 모바일 1열 관리자 메뉴에 sticky가 남아 저장 버튼의 클릭을 가림.
  900px 이하에서 메뉴를 일반 흐름으로 두고, 좁은 화면의 편집 헤더가 줄바꿈되게 했다.
  force click이나 강제 JavaScript submit으로 테스트를 우회하지 않았다.

실패 trace/video는 `web/test-results`에, 이번 실행 로그는 `/tmp/jaywiki-maintenance-*.log`에 남는다.
로컬 결과를 GitHub Actions/운영 배포 성공으로 대체하지 않는다.

## 최종 검증

- 전체 Spring 291개, Web 147개 통과. 스냅샷 생성과 CI 방식의 보고서/문서 대조 성공.
- 실제 Spring/임시 PostgreSQL/Redis 편집 E2E: 데스크톱·모바일 2개 통과, 서버 준비 포함 39.1초.
- 기존 공개 브라우저 smoke: 데스크톱·모바일 8개 통과. 다른 로컬 앱과의 포트 충돌을 피해
  `BROWSER_NEXT_PORT=3190 BROWSER_MOCK_PORT=3191 npm run test:browser`로 실행했다.
  설정과 기동 스크립트가 같은 포트를 사용하도록 포트 재정의를 지원한다.
- Next production build 성공, 타입 검사 성공, lint 오류 0·기존 경고 7.
- 공통 위키 로더 검사 1개 통과. 기존 위키 89편 export 차이 0.
- 로컬 Spring 재기동 후 health 200. 운영 배포나 push는 하지 않았다.
- 기존 블로그 65번의 로컬 본문이 초안과 같은지 확인하고 수정 전 사본을 Git 제외 백업에 보존했다.
  개선 결과를 같은 초안에 작성해 로컬에만 발행했다. 데스크톱 1440px·모바일 390px에서
  새 내용 표시, 가로 넘침 0 확인. 스크린샷: `/tmp/jaywiki-maintenance-blog-{desktop,mobile}.png`.
