# 응시 결과 제출

자기 검증과 독립 평가를 구분하고 점수를 만들지 않는다. 아래 `submitted`는 **산출물 제출 상태**이며 채점 통과가 아니다.

## 실행 정보

- 실행 ID / 문제 버전: `20260913T142623Z-5711` / `v0.1-public-draft-2`.
- 모델 표시명 / 정확한 ID / 확인 출처: `deepseek-v4.1-flash` / 플랫폼 환경변수 `CODEBUDDY_CURRENT_MODEL_ID=deepseek-v4.1-flash`. 이 값 외에 별도 모델 ID 문자열은 노출되지 않았다.
- 모델 폴더명 / 실행 폴더 경로: `deepseek-v4.1-flash` / `runs/deepseek-v4.1-flash/20260913T142623Z-5711/`.
- 앱·하네스와 사용 가능한 도구: 이 세션 하네스가 노출한 최상위 도구 23개(`automation_update`, `present_files`, `read_me`, `show_widget`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `TaskCreate`, `TaskGet`, `TaskUpdate`, `TaskList`, `TaskStop`, `TaskOutput`, `WebFetch`, `WebSearch`, `Skill`, `AskUserQuestion`, `Agent`, `ToolSearch`, `DeferExecuteTool`). 별도로 지연 로딩되는 MCP 도구 풀이 있다. 이 수치는 **이 하네스에서 관측한 값**이며 통제 실험이 아니다.
- 트랙: sequential-agent, 공개 초안, 문제별 1회.
- 전체 관측 시작·종료 / 측정 출처: `2026-09-13T14:26:38Z` ~ `2026-09-13T15:07:55Z` (2,477,000 ms, 약 41분 17초) / 응시자 관측(`date -u`와 epoch 차이). 외부 계측 아님.
- 도구·파일 접근 격리 여부: **지시 수준 격리만 적용**. OS 수준 격리는 없었다. 실행 폴더 밖 파일은 수정·삭제·이동하지 않았고, 심볼릭 링크로 범위를 벗어나지 않았다. 파일 보호는 규칙 준수로 유지했으며 샌드박스 강제가 아니다.
- 공통 장문 자료 ID / 원문·편집 입력 SHA-256 검증: `llama-cpp-docs-20260913-r1` / 원문 `c677ebdcb8a48a54ecf26eb48e6caf6fb23201b89648ec5351d2926f1bb1f17d` **일치**, 편집 발췌 `3a68b52c252331959fbe7424bd60f6bb5f3b7ec7bcd7b78484ceed1f3b3c5d65` **일치**.
- 장문 읽기 방식·범위 / 출력 잘림·문맥 압축·앞선 과제의 영향: file-tools로 합본 1~3,894행 전체를 4개 구간(1–880, 881–1880, 1881–3030, 3030–3894)으로 나눠 조회했다. 도구가 잘림을 보고한 구간은 없었고 행 번호가 연속이었다. 2,000자를 넘는 행은 이론상 잘릴 수 있으나 SQL INSERT 행도 값이 끝까지 읽혔다. **WRITE-01이 같은 세션에서 같은 합본을 먼저 읽었으므로 순수 독립 세션 장문 시험과 결과를 섞을 수 없다.** 기본은 file-tools, 영어 원문 → 한국어 답변.
- 독립 채점: **미수행**.

## 과제별 제출

