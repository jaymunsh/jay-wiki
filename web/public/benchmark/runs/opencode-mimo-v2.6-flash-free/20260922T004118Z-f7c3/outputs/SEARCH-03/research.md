# SEARCH-03 — Apple Silicon 64GB 환경의 로컬 LLM 도구 비교 (Ollama · llama.cpp · LM Studio)

- 조사 기준일(실행 날짜): **2026-09-22** (UTC)
- 대상 환경: Apple Silicon Mac, 통합 메모리 64GB (사용자 제공 조건, 직접 확인하지 않은 하드웨어)
- 용도: 한국어 글쓰기 + 코딩 도구 연동
- 조회 방식: `websearch`로 공식 문서·저장소 경로 확인 → `webfetch`로 원문 조회. 핵심 사실은 **공식 출처 원문**에 근거(`original_text_read`). 검색 스니펫만 본 항목은 sources.json에서 `search_only`로 구분.

## 공통 기준 비교표

| 기준 | Ollama | llama.cpp | LM Studio |
|---|---|---|---|
| 설치·운영 | 공식 설치 스크립트/앱. `ollama serve`로 로컬 서버(기본 `localhost:11434`) [^ollama-faq] | 소스 빌드·릴리스 바이너리·Docker·`llama.app` 설치. `llama serve`/`llama-server`로 OpenAI 호환 서버 [^llama-readme] | 설치 관리자(macOS/Windows/Linux) 또는 헤드리스 데몬 `llmster`. Developer 탭 또는 `lms server start`, 기본 `localhost:1234` [^lms-dev] [^lms-tools] |
| 지원 모델 형식 | GGUF(Modelfile `FROM ./model.gguf`). safetensors에서 변환·생성 경로도 문서화 [^search-ollama-modelfile] | **GGUF** 중심(1.5~8bit 양자화). 하드웨어 가속 Metal(Apple Silicon) 등 지원 [^llama-readme] | **GGUF**(llama.cpp 런타임) + Apple Silicon에서 **MLX** [^lms-app] |
| 로컬 API | 네이티브 `/api/chat`·`/api/generate` + OpenAI 호환 `/v1/chat/completions`(Tools 지원 체크박스 있음)·`/v1/responses` [^ollama-chat] [^ollama-oai] | OpenAI 호환 chat/responses/embeddings + Anthropic Messages 호환. `/v1/chat/completions`에 `tools` 전달 [^llama-fc] [^llama-readme] | 자체 REST API + OpenAI 호환(`/v1/chat/completions` 등) + Anthropic 호환(anthropic-compat) [^lms-dev] [^lms-tools] |
| 툴 호출 조건 | API는 `tools` 파라미터 제공. 단, **모델이 tool calling을 지원해야** 함(공식 문서가 "models with tool calling capabilities" 안내) [^ollama-chat] [^search-ollama-tools] | `llama-server`를 **`--jinja`로 시작**해야 function calling 사용. tool-aware Jinja 템플릿 필요. 네이티브 형식(Qwen2.5·Llama 3.x·Hermes 등)이 있으면 그대로, 아니면 Generic 핸들러로 전체 모델에 적용(토큰 많이 쓰고 비효율일 수 있음) [^llama-fc] | `/v1/chat/completions`의 `tools` 사용. 지원은 2단계: **Native**(모델 템플릿이 tool use 학습·포맷 지원 — Qwen·Llama 3.1/3.2·Mistral 등)와 **Default**(전 모델 최소한의 지원, 커스텀 시스템 프롬프트로 포맷 유도 — 품질은 모델에 따라 다름) [^lms-tools] |
| 오프라인 사용 조건 | 로컬 실행·프롬프트 로컬 유지. 클라우드 기능 끄기(`disable_ollama_cloud` / `OLLAMA_NO_CLOUD=1`)로 클라우드 모델·웹검색 차단. 모델 **다운로드(pull)에는 인터넷 필요** [^ollama-faq] | 자체 인퍼런스는 로컬. 모델 확보(HF 다운로드·빌드) 단계에만 네트워크 필요. 모델 파일만 있으면 오프라인 서빙 가능 [^llama-readme] | "전혀 오프라인으로 동작 가능, 모델 파일만 미리 받으면 됨". 다운로드·검색·런타임 설치·앱 업데이트는 인터넷 필요 [^lms-offline] |

