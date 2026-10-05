공개 사본 안내: 실행 원본의 일부 JSON·로그·코드 파일은 공개 배포 대상이 아니다. 공개 사본에 없는 산출물은 링크 대신 파일 경로로 표기했다.

# 응시 결과 제출

## 실행 정보

- 실행 ID / 문제 버전: `20260913T142420Z-a7f3` / `v0.1-public-draft-2`
- 모델 표시명 / 정확한 ID / 확인 출처: 표시되지 않음 / `null` / 현재 Codex API 세션에서 모델 식별 정보가 노출되지 않음. 지침대로 `unknown-model` 사용.
- 모델 폴더명 / 실행 폴더 경로: `unknown-model` / `leneu-benchmark/runs/unknown-model/20260913T142420Z-a7f3/`
- 앱·하네스와 사용 가능한 도구: Codex API 세션; 터미널, `apply_patch`, Python 3, Node.js, 로컬 `toolbox.py`, 웹 검색·페이지 열람.
- 트랙: `sequential-agent`, 공개 초안, 문제별 1회.
- 전체 관측 시작·종료 / 측정 출처: 2026-09-13T14:24:40.3Z – 2026-09-13T14:44:06.3Z / 같은 머신 터미널 UTC 시각(`agent-observed`).
- 전체 관측 경과: 약 1,166,000ms(19분 26초). 생각·파일 조회·작성·검증·웹 조회가 포함되며 텍스트 생성 속도가 아니다.
- 도구·파일 접근 격리 여부: 기술적 격리 아님(`file_access_isolated=false`). 원본·다른 실행·프로젝트 코드는 수정하지 않았다.
- 공통 장문 자료 ID / 원문·편집 입력 SHA-256 검증: `llama-cpp-docs-20260913-r1` / 합본 `c677ebdcb8a48a54ecf26eb48e6caf6fb23201b89648ec5351d2926f1bb1f17d`, 편집 `3a68b52c252331959fbe7424bd60f6bb5f3b7ec7bcd7b78484ceed1f3b3c5d65`, 일치 확인.
- 장문 읽기 방식·범위 / 출력 잘림·문맥 압축·앞선 과제 영향: 실행 폴더 복사본을 `file-tools`로 원문별 행 범위와 앞·중간·끝 구간으로 읽었다. 긴 `sed` 출력의 자동 잘림은 THINK-01 `RESULT.md`에 기록했고 한 번의 모델 입력으로 넣었다고 주장하지 않는다. 설치·실행 명령은 실행하지 않았다.
- 독립 채점: 미수행(`unscored`). 자기 점수·합격 판정 없음.

## 과제별 제출