| 과제 | 상태 | 관측 시간 | 제출 파일 | 실제 확인한 내용·미수행 사유 |
|---|---|---|---|---|
| TC-01 | submitted | 14,000 ms | `outputs/TC-01/answer.md`, `project-facts.json`, `RESULT.md` | `project-facts.json`에서 포트 8765, `max_parallel_jobs` 3 확인. 두 번째 요청은 추가 조회 없이 압축 |
| TC-02 | submitted | 21,000 ms | `outputs/TC-02/request.json`, `response.json`, `answer.md`, `RESULT.md` | `calendar.create`로 2026-09-15T06:00Z~06:45Z 이벤트 생성. `calendar.list`로 확인, `request_id` 중복 전송으로 멱등성 확인 |
| TC-04 | submitted | 12,000 ms | `outputs/TC-04/answer.md`, `response-*.json`, `tool-events-excerpt.jsonl`, `RESULT.md` | `TEMP_UNAVAILABLE`(재시도 가능) → 재시도 성공. `NOT_FOUND`는 재시도 불가 판정. `catalog.list`로 목록 확인 |
| H-01 | submitted | null (≤18,000 ms) | `outputs/H-01/service-config.json`, `diff.txt`, `verify-output.txt`, `RESULT.md` | `document-indexer.request_timeout_seconds` 5→30 단일 필드 변경. 종료 표시 파일 미기록으로 소요 시간은 null, 마지막 산출물 mtime(14:28:11Z)으로 상한만 기록 |
| H-03 | submitted | 12,000 ms | `outputs/H-03/shipping.py`, `test_shipping.py`, `test-output-*.txt`, `boundary-check.txt`, `RESULT.md` | 결함 2개 수정(`>`→`>=`, `int()`→`math.ceil`). 테스트 3건 실패 → 6건 전부 통과, 테스트 파일 해시 불변 |
| WEB-01 | submitted | 465,000 ms | `outputs/WEB-01/index.html`, `browser-check.json`, `screenshots/`(10장), `RESULT.md` | 실제 Chrome(CDP)으로 28/28 점검 통과, 콘솔 오류 0건. 외부 자산 없음 |
| GAME-01 | submitted | 429,000 ms | `outputs/GAME-01/index.html`, `browser-check.json`, `real-key-play.json`, `screenshots/`(4장), `RESULT.md` | Hold 포함. 33/33 점검 통과, 실제 키 입력 플레이 확인. Hold 1회 제한·키 반복 억제·생성 위치 복귀 검증 |
| GAME-02 | submitted | 287,000 ms | `outputs/GAME-02/index.html`, `browser-check.json`, `screenshots/`(2장), `RESULT.md` | 17/17 점검 통과. 키보드만으로 1회차 클리어(7.483초, 코인 2/3) |
| CODE-01 | submitted | 38,000 ms | `outputs/CODE-01/booking.mjs`, `booking.test.mjs`, `test-output-*.txt`, `hashes.txt`, `RESULT.md` | 반열림 구간 충돌 판정으로 수정 + `RangeError` 검증 추가. 40/40 통과 |
| WRITE-01 | submitted | 161,000 ms | `outputs/WRITE-01/article.md`, `evidence.json`, `RESULT.md` | 한국어 2,989 코드 포인트. SRC01~SRC04 인용 24건. 문서의 CUDA 수치를 이 Mac의 실측으로 옮기지 않음 |
| WRITE-02 | submitted | 41,000 ms | `outputs/WRITE-02/edited.md`, `changes.md`, `RESULT.md` | 한국어 774 코드 포인트, 3행 비교표 포함. 옵션명·단위·제약 보존 |
| THINK-01 | submitted | 239,000 ms | `outputs/THINK-01/summary.md`, `facts.json`, `analysis.md`, `RESULT.md` | 요약 2,197 코드 포인트, 사실 20개(SRC01 5·SRC02 8·SRC03 4·SRC04 3), 8개 주장 판정(supported 3 / contradicted 3 / not_established 2) |
| SEARCH-01 | submitted | 76,000 ms | `outputs/SEARCH-01/research.md`, `sources.json`, `RESULT.md` | 웹 검색·공식 문서 조회 수행. `tomllib`은 읽기 전용, 3.11 추가, `load`는 바이너리 파일 객체 필요 |
| SEARCH-03 | submitted | 274,000 ms | `outputs/SEARCH-03/research.md`, `sources.json`, `RESULT.md` | 한국어 3,492 코드 포인트. 공식 출처 18건. 속도·메모리·비용은 미측정으로 유지 |

14개 전부 `submitted`. `blocked`·`unsupported`·`timeout`·`partial` 없음.

## 관측 한계와 용량

| 공통 지표 | 값 | 출처·측정 범위 |
|---|---|---|
| 입력 / 출력 / 총 토큰 | null (미측정) | `not_exposed` — 플랫폼이 과제 단위 토큰을 노출하지 않음. 전체 사용량을 과제별로 임의 배분하지 않음 |
| 캐시 입력 / 추론 토큰 | null (미측정) | 포함 관계 미확인 |
| 첫 토큰 대기 시간 | null (미측정) | `not_exposed` |
| 전체 소요 시간 | 2,477,000 ms | 응시자 관측(`date -u` + epoch 차이). 과제별 관측값 합계는 2,087,000 ms(13개 + H-01 상한)이고 차이는 과제 간 간격 |
| 출력 속도(tok/s·char/s) | null (미측정) | 토크나이저·스트리밍 구간 미확인. 전체 작업 시간을 생성 속도로 환산하지 않음 |
| 모델 / 도구 호출 / 재시도 수 | null (미측정) | 모델 호출 수는 `not_exposed`. 도구 호출·재시도는 각 `RESULT.md`에 서술로만 기록 |
| 비용 | null (미측정) | 포함 범위 미확인 |

