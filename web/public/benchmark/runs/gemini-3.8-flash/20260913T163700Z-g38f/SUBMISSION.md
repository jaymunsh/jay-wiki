# 응시 결과 제출 보고서

본 문서는 Leneu Benchmark 공개 과제 14개를 직접 응시자로서 순차 수행한 최종 결과 보고서입니다. 자기 점수나 합격 판정은 작성하지 않으며, 미채점 상태로 독립 평가자에게 인계합니다.

## 실행 정보

- **실행 ID / 문제 버전**: `20260913T163700Z-g38f` / `v0.1-public-draft-2`
- **모델 표시명 / 정확한 ID / 확인 출처**: Gemini 3.8 Flash / `gemini-3.8-flash` / Antigravity IDE `Model Selection` 사용자 설정
- **모델 폴더명 / 실행 폴더 경로**: `gemini-3.8-flash` / `leneu-benchmark/runs/gemini-3.8-flash/20260913T163700Z-g38f`
- **앱·하네스와 사용 가능한 도구**: `antigravity-cli` (16개 도구: run_command, view_file, write_to_file, replace_file_content, read_url_content, search_web, list_dir, grep_search, find_by_name, ask_question, schedule, manage_task, invoke_subagent, define_subagent, manage_subagents, generate_image)
- **트랙**: sequential-agent, 공개 초안, 문제별 1회 고정 순서 수행
- **전체 관측 시작·종료 / 측정 출처**: 2026-09-13T16:37:10Z ~ 2026-09-13T16:45:14Z (약 8분 4초 소요) / `agent-observed` (Python datetime UTC 및 단조 시계 `time.monotonic()`)
- **도구·파일 접근 격리 여부**: `file_access_isolated: false` (운영체제 수준 강제 샌드박스가 아닌 에이전트 지침 준수 방식)
- **공통 장문 자료 ID / 원문·편집 입력 SHA-256 검증**: `llama-cpp-docs-20260913-r1` / 원문(`c677ebdcb8a48a54ecf26eb48e6caf6fb23201b89648ec5351d2926f1bb1f17d`) 및 편집(`3a68b52c252331959fbe7424bd60f6bb5f3b7ec7bcd7b78484ceed1f3b3c5d65`) 무결성 일치 확인 완료
- **장문 읽기 방식·범위**: `file-tools` (슬라이싱 및 키워드 기반 탐색, SRC01~SRC04 전체 헤더 및 본문 대조, 영어 원문 → 한국어 작성)
- **독립 채점**: 미수행 (`unscored`)

---

## 과제별 제출 현황

| 과제 | 상태 | 관측 시간 | 제출 파일 | 실제 확인한 내용·미수행 사유 |
|---|---|---|---|---|
| **TC-01** | submitted | 약 20초 | `answer.md`, `RESULT.md` | `project-facts.json` 조회하여 포트 8765, 병렬 작업 수 3 확인. 제시문 1문장 축약 완료. 파일 읽기와 결과 저장을 명확히 분리. |
| **TC-02** | submitted | 약 16초 | `request.json`, `response.json`, `answer.md`, `RESULT.md` | 2026-09-14(KST) 기준 내일 15:00~15:45를 UTC 06:00~06:45로 변환. `calendar.create` 후 `calendar.list` 재조회 확인. |
| **TC-04** | submitted | 약 22초 | `answer.md`, `RESULT.md` | `LNU-USB` 1차 시도 일시 오류(`TEMP_UNAVAILABLE`) 감지 후 1회 재시도로 정상 복구(32,000원, 재고 7개). `NO-SUCH-ITEM`은 `NOT_FOUND` 사실 그대로 보고. |
| **H-01** | submitted | 약 13초 | `service-config.json`, `RESULT.md` | `document-indexer`의 `request_timeout_seconds`를 30으로 수정. 타 서비스 및 키값 온전히 보존. 파싱 및 diff 유효성 검증 완료. |
| **H-03** | submitted | 약 19초 | `shipping.py`, `test_shipping.py`, `RESULT.md` | 수정 전 3건 실패 관측. `shipping.py`의 50,000원 이상 무료 및 500g 올림 결함 수정 후 6건 단위 테스트 전건 통과 확인. |
| **WEB-01** | submitted | 약 37초 | `index.html`, `RESULT.md` | Leneu Desk 단일 HTML 반응형 페이지 (1440/768/390px, 월/연 요금제 전환, FAQ 아코디언, 폼 검증). 브라우저 렌더링 캡처는 도구 부재로 미수행. |
| **GAME-01** | submitted | 약 26초 | `index.html`, `RESULT.md` | 10×20 보드, 7종 블록 테트리스. C/Shift 보관(Hold) 및 교환, 블록 고정 전 1회 제한, 재시작 루프 초기화 완비. 브라우저 실제 조작은 미수행. |
| **GAME-02** | submitted | 약 25초 | `index.html`, `RESULT.md` | 2400×600 월드 2D 플랫폼 게임. 지면 3구간, 플랫폼 3개, 코인 3개, 적 2마리 밟기 바운스 점프, 카메라 추적, 완주 가능 물리 수치 적용. 브라우저 완주는 미수행. |
| **CODE-01** | submitted | 약 18초 | `booking.mjs`, `test_booking.mjs`, `RESULT.md` | 반개구간 `[start,end)` 충돌 조건(`start < b && end > a`) 수정 및 입력 유효성 `RangeError` 구현. 8개 스위트 20개 단언 전건 통과. |
| **WRITE-01** | submitted | 약 63초 | `article.md`, `evidence.json`, `RESULT.md` | "로컬 서버를 켰다는 것만으로 실제 작업 준비가 끝나는가?" 본문 2,761자 (H1 배제, 소제목 4개). SRC01~SRC04 9개 핵심 사실 매핑. |
| **WRITE-02** | submitted | 약 29초 | `edited.md`, `changes.md`, `RESULT.md` | `llama-bench` 발췌문 한국어 입문 가이드 편집 907자 (3종 시험 비교표, 집계 방식 및 주의사항). 변경 사유 4개 항목 기술. |
| **THINK-01** | submitted | 약 35초 | `summary.md`, `facts.json`, `analysis.md`, `RESULT.md` | 4대 영역 종합 요약 2,007자. facts.json 14개 사실(조건/예외 포함) 추출. 8개 주장 사실 판정(supported 3, contradicted 4, not_established 1). |
| **SEARCH-01** | submitted | 약 50초 | `research.md`, `sources.json`, `RESULT.md` | Python 3.12 tomllib 공식 문서 실시간 인출(full_document_fetch)을 통해 읽기만 지원, 쓰기 미지원, 3.11 추가, `rb` 모드 필수 사실 확인. |
| **SEARCH-03** | submitted | 약 57초 | `research.md`, `sources.json`, `RESULT.md` | 64GB Mac 로컬 LLM 3자(Ollama, llama.cpp, LM Studio) 비교 3,469자. 5대 기준 비교표, 조건별 추천, 실측치 배제 원칙 준수. |