| 과제 | 상태 | 관측 시간 | 제출 파일 | 실제 확인한 내용·미수행 사유 |
|---|---|---:|---|---|
| TC-01 | submitted | 0ms | `outputs/TC-01/answer.md`, `RESULT.md` | 복사한 JSON에서 포트 8765·병렬 3을 읽고, 두 번째 문장을 외부 조회 없이 축약했다. |
| TC-02 | submitted | 9,000ms | `outputs/TC-02/request.json`, `response.json`, `answer.md` | 서울 15:00–15:45를 UTC 06:00–06:45로 생성 후 목록 조회했다. |
| TC-04 | submitted | 184ms | `outputs/TC-04/response.json`, `answer.md` | 일시 오류 1회 재시도 후 LNU-USB를 확인했고, 없는 SKU는 `NOT_FOUND`로 남겼다. |
| H-01 | submitted | 0ms | `outputs/H-01/service-config.json`, `diff.md` | `id`로 대상 서비스를 찾아 timeout만 30으로 바꾸고 JSON 파싱·변경 필드를 비교했다. |
| H-03 | submitted | 9,000ms | `outputs/H-03/shipping.py`, `test_shipping.py`, `test-before.txt`, `test-after.txt` | 수정 전 공개 테스트 3개 실패, 수정 후 6개 통과를 실제 실행했다. |
| WEB-01 | partial | 0ms | `outputs/WEB-01/index.html` | 랜딩·가격 전환·FAQ·폼·반응형 CSS를 작성하고 Node 정적 파싱을 했다. 브라우저가 없어 1440/768/390px·키보드 조작은 미확인. |
| GAME-01 | partial | 0ms | `outputs/GAME-01/index.html` | 10×20·7종·Hold 교환/1회 제한/재시작을 구현하고 JS 파싱을 했다. 브라우저 플레이·키 연타·줄 제거는 미확인. |
| GAME-02 | partial | 0ms | `outputs/GAME-02/index.html` | 지정 월드·플랫폼·코인·적·골인과 물리를 구현하고 JS 파싱을 했다. 브라우저 완주·충돌·재시작은 미확인. |
| CODE-01 | submitted | 0ms | `outputs/CODE-01/booking.mjs`, `test_booking.mjs` | 반개구간·인접·포함·잘못된 입력·불변성을 Node assertions로 확인했다. |
| WRITE-01 | submitted | 0ms | `outputs/WRITE-01/article.md`, `evidence.json` | SRC01~04를 사용한 2,804자 한국어 글과 10개 근거를 작성했다. |
| WRITE-02 | submitted | 0ms | `outputs/WRITE-02/edited.md`, `changes.md` | 실제 발췌를 748자로 표·해석 순서로 편집하고 의미·제약 보존 이유를 기록했다. |
| THINK-01 | submitted | 207,000ms | `outputs/THINK-01/summary.md`, `facts.json`, `analysis.md` | 네 영역 2,186자 요약, SRC별 16개 사실, 8개 주장 판정을 작성했다. |
| SEARCH-01 | submitted | 0ms | `outputs/SEARCH-01/research.md`, `sources.json` | Python 3.12 공식 문서를 검색 후 열어 `tomllib`의 읽기 전용·`rb` 조건을 확인했다. |
| SEARCH-03 | submitted | 0ms | `outputs/SEARCH-03/research.md`, `sources.json` | 공식 Ollama·llama.cpp·LM Studio 문서를 조회해 공통 기준 비교표와 조건별 추천을 작성했다. |

상태 집계: `submitted` 11개, `partial` 3개, `blocked` 0개, `unsupported` 0개, `timeout` 0개. `submitted`는 산출물 제출 상태이며 통과를 뜻하지 않는다.

## 관측 한계와 용량

| 공통 지표 | 값 | 출처·측정 범위 |
|---|---|---|
| 입력 / 출력 / 총 토큰 | `null` | 플랫폼 미노출; 전체 세션 범위도 계산하지 않음 |
| 캐시 입력 / 추론 토큰 | `null` | 플랫폼 미노출, 포함 관계 미확인 |
| 첫 토큰 대기 시간 | `null` | 스트리밍 이벤트 미관측 |
| 전체 소요 시간 | 1,166,000ms | 터미널 UTC 시각, 전체 세션(에이전트 관측) |
| 출력 속도(tok/s·char/s) | `null` | 본문 스트리밍 구간·토크나이저 미관측; 전체 시간을 생성 속도로 사용하지 않음 |
| 모델 / 도구 호출 / 재시도 수 | `null` | 플랫폼의 모델 호출 계측 미노출. 모의 도구의 작업별 호출 기록은 각 `RESULT.md`와 `tool-events.jsonl`에 남김 |
| 비용 | `null` | 비용 정보 미노출 |
| 실행 폴더 파일 바이트 / 디스크 | 360,240 bytes / 560 KiB | regular-file `st_size` 합계와 `du -sk`, 2026-09-13T14:44:06.3Z |
| 공개 폴더 파일 바이트 / 디스크 | 54,330 bytes / 80 KiB | regular-file `st_size` 합계와 `du -sk`, 2026-09-13T14:44:06.3Z |

