# 응시 결과 제출

자기 검증과 독립 평가를 구분하고 점수를 만들지 않는다.

## 실행 정보

- 실행 ID / 문제 버전: `20260913T142640Z-7d3e` / `v0.1-public-draft-2`.
- 모델 표시명 / 정확한 ID / 확인 출처: **SWE-2 High** / `SWE-2 High` / 실행 중인 에이전트의 시스템 프롬프트("powered by SWE-2 High", Devin by Cognition). 별도 모델 API ID는 노출되지 않음.
- 모델 폴더명 / 실행 폴더 경로: `swe-2-high` / `runs/swe-2-high/20260913T142640Z-7d3e/`.
- 앱·하네스와 사용 가능한 도구: Devin CLI(Devin Desktop, macOS). 터미널·파일 읽기/쓰기/편집·grep/glob 검색·web_search/webfetch·python3·node·headless Chrome(puppeteer-core, 실행 폴더 안에만 설치)·모의 도구 CLI(toolbox.py).
- 트랙: sequential-agent, 공개 초안, 문제별 1회.
- 전체 관측 시작·종료 / 측정 출처: 2026-09-13T14:26:40Z ~ 2026-09-13T14:59:41Z UTC / macOS `date -u`, 응시자 관측(agent-observed). 과제 수행 구간은 14:26:50Z~14:58:23Z, 나머지는 실행 폴더 준비·정리·제출물 작성.
- 도구·파일 접근 격리 여부: 격리되지 않음(file_access_isolated=false). 실행 폴더 외 파일을 쓰지 않는 규칙은 지시 준수이며 OS 수준 강제가 아니다.
- 공통 장문 자료 ID / 원문·편집 입력 SHA-256 검증: `llama-cpp-docs-20260913-r1` / 합본 c677ebd…f17d, 편집본 3a68b52…5d65 — 출처 명세와 **일치 확인**.
- 장문 읽기 방식·범위 / 출력 잘림·문맥 압축·앞선 과제의 영향: file-tools 방식, 영어 원문→한국어 답변. THINK-01은 네 원문 모두 구간 조회(앞·중간·끝 포함, 상세 범위는 THINK-01/RESULT.md). 20000자 단위 출력 잘림이 있어 행 범위를 나눠 읽었다. WRITE-01이 THINK-01보다 먼저 같은 원문 일부를 읽은 선행 효과가 있다(순서 규칙대로 수행).
- 독립 채점: 미수행(unscored).

## 과제별 제출

