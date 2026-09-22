# SEARCH-03 RESULT

## 상태
submitted

## case_version
v0.1-public-draft-2

## 시작 / 종료 (추정)
- 시작: 2026-09-17T19:00Z (추정)
- 종료: 2026-09-17T19:20Z (추정)

## 산출물
- `research.md` — 한국어 Markdown 비교표, 조건별 추천, 미확인 사항 (본문 2,000~3,500자)
- `sources.json` — 9개 출처 (공식 문서 / 저장소 / 공식 사이트 유형 구분)

## 도구
- web_fetch로 원문 직접 읽음. 검색 요약만 보지 않고 인용 구절을 확인함.

## 주장과 근거 (핵심 축별)

### 1) 설치·방식
- **Ollama**: macOS/Windows/Linux, `ollama run <모델>`으로 다운로드 후 로컬 채트. Linux는 `ollama serve` 배경 서버. — 출처: Ollama Quickstart
- **llama.cpp**: 서버 빌드 필요, `./llama-server -m ...gguf -c 2048` (기본 127.0.0.1:8080). Docker 이미지도 제공. — 출처: llama.cpp server README
- **LM Studio**: GUI 데스크톱 앱 (Mac/Windows/Linux, v0.4.24). 헤드리스 `lms daemon up`/`lms server start` 제공. — 출처: LM Studio Download / Developer Docs

### 2) 지원 모델 형식
- 세 도구 모두 GGUF 계열. **llama.cpp만** 저장소에서 `.gguf`를 명시적 확인. Ollama·LM Studio는 GGUF 기반이나 공식 원문에서 "GGUF" 단어를 직접 인용하지 못함. — 출처: llama.cpp server README (Ollama/LM Studio는 미확인)

### 3) 로컬 API
- **Ollama**: `localhost:11434`. `/api/chat` 자체 API, `/v1/chat/completions` OpenAI 호환. — 출처: Ollama Quickstart
- **llama.cpp**: OpenAI 호환 chat completions/responses/embeddings (호환 강조 없음). — 출처: llama.cpp server README
- **LM Studio**: OpenAI/Anthropic 호환 Chat Completions/Embeddings/Responses/Tool Use, REST + SDK. — 출처: LM Studio Developer Docs

### 4) 툴 호출 조건
- **구분:** 도구가 엔드포인트를 제공한다고 모든 모델이 툴 호출을 하는 것은 아님. — 공통 원칙
- **llama.cpp**: Function calling 경로 제공, "~any model"로 확장 중 (개별 모델 의존). OpenAI 스타일 호출은 `--jinja` 등 필요. — 출처: llama.cpp server README
- **LM Studio**: Tool Use 엔드포인트 제공, MCP 도구 호출은 로컬. — 출처: LM Studio Developer Docs
- **Ollama**: OpenAI 호환 툴 호출 엔드포인트 제공 (모델별 실측 별개). — 출처: Ollama FAQ / Quickstart

### 5) 오프라인 사용 조건
- **Ollama**: 로컬은 API 키 불필요, "local only mode" 클라우드 비활성화. 초기 모델 다운로드는 인터넷 필요. — 출처: Ollama FAQ / Introduction
- **llama.cpp**: `--offline` 플래그로 캐시 전용. — 출처: llama.cpp server README
- **LM Studio**: 로컬 서버로 온디바이스 실행. — 출처: LM Studio Developer Docs

## 조회한 URL
- https://docs.ollama.com/quickstart
- https://docs.ollama.com/api/introduction
- https://docs.ollama.com/faq
- https://github.com/ggml-org/llama.cpp/blob/main/tools/server/README.md
- https://lmstudio.ai/download
- https://lmstudio.ai/docs/developer

## 검색 요약 vs 원문
- 세 도구 모두 원문 페이지를 직접 읽음. Ollama Quickstart는 `ollama run gemma4:e2b` 실행 예시, `curl .../api/chat`과 `.../v1/chat/completions`을 원문 인용으로 확인.
- llama.cpp 저장소는 `main`이 아닌 `master`가 아닌 `main` 브랜치 원문을 확인 (README 존재 확인).
- LM Studio는 GUI v0.4.24, `lms server start --port 1234`, Tool Use, MCP를 원문으로 확인.

## 미확인 사항
- Ollama·LM Studio의 모델 형식 "GGUF"는 공식 원문에서 직접 인용하지 못함 (llama.cpp만 `.gguf` 확인).
- 실행 속도, 통합 메모리 사용량, 비용은 직접 측정하지 않아 실측으로 쓰지 않음.
- 한국어 글쓰기 특정 모델 품질은 비교 범위에 없음.
- 버전/브랜치는 2026-09-17 시점 기준.