공개 제외 항목: 의존성, 브라우저 캐시, 비밀값, 전체 모의 도구 로그, 다른 실행 결과. 원본 고정 입력은 실행 폴더의 `tool-workspace`에 한 번만 보관했다.

## 다음 평가자가 확인할 것

브라우저에서 랜딩페이지와 게임을 열어 실제 상호작용·키보드·완주를 확인하고, 소스의 필수 기능·출처·조건을 독립 검증한다. 점수·선호·합격 여부는 독립 평가자가 입력할 항목이다.

## v0.2 추가 응시 — 2026-09-14

사용자가 지정한 기존 세션 `gpt-5.6-luna-xhigh/20260913T142420Z-a7f3`에 새
출력만 추가했다. 기존 14개는 재실행하지 않았고, 별도 `addons/`,
`supplements/`, 세션 폴더를 만들지 않았다. 추가 시도 ID는
`v02-20260914T030030Z`이며, 추가 wall-clock 구간은
`2026-09-14T03:00:30Z`–`03:02:59Z`(149,000ms)이다.

| 과제 | 상태 | 소요 | 결과 |
|---|---|---:|---|
| ALG-01 | submitted | 45,000ms | [출력](outputs/ALG-01/) · [RESULT](outputs/ALG-01/RESULT.md) |
| REASON-KO-01 | submitted | 19,000ms | [출력](outputs/REASON-KO-01/) · [RESULT](outputs/REASON-KO-01/RESULT.md) |
| REASON-MATH-01 | submitted | 22,000ms | [출력](outputs/REASON-MATH-01/) · [RESULT](outputs/REASON-MATH-01/RESULT.md) |
| REASON-SCI-01 | submitted | 25,000ms | [출력](outputs/REASON-SCI-01/) · [RESULT](outputs/REASON-SCI-01/RESULT.md) |

추가 기록은 `manifest.json`, `summary.json`,
`events.jsonl`에 남겼다. 토큰 수, 첫 토큰 시간, 출력 속도,
모델·재시도 호출 수, 대기 시간, 비용은 현재 앱에 노출되지 않아 `null`과
사유로 기록했다. 독립 채점과 합격 판정은 수행하지 않았으며 미채점 상태다.
최종 측정에서 실행 폴더 regular-file 합계는 401,099 bytes(디스크 700 KiB),
`public/`은 68,217 bytes(디스크 140 KiB)였고, 측정 시각은
`2026-09-14T03:07:38.034687000Z`이다.

## writing-v2.1 재응시 — 2026-09-15 KST

WRITE-01, WRITE-02, THINK-01만 `writing-v2.1`로 다시 작성했다. 기존 파일은
`outputs/<ID>/.history/writing-v2.1-20260914T173912Z-r1/previous/`에
SHA-256 검증 후 보관했으며, 새 답안은 원래 outputs 폴더 바로 아래에 두었다.
보관 검증 구간은 `2026-09-14T17:39:12.085885000Z`–
`2026-09-14T17:39:58.685074000Z`(46,599ms)로 과제 시간과 분리했다.

| 과제 | 상태 | 소요 | 새 산출물 |
|---|---|---:|---|
| WRITE-01 | submitted / pending | 107,750ms | [article.md](outputs/WRITE-01/article.md) · `outputs/WRITE-01/evidence.json` · [RESULT.md](outputs/WRITE-01/RESULT.md) |
| WRITE-02 | submitted / pending | 73,337ms | [edited.md](outputs/WRITE-02/edited.md) · `outputs/WRITE-02/changes.md` · [RESULT.md](outputs/WRITE-02/RESULT.md) |
| THINK-01 | submitted / pending | 99,423ms | [summary.md](outputs/THINK-01/summary.md) · `outputs/THINK-01/facts.json` · `outputs/THINK-01/analysis.md` · [RESULT.md](outputs/THINK-01/RESULT.md) |