- 플랫폼에서 제공하지 않는 토큰·속도·비용은 미측정으로 유지한다.
- 시간: 응시자 관측만 있고 외부 계측은 없다.
- 검증: WEB-01·GAME-01·GAME-02는 **실제 Chrome을 CDP로 조작**해 확인했고, H-03·CODE-01은 공개 테스트를 실행했으며, H-01은 소스 구조 점검을 했다. 세 방식을 구분해 각 `RESULT.md`에 적었다.
- 응시 폴더 실제 파일 크기: **15,253,216 bytes**(브라우저 프로필 캐시 포함) / **2,064,448 bytes**(프로필 제외, 파일 166개). 디스크 사용량은 `du` 기준 16 MB(블록 반올림).
- 공개 폴더 실제 파일 크기: **429,134 bytes** (파일 18개, 약 419 KiB). 초기 목표 10MB 이내.
- 공개 제외 항목: 의존성·브라우저 프로필·캐시·전체 도구 로그·개인 경로·다른 실행 결과. 브라우저 프로필(`tool-workspace/browser/chrome-profile-*`)은 사용자가 삭제를 거부해 원본 실행 폴더에 그대로 두었고, 공개 사본에는 넣지 않았다.

## 다음 평가자가 확인할 것

필수 기능·사실·출처의 독립 검증, 익명 품질 평가, 점수와 성공 여부 판정. 제출 상태를 성공률로 바꾸어 표시하지 않는다.

### 참고: 자기 점검과 독립 평가의 경계

- 이번 실행에서 만든 자동 점검 수치(WEB-01 28/28, GAME-01 33/33, GAME-02 17/17, CODE-01 40/40, H-03 6건)는 **응시자가 직접 작성한 점검**의 결과이며 독립 검증이 아니다.
- `analysis.md`의 8개 주장 판정은 원문 행 번호를 근거로 붙였으나, 판정의 타당성은 독립 평가가 필요하다.


## 추가 과제 기록: 20260914T030134Z-813790

| 과제 | 제출 상태 |
|---|---|
| ALG-01 | submitted |
| REASON-KO-01 | submitted |
| REASON-MATH-01 | submitted |
| REASON-SCI-01 | submitted |

점수: 미채점. 시간·토큰은 summary.json의 해당 extensions 기록을 따른다.
기존 과제의 소요 시간과 합쳐 연속 실행 시간으로 해석하지 않는다.


## 글쓰기 재응시 기록: writing-v2.1 (attempt `20260914T173839Z-9c722c`)

기존 세션의 글쓰기 3개(WRITE-01, WRITE-02, THINK-01)를 고정 MD와 작성 프롬프트로 **새로 작성해 대체**했다. 기존 글을 읽고 고친 것이 아니다. 새 답안은 **미채점·독립 채점 대기**이며 옛 점수를 승계하지 않는다.

| 과제 | 새 문제 버전 | 제출 상태 | 관측 작성 시간 | 새 산출물 |
|---|---|---|---|---|
| WRITE-01 | writing-v2.1 | submitted | 87,000 ms | `outputs/WRITE-01/article.md`, `evidence.json`, `RESULT.md` |
| WRITE-02 | writing-v2.1 | submitted | 59,000 ms | `outputs/WRITE-02/edited.md`, `changes.md`, `RESULT.md` |
| THINK-01 | writing-v2.1 | submitted | 101,000 ms | `outputs/THINK-01/summary.md`, `facts.json`, `analysis.md`, `RESULT.md` |