---

## 관측 한계와 용량

| 공통 지표 | 값 | 출처·측정 범위 |
|---|---|---|
| **입력 / 출력 / 총 토큰** | 미측정 (`null`) | `not_exposed` (플랫폼 API 미노출) |
| **캐시 입력 / 추론 토큰** | 미측정 (`null`) | `not_exposed` (플랫폼 API 미노출) |
| **첫 토큰 대기 시간 (TTFT)** | 미측정 (`null`) | `not_exposed` (스트리밍 이벤트 미측정) |
| **전체 소요 시간** | 약 484초 (8분 4초) | `agent-observed` (Python 단조 시계 기준) |
| **출력 속도 (tok/s · char/s)** | 미측정 (`null`) | 토크나이저 및 스트리밍 구간 미확인 (전체 작업 시간을 글자 수로 나눈 수치 사용 금지 원칙 준수) |
| **모델 / 도구 호출 / 재시도 수** | null / 42회 / 1회 | 도구 호출 42회(관측치), 재시도 1회 (TC-04 catalog.quote) |
| **비용 (USD)** | 미측정 (`null`) | `not_exposed` (플랫폼 API 미노출) |

- **응시 폴더 실제 바이트 수**: 약 628 KiB (58개 파일) / 디스크 사용량 약 744 KB
- **공개 폴더 실제 바이트 수**: 약 88 KiB (9개 파일) / 디스크 사용량 약 100 KB
- **공개 제외 항목**: 빌드 아티팩트, 가상환경, 브라우저 캐시, 다른 모델 실행 결과, 원본 장문 텍스트 중복 복사 배제.

---

## 다음 평가자가 확인할 것

1. **독립 기능 채점**: TC/H/CODE 단위 테스트의 추가 코너 케이스 검증 및 도구 호출 감사 로그 무결성 점검.
2. **시각 및 상호작용 검증**: 실제 브라우저 환경에서 `public/landing/index.html`, `public/tetris/index.html`, `public/platformer/index.html`을 열어 반응형 렌더링, 테트리스 Hold 동작, 플랫폼 완주 플레이 직접 확인.
3. **콘텐츠 품질 평가**: `public/writing/` 및 `public/research/`의 기술적 사실 부합성, 문체 일관성, 근거 인용 정밀도 평가.
4. **점수 산출**: 평가자 기준에 따른 객관식/주관식 채점 및 합격 판정 부여.


## 추가 과제 기록: 20260914T031104Z-681d71

| 과제 | 제출 상태 |
|---|---|
| ALG-01 | submitted |
| REASON-KO-01 | submitted |
| REASON-MATH-01 | submitted |
| REASON-SCI-01 | submitted |

점수: 미채점. 시간·토큰은 summary.json의 해당 extensions 기록을 따른다.
기존 과제의 소요 시간과 합쳐 연속 실행 시간으로 해석하지 않는다.


## writing-v2.1 재수행 기록: 20260914T174530Z-w2r1

WRITE-01, WRITE-02, THINK-01 과제를 writing-v2.1 명세에 따라 새 답안으로 재작성하여 제출함.

| 과제 ID | 문제 버전 | 상태 | 신규 산출물 | 이전 시도 보관 경로 |
|---|---|---|---|---|
| WRITE-01 | writing-v2.1 | submitted | `article.md`, `evidence.json`, `RESULT.md` | `outputs/WRITE-01/.history/20260914T174530Z-w2r1/previous/` |
| WRITE-02 | writing-v2.1 | submitted | `edited.md`, `changes.md`, `RESULT.md` | `outputs/WRITE-02/.history/20260914T174530Z-w2r1/previous/` |
| THINK-01 | writing-v2.1 | submitted | `summary.md`, `facts.json`, `analysis.md`, `RESULT.md` | `outputs/THINK-01/.history/20260914T174530Z-w2r1/previous/` |

- **재채점 필요**: 신규 산출물은 독립 채점관의 재채점이 필요하며, 이전 llama.cpp 점수는 재사용하지 않고 `unscored` (score: null) 상태로 유지됨.
- **원본 보존**: 이전 시도의 원본 파일 및 메타데이터는 각 `.history/` 경로에 SHA-256 검증 후 온전히 보존됨.
- **시간 구분**: 보관 작업 시간과 과제 작성 시간을 엄격히 분리하였으며, 며칠간의 응시 간격을 연속 실행 시간으로 합산하지 않음.
