# 로컬 LLM 실행 도구 비교: Ollama · llama.cpp · LM Studio

**조사 기준 날짜: 2026-09-17**
**사용자 환경: Apple Silicon Mac, 통합 메모리 64GB · 용도: 한국어 기술 글쓰기 + 코딩 도구 연동**

본 문서는 세 도구의 공식 문서·저장소·공식 사이트 원문을 `web_fetch`로 직접 읽어 비교한다. 핵심 사실 옆에 출처 유형과 URL을 붙였고, 측정하지 않은 속도·메모리·비용은 실측처럼 쓰지 않았다.

## 1. 비교표

| 항목 | Ollama | llama.cpp | LM Studio |
|---|---|---|---|
| 출처 유형 | 공식 문서 (docs.ollama.com) | 저장소 (github.com/ggml-org/llama.cpp) | 공식 사이트·문서 (lmstudio.ai) |
| 설치·방식 | 앱 설치 후 `ollama run <모델>` CLI. Linux는 `ollama serve` 배경 서버 | 소스 빌드 후 `./llama-server -m 모델.gguf -c 2048`. Docker 이미지도 있음 | Mac/Linux/Windows GUI 앱. 현재 버전 0.4.24 |
| 설치 난도 | 낮음 (원클릭 앱) | 높음 (빌드 필요) | 낮음 (앱 설치) |
| 지원 모델 형식 | GGUF 기반 (모델 레지스트리) | GGUF (`.gguf`) | GGUF 기반 |
| 로컬 API | `localhost:11434` · `/api/chat`(자체), `/v1/chat/completions`(OpenAI 호환) | `127.0.0.1:8080` · OpenAI 호환 chat/responses/embeddings | `localhost:1234` · OpenAI·Anthropic 호환 (Chat Completions, Embeddings, Responses, Structured Output, Tool Use) |
| 툴 호출 조건 | OpenAI 호환 경로 통해 | Function calling/tool use는 "~any model" · OpenAI 스타일은 `--jinja` 플래그 필요 | Tool Use 엔드포인트 제공, MCP 툴 호출은 온디바이스 |
| 오프라인 조건 | 로컬 실행 기본. 모델 `_pull_`은 초기 1회 인터넷(프록시) 필요 · 클라우드 기능 해제로 로컬 전용 모드 | `--offline` 플래그로 캐시만 사용, 네트워크 차단 | GUI 특성상 모델 다운로드 후 로컬 실행 |

## 2. 조건별 추천

**① 한국어 기술 글쓰기가 주 용도**
- 수동으로 모델을 관리하기보다 빠르게 쓰고 싶으면 **Ollama**가 가장 편하다. `ollama run <모델>` 한 줄로 모델을 다운로드하고 채트를 연다 (공식 문서).
- GUI로 모델을 검색·다운로드·실행까지 한 화면에서 하고 싶으면 **LM Studio** (공식 사이트, Mac/Linux/Windows, v0.4.24).

**② 코딩 도구 연동이 주 용도 (에디터·에이전트에서 API 호출)**
- **LM Studio**가 가장 준비돼 있다. `lms server start --port 1234`로 서버를 띄우고 OpenAI·Anthropic 호환 엔드포인트를 쓰며, Tool Use와 MCP 툴 호출이 온디바이스에서 동작한다 (공식 문서). RESTplus TypeScript(`lmstudio-js`), Python(`lmstudio-python`) SDK를 제공한다.
- **Ollama**도 OpenAI 호환 `/v1/chat/completions`으로 기존 코딩 도구 생태계에 쉽게 붙는다 (공식 문서).
- **llama.cpp**는 유연하지만 툴 호출에 `--jinja` 플래그가 필요해 연동 설정이 한 단계 더 필요하다 (저장소).

**③ 오프라인·프라이버시가 중요한 조건**
- **llama.cpp**가 가장 명시적이다. `--offline` 플래그가 캐시만 사용하고 네트워크 접근을 차단한다고 공식적으로 밝힌다 (저장소).
- **Ollama**는 로컬 실행이 기본이고 클라우드 기능을 해제하면 로컬 전용 모드가 되지만, 모델은 초기에 반드시 인터넷에서 받아야 한다 (공식 문서).

**④ 64GB 통합 메모리 Apple Silicon**
- 세 도구 모두 단일 모델 크기는 제한하지 않는다. 64GB면 대형 모델을 모두에서 돌릴 수 있으나, 실제 가동 메모리·속도는 모델과 양자화 수준에 따라 달라지므로 여기서는 측정하지 않았다.

## 3. 도구의 API 지원과 모델의 툴 호출 능력 구분

혼동하기 쉬운 점을 명시한다. **도구가 엔드포인트를 제공한다고, 모든 모델이 툴 호출을 수행하는 것은 아니다.**
- llama.cpp는 서버가 Function calling 경로를 제공하지만, 실제 지원은 로드한 **개별 모델**에 달려 있으며 "~any model"로 확장 중이라고 밝힌다 (저장소).
- Ollama·LM Studio도 마찬가지로 서버가 OpenAI/Anthropic 호환 툴 호출 엔드포인트를 제공하며, 특정 모델이 실제로 툴 호출을 잘하는지는 모델별 실측이 별개다.

## 4. 미확인 사항

- **Ollama·LM Studio의 모델 형식:** 두 도구 모두 GGUF 기반이나, 공식 원문에서 "GGUF"라는 단어를 직접 인용하지는 못했다. llama.cpp만 저장소에서 `.gguf`를 명시적으로 확인했다.
- **속도·메모리·비용:** 세 도구의 실행 속도, 통합 메모리 사용량, 비용은 직접 측정하지 않아 본문에 실측으로 넣지 않았다.
- **한국어 성능:** 한국어 글쓰기 특정 모델의 품질은 비교 범위에 없으며, 도구와 무관하게 선정한 모델에 의존한다.
- **버전 시점:** LM Studio 현재 버전 0.4.24, llama.cpp 저장소는 `main` 브랜치 원문을 기준으로 한다 (2026-09-17 시점).

## 출처

- [Ollama Quickstart](https://docs.ollama.com/quickstart) — 설치·실행, 로컬 API, OpenAI 호환
- [Ollama API Introduction](https://docs.ollama.com/api/introduction) — 로컬/클라우드, API 키
- [Ollama FAQ](https://docs.ollama.com/faq) — 로컬 실행, 로컬 전용 모드
- [ggml-org/llama.cpp tools/server/README](https://github.com/ggml-org/llama.cpp/blob/main/tools/server/README.md) — 서버 시작, 포트, OpenAI 호환, 툴 호출, `--offline`, GGUF
- [LM Studio Download](https://lmstudio.ai/download) — GUI, 지원 OS, 버전
- [LM Studio Developer Docs](https://lmstudio.ai/docs/developer) — 로컬 서버, OpenAI/Anthropic 호환, 툴 호출, MCP
