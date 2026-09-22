# SEARCH-03 RESULT

- 과제 ID: SEARCH-03
- 상태: submitted (제출 상태이며 채점 통과가 아님, 자기 점수 없음 — 미채점)
- 시작(UTC): 2026-09-22T00:55:49Z (산출물 폴더 생성·첫 검색 호출 직후)
- 종료(UTC): 2026-09-22T00:56:59Z (research.md/sources.json 형식 검증 직후 관측)
- 소요: 70초 (agent-observed, 터미널 `date -u`)
- 산출물: `research.md`, `sources.json`, `RESULT.md`

## 수행 내용

- 조사 기준일: 2026-09-22. 대상: Apple Silicon Mac 64GB(사용자 제공 조건), 용도: 한국어 글쓰기 + 코딩 도구 연동.
- 도구: `websearch` 3회(경로 탐색) + `webfetch` 원문 조회 11회(성공 8 / 실패 3).
- 기준: 설치·운영, 지원 모델 형식, 로컬 API, 툴 호출 조건, 오프라인 사용 조건. 공식 문서·저장소 우선, 출처 유형(original_text_read / search_only) 구분.

## 확인한 동작 (요약)

- 3종 모두 OpenAI 호환 로컬 API 경로가 있고, 툴 호출은 **API 지원 여부**와 **개별 모델의 tool use 능력/템플릿**이 별개 조건임을 문서에서 확인(비교표에 분리 기재).
- llama.cpp: `--jinja` + tool-aware Jinja 템플릿이 선행 조건, 네이티브/Generic 2종 핸들러.
- LM Studio: Native/Default 2단계 지원 등급을 문서에서 확인.
- Ollama: `tools` 파라미터는 제공되되 모델의 tool calling 지원이 전제.
- 오프라인: 세 도구 모두 모델 파일 사전 확보 시 로컬 인퍼런스 가능, 검색·다운로드·업데이트는 인터넷 필요(Ollama는 클라우드 비활성화 옵션 포함).

## 확인하지 못한 부분 / 한계

- 실패 조회 3건: `docs.ggerganov.com/llama.cpp/server/`(transport error), `docs.ollama.com/app/offline`·`/models/tool-calling`(404 — 현행 URL 아님), `raw .../docs/server.md`·`serving.md`(404).
- `search_only` 근거 4건: Ollama Modelfile·api.md 스니펫, LM Studio 앱 문서 스니펫, llama.cpp server README 스니펫 — 원문 전체 미조회였던 항목은 sources.json caveat로 표시.
- **속도·메모리·비용 일절 미실측.** 64GB에서의 파라미터 한계·실측 토큰/s 없음. 어떤 수치도 실측값이 아님.
- 모델별 tool calling 재현 실행 없음(문서 확인 조사로 한정). 라이선스·가격 비교는 범위 밖.
- 웹 조회 시각: 2026-09-22T00:55:49Z~00:56:59Z(터미널 관측 연동).

## 토큰·속도·비용

- null / not_exposed (하네스 미노출). 전체 세션 사용량을 과제별로 배분하지 않음.