| 과제 | 상태 | 관측 시간 | 제출 파일 | 실제 확인한 내용·미수행 사유 |
|---|---|---|---|---|
| TC-01 | submitted | ~25초 | outputs/TC-01/answer.md, RESULT.md | project-facts.json 실제 읽기(포트 8765·병렬 3), 두 번째 요청은 도구 없이 요약. 도구 사용 여부를 요청별로 기록 |
| TC-02 | submitted | ~39초 | request.json, response.json, answer.md, RESULT.md | 서울 15일 15:00-15:45→UTC 06:00-06:45 변환, calendar.create ok + calendar.list로 확인 |
| TC-04 | submitted | ~10초 | answer.md, RESULT.md, 요청 JSON들 | LNU-USB 첫 호출 TEMP_UNAVAILABLE→동일 재시도로 성공(이름·단가·재고), NO-SUCH-ITEM은 NOT_FOUND를 오류로 보고, catalog.list로 코드 부재 확인. 감사 로그는 tool-events.jsonl |
| H-01 | submitted | ~8초 | service-config.json(수정본), RESULT.md | document-indexer의 타임아웃만 5→30. diff로 변경 1곳 확인, JSON 재파싱, 다른 키·서비스 유지. 사용 가능한 도구 수는 미측정(플랫폼 미노출) |
| H-03 | submitted | ~18초 | shipping.py, test_shipping.py, test-output-before/after.txt | 수정 전 3건 실패 재현→구현만 수정(>=·ceil)→6/6 통과. 테스트 파일 미변경 |
| WEB-01 | submitted | ~3분54초 | index.html, shot-1440/768/390.png, verify-output.txt | headless Chrome 자동 검증 14/14: 3폭 가로 스크롤 없음, 가격 토글, FAQ 열기/닫기(클릭·키보드), 모바일 메뉴, 이메일 검증·완료 상태, CTA 스크롤. 사람의 창 조작은 아님 |
| GAME-01 | submitted | ~6분32초 | index.html, shot.png, verify-output.txt | 15/15 자동 검증: 빈 슬롯 보관·교환(대기열 유지)·고정 전 재보관 차단(C/Shift 연타 포함)·기본 회전 복귀·보관 시 점수 불변·일시정지/게임오버 차단·벽 회전 취소·1줄+100·생성 충돌 게임오버·재시작 초기화·루프 중복 없음. 검증용 __tetris 핸들은 문서화 |
| GAME-02 | submitted | ~6분50초 | index.html, shot.png, verify-output.txt | 11/11 자동 검증: 지면 점프만·코인 1회·카메라 클램프·플랫폼 하단 충돌·밟기/옆 충돌·낙하 실패·재시작 초기화·골인 시간 정지. 키 이벤트+debug.step으로 자동 완주(clear, 게임 시간 ~9.2초). 개발 중 player.w/h 결함 발견·수정 |
| CODE-01 | submitted | ~16초 | booking.mjs, test_booking.mjs, test-output.txt | 겹침 판정을 반개구간으로 수정, 잘못된 입력·구간에 RangeError, 입력 불변. node --test 9/9 통과 |
| WRITE-01 | submitted | ~1분48초 | article.md(2,556자·소제목 5), evidence.json(14 claims) | SRC01-04 모두 활용, 행 번호는 합본 기준. 설치·실행·측정 미수행, 문서 수치를 실측으로 표기하지 않음 |
| WRITE-02 | submitted | ~58초 | edited.md(728자), changes.md | 비교표 구성, 옵션·단위·제외 사항 보존. 첫 판 668자로 범위 미달→원문 의미 내 보강(동일 과제 내 수정) |
| THINK-01 | submitted | ~3분02초 | summary.md(2,200자), facts.json(23건), analysis.md | 네 영역 요약, SRC별 최소 2건 이상 사실(5/9/4/5), 주장 8건 판정(3 supported·3 contradicted·2 not_established). 읽기 범위·잘림 한계 기록 |
| SEARCH-01 | submitted | ~57초 | research.md, sources.json | docs.python.org/3.12 tomllib 원문 직접 조회: 읽기 지원·쓰기 미지원·3.11 추가·binary 모드 확인. 검색 요약 열람과 원문 조회 구분 |
| SEARCH-03 | submitted | ~1분44초 | research.md(2,347자), sources.json(11건) | Ollama·llama.cpp·LM Studio를 공통 기준으로 비교. 공식 문서/저장소/릴리스 노트 유형 구분, API 지원과 모델 능력 구분, 미측정 수치 미사용 |

## 관측 한계와 용량

| 공통 지표 | 값 | 출처·측정 범위 |
|---|---|---|
| 입력 / 출력 / 총 토큰 | 미측정 | 플랫폼 미노출(not_exposed) |
| 캐시 입력 / 추론 토큰 | 미측정 | 미노출, 포함 관계 확인 불가 |
| 첫 토큰 대기 시간 | 미측정 | 스트리밍 타임스탬프 미노출 |
| 전체 소요 시간 | 약 33분(14:26:40Z~14:59:41Z) | macOS `date -u`, agent-observed. 과제별 시간은 위 표 |
| 출력 속도(tok/s·char/s) | 미측정 | 토크나이저·스트리밍 구간 미노출. 전체 작업 시간을 생성 속도로 쓰지 않음 |
| 모델 / 도구 호출 / 재시도 수 | 미측정 | 플랫폼 카운터 미노출. 모의 도구 호출은 과제별 기록(TC-02: 2회, TC-04: 4회·재시도 1회) |
| 비용 | 미측정 | 미노출 |

- 플랫폼이 제공하지 않는 토큰·속도·비용은 미측정으로 유지. 전체 사용량을 과제별로 임의 배분하지 않았다.
- 시간: 응시자 관측(agent-observed)이며 외부 독립 계측 아님.
- 검증: headless Chrome 자동 조작·공개 테스트 실행·diff/해시 점검을 구분해 기록했다. 사람의 수동 브라우저 조작은 수행하지 않았다.
- 응시 폴더 실제 용량: 약 47MiB(`du -sh`, 대부분 검증용 node_modules/npm 캐시 — tool-workspace 약 45MiB + outputs 약 1.2MiB).
- 공개 폴더 실제 용량: 약 336KiB(`du -sh public`, 14 파일).
- 공개 제외 항목: node_modules·npm 캐시·tool-events 로그·이전 실행 결과·비밀값.

## 다음 평가자가 확인할 것

필수 기능·사실·출처의 독립 검증, 익명 품질 평가, 점수와 성공 여부 판정. 제출 상태를 성공률로 바꾸어 표시하지 않는다.


## 추가 과제 기록: 20260914T030646Z-26cf7e

| 과제 | 제출 상태 |
|---|---|
| ALG-01 | submitted |
| REASON-KO-01 | submitted |
| REASON-MATH-01 | submitted |
| REASON-SCI-01 | submitted |