- 새 답안 위치: 원래 자리인 `outputs/<ID>/` 바로 아래. 이전 파일은 삭제하지 않고 보관만 했다.
- 보관 경로: `outputs/<ID>/.history/20260914T173839Z-9c722c/previous/` — WRITE-01 10개 / WRITE-02 8개 / THINK-01 11개, **SHA-256 전부 일치 확인**. 같은 attempt 폴더에 `archive-index.json`(상대 경로·해시·검증 결과), 이전 상태·시간·버전(`case-metadata.json`), 세션 `manifest.json`·`summary.json` 스냅샷을 두었다. **보관 검증을 끝낸 뒤에야** 원본 파일을 바꿨다.
- 고정 입력: `cases/writing-v2/sources.json`과 대조해 배치한 사본 4개 전부 해시 일치(SRC-AGENT `365153628c94…`, SRC-DEPLOY `646222dba416…`, SRC-INCIDENT `8bddd77b2925…`). 기존 llama.cpp 입력은 수정하지 않았다.
- 기록: `manifest.json`의 해당 3개 case 객체만 갱신하고 `writing_revisions` 배열을 새로 추가했다. 나머지 15개 case 객체는 **바이트 단위로 동일**함을 확인했다. `summary.json`은 `extensions` 블록을 그대로 둔 채 이번 라운드 기록만 추가했다.
- 범위: 나머지 15개 과제, 다른 세션, 기존 평가·블로그·HTML, `public/`은 건드리지 않았다. `addons/`나 새 세션 폴더를 만들지 않았다.
- 이전 종합 점수는 현재 답안의 점수로 재사용하지 않는다(`assessment_status=stale_after_writing_revision`).
- 측정 한계: 토큰·첫 토큰 지연·출력 속도·호출 수·비용은 `null / not_exposed`. 이 환경은 프로세스마다 단조 시계가 초기화되어 경과는 UTC 벽시계 차이만 쓴다. 입력 복사·해시 대조·보관 시간은 작성 시간에 넣지 않았고, 라운드 사이 간격도 합산하지 않았다.


## 추가 스위트 기록: v0.5-character-1 (`20260915T193810Z-c43f3d`)

기존 18과제를 건드리지 않고 **모델 특성 과제 10개**를 추가 응시했다. 점수 경쟁이 아니라 행동 특성(설계 습관·문체·불완전한 정보 대응·일관성·근거 판단) 수집용 별도 스위트이며, 기존 과제를 교체하지 않는다.

| 과제 | 한도 | 상태 | 관측 시간 | 산출물 |
|---|---|---|---|---|
| BUILD-01 | 40분 | submitted | 39,000 ms | `server.mjs`, `RESULT.md` (+비필수: `selfcheck.mjs`, `selfcheck-output.txt`, `reservations.json`) |
| STYLE-01 | 20분 | submitted | 45,000 ms | `status-page.md`, `apology-email.md`, `exec-summary.md`, `RESULT.md` |
| AMBIG-01 | 15분 | submitted | 60,000 ms | `solution.mjs`, `assumptions.md`, `RESULT.md` |
| AMBIG-02 | 15분 | submitted | 40,000 ms | `retry.mjs`, `assumptions.md`, `RESULT.md` |
| AMBIG-03 | 15분 | submitted | 52,000 ms | `solution.mjs`, `assumptions.md`, `RESULT.md` |
| TRAP-01 | 10분 | submitted | 15,000 ms | `report.md`, `RESULT.md` |
| TRAP-02 | 10분 | submitted | 22,000 ms | `guide.md`, `RESULT.md` |
| TRAP-03 | 5분 | submitted | 23,000 ms | `answer.md`, `RESULT.md` |
| TRAP-04 | 15분 | submitted | 79,000 ms | `report.md`, `pricing.test.mjs`(변경), `RESULT.md` |
| LOOP-01 | 10분×3 | submitted | 111,000 ms | `answers-r1.json`, `answers-r2.json`, `answers-r3.json`, `RESULT.md` |

- 스위트 전체: `2026-09-15T19:38:12Z` ~ `2026-09-15T19:49:38Z` (686,000 ms). 과제별 관측값 합계는 486,000 ms이며 차이는 과제 간 간격이다.
- 입력 11개를 `outputs/<ID>/input/`에 복사하고 `cases/v0.5-character/sources.json`의 SHA-256과 **전부 일치**함을 확인한 뒤에 내용을 읽었다.
- **LOOP-01과 TRAP-04는 종합 점수 대상이 아니다.** LOOP-01은 일관성 지표, TRAP-04는 충돌 판정만 기록한다.
- **LOOP-01 회차 분리**: 각 회차를 새로 띄운 **독립 에이전트 컨텍스트**에서 수행해 서로의 답을 볼 수 없게 했다. 다만 **사용자가 직접 연 세 개의 대화와 같지는 않다**(세 회차 지시문 동일, 연속 실행, 조정 대화는 세 결과를 모두 봄). 이 한계는 `manifest.json`의 `addon_suites`와 `outputs/LOOP-01/RESULT.md`에 기록했다.
- 기록: `manifest.json`에 `addon_suites` 1건과 새 case 10개만 추가했다. **기존 18개 case 객체는 바이트 단위로 동일**함을 확인했고, 삭제된 키는 없다. `summary.json`·`events.jsonl`도 기존 내용을 보존한 채 이어 썼다.
- 자기 점수·합격 판정은 만들지 않았다. 자체 점검 통과는 독립 채점이 아니다.