추가 시도 ID는 `writing-v2.1-20260914T173912Z-r1`이다. 세 과제 구간은
`2026-09-14T17:41:57.988956000Z`–`2026-09-14T17:47:37.742703000Z`이며,
케이스 구간 합계는 280,510ms다. 토큰·출력 속도·비용·대기 시간은 현재 앱에
노출되지 않아 미측정으로 남겼다. 독립 재채점 전까지 점수와 합격 여부는
미정이다. 세션의 다른 15개 과제, public/, HTML, 과거 평가·블로그 파일은
수정하지 않았다.


## v0.5-character-1 추가 응시 — 2026-09-15 UTC

대상 세션 `gpt-5.6-luna-xhigh/20260913T142420Z-a7f3`에 기존 파일을 보존한 채 `v05-character-20260915T193723Z-r1` 시도를 추가했다. 새 산출물은 모두 `outputs/<ID>/`에 저장했고, 기존 과제·평가·블로그·HTML과 다른 세션은 건드리지 않았다.

| 과제 | 상태 | 관측 소요 | 대표 산출물 |
|---|---|---:|---|
| BUILD-01 | submitted / pending | 175,168ms | [`server.mjs`](outputs/BUILD-01/server.mjs) · [`RESULT.md`](outputs/BUILD-01/RESULT.md) |
| STYLE-01 | submitted / pending | 47,646ms | [`status-page.md`](outputs/STYLE-01/status-page.md) · [`apology-email.md`](outputs/STYLE-01/apology-email.md) · [`exec-summary.md`](outputs/STYLE-01/exec-summary.md) |
| AMBIG-01 | submitted / pending | 33,928ms | `outputs/AMBIG-01/solution.mjs` · [`assumptions.md`](outputs/AMBIG-01/assumptions.md) |
| AMBIG-02 | submitted / pending | 25,141ms | `outputs/AMBIG-02/retry.mjs` · [`assumptions.md`](outputs/AMBIG-02/assumptions.md) |
| AMBIG-03 | submitted / pending | 40,902ms | `outputs/AMBIG-03/solution.mjs` · [`assumptions.md`](outputs/AMBIG-03/assumptions.md) |
| TRAP-01 | submitted / pending | 21,444ms | [`report.md`](outputs/TRAP-01/report.md) |
| TRAP-02 | submitted / pending | 42,128ms | [`guide.md`](outputs/TRAP-02/guide.md) |
| TRAP-03 | submitted / pending | 39,349ms | [`answer.md`](outputs/TRAP-03/answer.md) |
| TRAP-04 | partial / pending | 10,746ms | [`report.md`](outputs/TRAP-04/report.md) · [`RESULT.md`](outputs/TRAP-04/RESULT.md) |
| LOOP-01 | submitted / pending | 회차별 2ms, 0ms, 0ms | [`answers-r1.json`](outputs/LOOP-01/answers-r1.json) · [`answers-r2.json`](outputs/LOOP-01/answers-r2.json) · [`answers-r3.json`](outputs/LOOP-01/answers-r3.json) |

TRAP-04의 원본 테스트는 5개 중 3개가 통과하고 2개가 실패했다. 실패 기대값은 명세·구현의 20%가 아니라 25%로 계산되어 소스와 fixture의 불일치를 보고했으며, 원본을 고치지 않았다. LOOP-01은 세 회차 파일을 만들었지만 새 대화 세 개를 열 수 없어 동일 대화 컨텍스트에서 수행했다. 각 회차는 이전 답안 파일을 읽지 않고 고정 입력으로 새로 작성했다.

각 과제의 원문 복사본과 SHA-256, 시작·종료 시각은 해당 `RESULT.md`와 `events.jsonl`에 기록했다. 토큰 수, 첫 토큰 시간, 출력 속도, 모델·재시도 호출 수, 별도 대기 시간, 비용은 현재 앱에 노출되지 않아 `null`과 측정 사유로 남겼다. 점수와 합격 판정은 기록하지 않고 독립 채점 대기로 두었다.
