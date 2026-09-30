# 응시 결과 제출

## 실행 정보

- 실행 ID / 문제 버전: `20260913T163601Z-k7q2` / `v0.1-public-draft-2`.
- 모델 표시명 / 정확한 ID / 확인 출처: Muse Spark / `opencode/muse-spark-1.3-contributor-free` / 세션 시스템 프롬프트(developer + system). 추측 없이 확인된 값만 사용.
- 모델 폴더명 / 실행 폴더 경로: `opencode-muse-spark-1.3-contributor-free` / `leneu-benchmark/runs/opencode-muse-spark-1.3-contributor-free/20260913T163601Z-k7q2`.
- 앱·하네스와 사용 가능한 도구: OpenCode 하네스. 파일 읽기·쓰기·편집, 터미널(bash, Python 3.9·Node v24), 웹 검색·조회. 브라우저 없음. 별도 모델 API 호출 없음.
- 트랙: sequential-agent, 공개 초안, 문제별 1회(고정 순서 TC-01→SEARCH-03).
- 전체 관측 시작·종료 / 측정 출처: 2026-09-13T16:36:01Z ~ 2026-09-13T16:45:26Z / 터미널 시스템 시각 UTC, agent-observed (외부 독립 계측 아님).
- 도구·파일 접근 격리 여부: OS 수준 격리 없음. 지시문 기반 제한으로 이번 실행 폴더 안에서만 생성·수정했고, 원본·다른 실행 결과는 수정하지 않음.
- 공통 장문 자료 ID / 원문·편집 입력 SHA-256 검증: `llama-cpp-docs-20260913-r1` / 합본 `c677ebdc…b1f17d`·편집본 `3a68b52c…f3b3c5d` 모두 출처 명세와 일치 (integrity_verified=true).
- 장문 읽기 방식·범위 / 출력 잘림·문맥 압축·앞선 과제의 영향: file-tools(행 범위 조회). 합본 전체를 한 번의 입력에 넣지 않음. SRC01 머리말·CPU·KleidiAI, SRC02 옵션·CORS·MCP·Quick Start·API·timings, SRC03 함수 호출 전문, SRC04 벤치 전문을 실제 조회. 잘림·압축 없음. WRITE-01이 THINK-01보다 앞서 같은 원문을 읽은 순차 응시 영향을 기록함. 기본은 file-tools, 영어 원문 → 한국어 답변.
- 독립 채점: 미수행.

## 과제별 제출

| 과제 | 상태 | 관측 시간 | 제출 파일 | 실제 확인한 내용·미수행 사유 |
|---|---|---|---|---|
| TC-01 | submitted | 약 30초 | outputs/TC-01/answer.md, RESULT.md | 입력 사본 실제 조회: api_port 8765, max_parallel_jobs 3. 2번 요청은 조회 없이 축약 |
| TC-02 | submitted | 약 60초 | outputs/TC-02/request.json, response.json, answer.md | UTC 변환(09-15T06:00~06:45Z) 후 calendar.create 1회·list 1회 확인. 실제 캘린더 미사용 |
| TC-04 | submitted | 약 45초 | outputs/TC-04/answer.md, RESULT.md | 첫 조회 TEMP_UNAVAILABLE→재시도 성공(Leneu USB Hub/32000원/7개). NO-SUCH-ITEM은 NOT_FOUND로 보고. 구현·상태 파일 미열람 |
| H-01 | submitted | 약 30초 | outputs/H-01/service-config.json, RESULT.md | document-indexer만 5→30, id 식별, 파싱·diff 확인. 원본 미수정. 도구 수 미측정 |
| H-03 | submitted | 약 30초 | outputs/H-03/shipping.py, test_shipping.py, RESULT.md | 수정 전 3실패 확인→올림+`>=50000` 수정→6/6 통과. 테스트 미변경 |
| WEB-01 | submitted | 약 90초 | outputs/WEB-01/index.html, RESULT.md | 단일 파일·외부 의존성 없음·JS 구문 OK. 1440/768/390 렌더링·키보드 실조작은 브라우저 부재로 미수행 |
| GAME-01 | submitted | 약 90초 | outputs/GAME-01/index.html, RESULT.md | Hold(빈슬롯 보관·교환·고정 전 1회·C/Shift·반복무시·일시정지/오버 차단·재시작 초기화) 소스 구현·구문 OK. 브라우저 플레이 검증 미수행 |
| GAME-02 | partial | 약 70초 | outputs/GAME-02/index.html, RESULT.md | 공통 맵 좌표 그대로 구현·구문 OK. 브라우저 완주 검증을 못해 partial로 둠 |
| CODE-01 | submitted | 약 45초 | outputs/CODE-01/booking.mjs, test_booking.mjs, RESULT.md | half-open 판정·RangeError 검증, node 15/15 통과 |
| WRITE-01 | submitted | 약 100초 | outputs/WRITE-01/article.md, evidence.json, RESULT.md | 한국어 2,186자·소제목 4·H1 없음·SRC01~04 활용, 근거 12건. 설치·측정 미수행 |
| WRITE-02 | submitted | 약 60초 | outputs/WRITE-02/edited.md, changes.md, RESULT.md | 한국어 732자·비교표·제약 보존. 명령 미실행·외부 보충 없음 |
| THINK-01 | submitted | 약 120초 | outputs/THINK-01/summary.md, facts.json, analysis.md, RESULT.md | 한국어 1,673자·사실 14건(원문별 2건 이상)·8주장 판정(지지 3·반박 3·미확정 2). 외부 검색 없음 |
| SEARCH-01 | submitted | 약 90초 | outputs/SEARCH-01/research.md, sources.json, RESULT.md | 공식 문서 원문 열람: 읽기 O·쓰기 X·3.11 편입·바이너리 모드 |
| SEARCH-03 | submitted | 약 90초 | outputs/SEARCH-03/research.md, sources.json, RESULT.md | 한국어 2,320자·비교표·추천·미확인 사항, 출처 10건. 실측 수치 없음 |