점수: 미채점. 시간·토큰은 summary.json의 해당 extensions 기록을 따른다.
기존 과제의 소요 시간과 합쳐 연속 실행 시간으로 해석하지 않는다.

## 추가 과제 상세(v0.2-reasoning-draft-1, extension 20260914T030646Z-26cf7e)

같은 세션에서 기존 14개 완료 약 12.7시간 후에 이어서 응시했다. 연속 18과제 시간이 아니라 별도 묶음(연결 프로필)이다.

| 과제 | 상태 | 관측 벽시계 시간(UTC 타임스탬프 기준) | 제출물 | 확인 내용 |
|---|---|---|---|---|
| ALG-01 | submitted | ~63.0초 | outputs/ALG-01/solution.mjs, explanation.md, test_solution.mjs, RESULT.md | 종료 정렬+이진 탐색 DP(O(n log n)/O(n)), RangeError 검증, 입력 비파괴, node --test 9/9 통과·20만 건 약 56ms |
| REASON-KO-01 | submitted | ~54.2초 | answers.json, explanation.md, RESULT.md | K1 supported·K2/K3/K5 contradicted·K4 not_established. P번호 근거 기록. 지문만 사용 |
| REASON-MATH-01 | submitted | ~41.2초 | answers.json, explanation.md, RESULT.md | M1 25,500 / M2 22,950 / M3 22,950 / M4 33,500 / M5 189. n<200과 n≥200 구간 분리 경계 비교. 계산 도구 미사용 |
| REASON-SCI-01 | submitted | ~43.8초 | answers.json, explanation.md, RESULT.md | S1 5 / S2 B-C / S3 A-B / S4 contradicted / S5 contradicted. 교락(confounding) 구분, 추가 실험 제안 |

### 추가 과제의 측정 한계

- manifest.json의 신규 `elapsed_ms`는 이 환경에서 `time.monotonic_ns()`가 프로세스별 값을 반환해 체크포인트 스크립트가 계산한 값이 부정확하다(음수 포함). 각 과제의 `elapsed_wall_ms`(started_at_utc~ended_at_utc 차이)가 실측 벽시계다. summary.json도 같은 이유로 `clock_discontinuity`를 보고한다.
- 토큰·첫 토큰·출력 속도·호출 수·비용은 여전히 플랫폼 미노출(not_exposed)로 null이다. 사용자 대기는 없었고 wait 이벤트는 기록되지 않았다(wait_coverage: explicit-markers-only).
- 기존 14개 과제의 상태·시간·제출물은 변경하지 않았고, 신규 항목만 manifest.cases와 extensions에 추가했다.
- 점수는 미채점. REASON-SCI-01의 S4는 해석 여지가 있어 판단 근거를 explanation.md에 명시했다.

## 글쓰기 3개 재응시: writing-v2.1 (attempt 20260914T173922Z-w21a)

WRITE-01·WRITE-02·THINK-01만 고정 MD·프롬프트가 다른 writing-v2.1로 다시 수행했다(과제 수 불변, 나머지 15개 유지). 이전 답안은 해시 검증 후 `outputs/<ID>/.history/20260914T173922Z-w21a/previous/`에 보관했고, 새 답안은 같은 outputs/<ID>/ 아래에 작성했다. 보관 검증 전에는 원본을 바꾸지 않았다.

| 과제 | 버전 | 상태 | 관측 시간(벽시계) | 새 산출물 |
|---|---|---|---|---|
| WRITE-01 | writing-v2.1 | submitted | ~129초(17:39:41Z~17:41:50Z) | article.md(~2,151자·H2 6), evidence.json(13 claims), RESULT.md |
| WRITE-02 | writing-v2.1 | submitted | ~126초(17:42:16Z~17:44:22Z) | edited.md(~2,168자·H2 6), changes.md(7항목), RESULT.md |
| THINK-01 | writing-v2.1 | submitted | ~206초(17:44:58Z~17:48:24Z) | summary.md(~1,605자·H2 5), facts.json(15), analysis.md(6 판정), RESULT.md |

- 입력 해시 모두 sources.json과 일치(repository-instructions 36515362…, deployment 646222db…, incident 8bddd77b…).
- 새 시도는 미채점(evaluation_status: pending)이며 이전 점수를 이어 쓰지 않는다. 기존 종합 평가가 있었다면 stale_after_writing_revision으로 표시한다.
- 시간은 `date -u` 응시자 관측이며 보관 작업 시간은 제외했다. 토큰·속도·비용은 not_exposed로 null. 세 과제는 같은 날의 재응시로 기존 14개 수행 시간과 합치지 않는다.