[^ollama-faq]: https://docs.ollama.com/faq — 원문 조회
[^ollama-chat]: https://docs.ollama.com/api/chat — 원문 조회
[^ollama-oai]: https://docs.ollama.com/api/openai-compatibility — 원문 조회
[^search-ollama-modelfile]: https://github.com/ollama/ollama/blob/main/docs/modelfile.mdx — 검색 스니펫(`search_only`)
[^search-ollama-tools]: https://github.com/ollama/ollama/blob/main/docs/api.md — 검색 스니펫(`search_only`), 공식 `docs.ollama.com/api/chat` 원문과 내용 일치 확인
[^llama-readme]: https://raw.githubusercontent.com/ggml-org/llama.cpp/master/README.md — 원문 조회
[^llama-fc]: https://raw.githubusercontent.com/ggml-org/llama.cpp/master/docs/function-calling.md — 원문 조회
[^lms-dev]: https://lmstudio.ai/docs/developer — 원문 조회
[^lms-tools]: https://lmstudio.ai/docs/developer/openai-compat/tools — 원문 조회
[^lms-app]: https://lmstudio.ai/docs/app — 검색 스니펫(`search_only`)
[^lms-offline]: https://lmstudio.ai/docs/app/offline — 원문 조회

## 조건별 추천 (의견이며 실측 순위가 아님)

1. **한국어 글쓰기 중심 + 코딩 도구 연동을 GUI로 간편하게**: LM Studio. OpenAI·Anthropic 양쪽 호환 엔드포인트가 있고, Native tool use(Qwen·Llama 계열)가 문서화되어 있으며, 오프라인 동작이 명시되어 있다. Apple Silicon에서 MLX를 함께 쓸 수 있다.
2. **CLI/스크립트 중심의 단순한 로컬 서버 + 도구 호출이 빠른 시작**: Ollama. 설치·`ollama serve`·OpenAI 호환 `/v1`이 간단하고, tool calling이 되는 모델만 고르면 코딩 도구 연동 경로가 짧다.
3. **템플릿·양자화 제어 등 최대한의 제어가 필요하거나 컨테이너/소스 배포**: llama.cpp. `--jinja`와 tool-aware 템플릿만 맞추면 네이티브/Generic 양쪽으로 폭넓게 동작하지만, 초기 설정 부담이 가장 크다.

코딩 도구 연동은 대부분 OpenAI 호환 `base_url` 지정으로 끝나므로, 위 3종 모두 동일한 클라이언트(Cline류·openai SDK 등)에서 경로가 열린다. 차이는 엔드포인트 세부 지원 범위(`tool_choice` 미지원 여부, stateful responses 부재 등)와 모델 템플릿 관리 방식이다 [^ollama-oai].

## 직접 측정하지 않은 것 / 미확인 사항

- **토큰 속도·메모리 점유·비용**: 아무 것도 실측하지 않았다. 이 글의 어떤 숫자도 실측값이 아니다(지시에 따라 실측처럼 쓰지 않음).
- 64GB에서 각각 몇 B 파라미터 모델이 멀티턴+툴 호출로 안정적인지는 문서에 없고 실측하지 않았다.
- Ollama의 모델별 tool calling 지원 목록은 별도 모델 카탈로그 페이지가 있으나 본 조회에서 원문 전체를 확인하지 못했다(`search_only` 근거만 존재 → 미확인으로 남긴다).
- llama.cpp의 `docs/server.md`·`docs/serving.md`는 조회 시점에 404였다. 서버 기능 표는 `tools/server/README.md` 검색 스니펫에서만 확인(`search_only`)했다.
- 세 도구의 라이선스·가격: llama.cpp는 MIT 배지 확인(README), 나머지 두 도구의 라이선스/유료 정책은 본 조사 범위 밖이다.
- 위 비교표의 "지원" 표기는 공식 문서의 기술에 근거하며, 특정 모델 조합에서 실제로 툴 호출이 성공하는지의 재현 실행은 수행하지 않았다.