## 관측 한계와 용량

| 공통 지표 | 값 | 출처·측정 범위 |
|---|---|---|
| 입력 / 출력 / 총 토큰 | 미측정 | 플랫폼 미제공 (not_exposed) |
| 캐시 입력 / 추론 토큰 | 미측정 | 포함 관계 미확인 |
| 첫 토큰 대기 시간 | 미측정 | 스트리밍 이벤트 미관측 |
| 전체 소요 시간 | 약 565초 (16:36:01Z~16:45:26Z) | 터미널 UTC, agent-observed |
| 출력 속도(tok/s·char/s) | 미측정 | 토크나이저·스트리밍 구간 미확인. 전체 시간÷문자 수를 속도로 삼지 않음 |
| 모델 / 도구 호출 / 재시도 수 | 모델 호출 미측정 / 도구 약 117회(세션 집계, 근사) / 모의도구 6회·재시도 1회 | 도구 수는 세션 기록 집계(파일·터미널·웹·유틸리티). 모의 재시도 1회는 TC-04 일시 오류 대응 |
| 비용 | 미측정 | 포함 범위 미확인 |

- 플랫폼에서 제공하지 않는 토큰·속도·비용은 미측정으로 유지한다. 전체 사용량을 과제별로 임의 배분하지 않는다.
- 시간: 응시자 관측과 외부 계측을 구분.
- 검증: 브라우저 실제 조작·공개 테스트·소스 점검을 구분 (브라우저 조작 미수행, 공개 테스트 통과: H-03·CODE-01, 소스 점검: WEB·GAME).
- 응시 폴더 실제 바이트 수 / 디스크 사용량: 747,356바이트 합계 / du 900KB (macOS, 블록 단위).
- 공개 폴더 실제 바이트 수 / 디스크 사용량: 48,553바이트 합계 / du 76KB.
- 공개 제외 항목: 의존성·캐시·비밀값·다른 실행 결과·공통 원문 전체·전체 도구 로그.

## 다음 평가자가 확인할 것

필수 기능·사실·출처의 독립 검증, 익명 품질 평가, 점수와 성공 여부 판정. 제출 상태를 성공률로 바꾸어 표시하지 않는다.


## 추가 과제 기록: 20260914T030819Z-c3e143

| 과제 | 제출 상태 |
|---|---|
| ALG-01 | submitted |
| REASON-KO-01 | submitted |
| REASON-MATH-01 | submitted |
| REASON-SCI-01 | submitted |

점수: 미채점. 시간·토큰은 summary.json의 해당 extensions 기록을 따른다.
기존 과제의 소요 시간과 합쳐 연속 실행 시간으로 해석하지 않는다.

## 글쓰기 재응시 writing-v2.1 (attempt 20260914T173825Z-99065b)

- 대체한 과제: WRITE-01(기술 블로그), WRITE-02(배포·롤백 런북), THINK-01(장애 복구 메모). 과제 수는 늘지 않는다. 나머지 15개 과제·과거 평가·public/·블로그·HTML은 건드리지 않았다.
- 새 산출물: `outputs/WRITE-01/{article.md,evidence.json,RESULT.md}`, `outputs/WRITE-02/{edited.md,changes.md,RESULT.md}`, `outputs/THINK-01/{summary.md,facts.json,analysis.md,RESULT.md}`. 상태는 모두 submitted(독립 채점 대기, score null, evaluation pending).
- 보관 위치: `outputs/WRITE-01/.history/20260914T173825Z-99065b/`(보관 기록·세션 명세 사본) 및 각 과제 `outputs/<ID>/.history/20260914T173825Z-99065b/previous/`(기존 파일 전체, 해시 검증됨).
- 관측 시간: WRITE-01 약 90초(17:39:39Z~17:41:09Z), WRITE-02 약 130초(17:41:27Z~17:43:37Z), THINK-01 약 100초(17:44:21Z~17:46:01Z). 보관 시간 별도. 토큰·속도·비용 미측정(not_exposed).
- 재채점 필요: 새 답안은 기존 점수와 무관하며 종합 점수 확정 보고 없음. 이전 종합 점수는 세션에 없었다.
