# RESULT — SEARCH-03

- case: SEARCH-03 (비교 리서치: Ollama / llama.cpp / LM Studio)
- case_version: v0.1-public-draft-2 (segment 1)
- model: splash/incoai/Qwen3.8-27B-Splash
- 시작: 2026-09-29T15:59:39Z / 종료: 2026-09-29T19:11:42Z / 경과: 11523초 (약 3시간 12분)
  - 참고: 이 값은 **벽시계(wall-clock)**이며 세션 재개(session resume) 공백이 포함되어 있다. 순수 작업 시간은 이보다 짧다.
- 토큰·속도·비용: 관측 불가 → null (not_exposed)

## 조사 방법

- 이 세션에는 **브라우저 자동화·검색 엔진 도구가 없다**. 대신 **공식 저장소 README(raw.githubusercontent)·공식 API 문서·공식 홈페이지 원문**을 webfetch로 직접 조회해 원문 전체를 읽었다.
- 즉 "검색 결과 요약만 본 경우"가 아니라 **"원문을 읽은 경우"**다.
- 조회 날짜: 2026-09-29. 5개 URL 중 **4개 원문 조회 성공**, LM Studio **공식 문서(docs.lmstudio.ai) 1개는 전송 오류로 조회 실패**(홈페이지만 성공).

## 출처 (원문 직접 조회)

| # | URL | 출처 유형 | 조회 | 결과 |
|---|---|---|---|---|
| 1 | https://raw.githubusercontent.com/ollama/ollama/main/README.md | 공식 저장소 README | 2026-09-29 | 성공 |
| 2 | https://docs.ollama.com/api | 공식 API 문서 | 2026-09-29 | 성공 |
| 3 | https://raw.githubusercontent.com/ggml-org/llama.cpp/master/README.md | 공식 저장소 README | 2026-09-29 | 성공 |
| 4 | https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md | 공식 저장소 server 문서 | 2026-09-29 | 성공 |
| 5 | https://lmstudio.ai/ | 공식 홈페이지 | 2026-09-29 | 성공 (docs.lmstudio.ai: transport error 실패) |

## 조사 결론 요약

- **Apple Silicon 대응**: 세 도구 모두 공식 문서에 명시 — Ollama(llama.cpp/Metal)·llama.cpp(first-class: Metal·Accelerate·ARM NEON)·LM Studio(MLX+llama.cpp). 64GB 통합 메모리 전제는 충족.
- **로컬 API**: Ollama(`localhost:11434`, REST+OpenAI+Anthropic)·llama.cpp(`llama serve` 8080, OpenAI+Anthropic)는 명확. LM Studio 로컬 서버 세부(엔드포인트/포트)는 **미확인**(문서 조회 실패).
- **툴 호출**: llama.cpp server가 function calling + 내장 도구 + MCP를 명확히 지원. Ollama는 API가 tools 지원(OpenAI/Anthropic 호환)이나 세부 페이지 404. LM Studio는 에이전트 Bionic(문서·코딩·컴퓨터 제어). **도구의 API 지원 ≠ 개별 모델의 툴 호출 능력**임을 구분해 기술.
- **오프라인**: 세 도구 모두 로컬 모델 기반 오프라인 사용 가능(llama.cpp `--offline` 명시).
- **용도별 추천**: 글쓰기·쉬운 시작 → Ollama/LM Studio(GUI); 코딩 도구 API 연동 → Ollama; 최적화·MCP/기능 호출 제어 → llama.cpp.

## 산출물 형식

- `research.md`: 조사 환경·방법 + 5공통기준 비교표 + 도구별 분석 + 용도별 추천 + 미확인 사항 + 출처. **본문 3,194자**(공백 포함, URL·코드블록 제외) → 2,000~3,500 목표 내. 핵심 사실 옆에 출처 붙임.
- `sources.json`: 5개 entry. 각 entry에 url·source_type·queried·method(원문 전문)·claims_supported. LM Studio entry에 문서 조회 실패 note 포함. **JSON 파싱 유효 확인**.

## 미확인·한계 사항

- **LM Studio 공식 문서(docs.lmstudio.ai)가 webfetch 전송 오류**로 직접 조회 실패. lmstudio.ai/docs는 307 리다이렉트, 서브페이지(/docs/getting-started 등)는 404. 따라서 LM Studio의 로컬 OpenAI 서버·앱 API 툴 호출 세부 항목은 **미확인으로 처리**하고, 홈페이지로 확인된 것만 근거로 남겼다.
- Ollama 툴 호출 상세 페이지(docs.ollama.com/tools)는 404로 미확인.
- **64GB에서의 속도·메모리·비용을 실측하지 않아** 수치로 제시하지 않음. research 내 성능 언급은 모두 "여지·가능성"이며 실측치가 아님을 명시.
- 토큰·속도·비용은 이 런타임에서 노출되지 않아 null이다.
