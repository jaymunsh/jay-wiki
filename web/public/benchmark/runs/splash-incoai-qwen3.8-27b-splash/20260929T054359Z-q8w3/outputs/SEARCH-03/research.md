# SEARCH-03 — Apple Silicon 64GB 환경에서 Ollama · llama.cpp · LM Studio 비교

## 조사 환경 및 방법

- **환경**: Apple Silicon Mac, 통합 메모리 64GB. **용도**: 한국어 글쓰기 + 코딩 도구 연동. **조사 기준일**: 2026-09-29.
- **방법**: 각 도구의 **공식 저장소 README · 공식 API 문서 · 공식 홈페이지 원문**을 webfetch로 직접 조회했다. 이 세션에는 검색 엔진·브라우저 자동화가 없어 공식 URL의 원문을 직접 웹페치했으며, 검색 결과 요약만 본 것이 아니다.
- **출처 유형 구분**: Ollama = 공식 저장소 README + 공식 API 문서. llama.cpp = 공식 저장소 README + server 문서. LM Studio = 공식 홈페이지(문서 서브페이지는 이번 런에서 조회 실패, 아래 미확인 참조).
- **원칙**: ① "도구가 API를 지원하는가"와 "개별 모델이 실제로 툴을 잘 호출하는가"는 구분한다. ② 직접 측정하지 않은 속도·메모리·비용은 실측치처럼 쓰지 않는다.

## 비교표 (공통 5기준)

| 기준 | Ollama | llama.cpp | LM Studio |
|---|---|---|---|
| 설치·운영 | macOS: `curl` 스크립트 또는 `.dmg` 설치, CLI `ollama`으로 모델 실행·대화 | C/C++ 바이너리: llama.app / 릴리스 / Docker / 소스 빌드, `llama cli`·`llama serve` | 공식 앱 다운로드, GUI에서 모델 다운로드·실행 (에이전트 'Bionic' 포함) |
| 지원 모델 형식 | 자체 포맷(내부 llama.cpp 기반), ollama.com/library에서 이름으로 풀 | GGUF(1.5~8bit 양자화), Hugging Face에서 `-hf`로 직접 로드 | 앱 내 로컬 모델 다운로드, MLX + llama.cpp 런타임 |
| 로컬 API | REST `localhost:11434/api`, OpenAI 호환 `/v1`, Anthropic 호환 | `llama serve`(8080): OpenAI 호환 chat/responses/embeddings + Anthropic Messages | 홈페이지 기준 앱 내 로컬 사용; 로컬 OpenAI 서버 상세는 미확인 |
| 툴 호출 | API가 tools 지원(OpenAI/Anthropic 호환 문서 참조); 세부 페이지는 이번 런 미확인 | server가 **function calling/tool use** + 내장 도구(--tools)·MCP 서버 지원 | 에이전트 Bionic(문서·코딩·컴퓨터 제어); 앱 API 툴 스키마는 미확인 |
| 오프라인 | 모델 로컬 저장 후 실행, 클라우드 키 불필요 | `--offline` 모드(캐시 사용, 네트워크 차단) | "Natively local" 로컬 LLM 실행 |
| Apple Silicon 대응 | llama.cpp 백엔드(Metal) | **first-class**: Metal·Accelerate·ARM NEON | MLX + llama.cpp 런타임 |

## 도구별 분석

**Ollama** — 운영 편의성이 가장 높다. 스크립트 하나로 설치되고 `ollama run`으로 바로 대화한다. 백엔드가 llama.cpp(Metal)라 Apple Silicon에서 잘 돌며, `localhost:11434`에서 REST·OpenAI·Anthropic 3가지 호환 API를 노출해 외부 코딩 도구(Claude Code, Codex, Cline, VS Code AI Toolkit 등)에 붙이기 쉽다. [Ollama README](https://raw.githubusercontent.com/ollama/ollama/main/README.md) · [API 문서](https://docs.ollama.com/api)

**llama.cpp** — 자유도와 성능 제어력이 가장 높다. C/C++ 원신이며 Apple Silicon이 first-class(Metal·Accelerate)다. GGUF 양자화를 1.5~8bit로 고를 수 있고, `llama-server`가 OpenAI/Anthropic 호환 API와 function calling, 내장 도구·MCP 서버까지 제공한다. 다만 CLI/빌드 중심이라 GUI가 없어 GUI를 원하는 사람은 부담. [README](https://raw.githubusercontent.com/ggml-org/llama.cpp/master/README.md) · [server 문서](https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md)

**LM Studio** — GUI가 있는 데스크톱 앱으로, 앱 안에서 모델을 골라 다운로드·실행하고 에이전트 'Bionic'으로 문서·코딩·컴퓨터 제어까지 한다. 런타임이 MLX + llama.cpp라 Apple Silicon 친화적이다. 단, **공식 문서(docs.lmstudio.ai)가 이번 런에서 조회 실패**해 로컬 OpenAI 서버·앱 API 툴 호출 세부가 확인되지 않는다. [홈페이지](https://lmstudio.ai/)

## 용도별·조건별 추천

- **한국어 글쓰기 위주, 가장 쉬운 시작**: LM Studio(GUI로 모델 선택) 또는 Ollama. 64GB 통합 메모리는 수십 B급 모델을 Q4 수준으로 올려 돌릴 여지가 크지만, **실제 모델별 속도·메모리 점유는 실측 전 수치로 제시하지 않는다**.
- **코딩 도구(API) 연동 위주**: Ollama. OpenAI/Anthropic 호환 엔드포인트 + 광범위한 공식·커뮤니티 통합이 확인되어 IDE/CLI 도구에 붙이기 가장 직관적이다.
- **최적화·최소 의존성·MCP/기능 호출 제어 필요**: llama.cpp. 서버를 직접 꾸려 function calling·내장 도구·MCP를 세밀하게 설정할 수 있다.
- 세 도구 모두 Apple Silicon 대응(Metal 또는 MLX+llama.cpp)이 공식 문서에 명시되어, 64GB 환경의 전제 자체는 충족한다.

## 미확인 사항

- **LM Studio**: 공식 문서(docs.lmstudio.ai)가 이번 런에서 webfetch **전송 오류**로 직접 조회 실패. 로컬 OpenAI 호환 서버 엔드포인트/포트, 앱 API의 툴 호출 스키마는 **미확인**. 홈페이지에서 확인한 것(MLX+llama.cpp 런타임, Bionic, ZDR)만 근거로 남김.
- **Ollama**: 툴 호출 상세 페이지가 404. API는 OpenAI/Anthropic 호환으로 확인됐으나 툴 스키마 세부(개별 모델별 성공률)는 미확인.
- **64GB 실측**: 특정 모델·컨텍스트 크기에 따른 **속도·메모리·비용을 실측하지 않아** 수치로 제시하지 않는다. 위 모든 성능 언급은 "여지·가능성"이지 실측치가 아니다.

## 출처 (원문 직접 조회, 2026-09-29)

1. Ollama 공식 저장소 README — https://raw.githubusercontent.com/ollama/ollama/main/README.md
2. Ollama 공식 API 문서 — https://docs.ollama.com/api
3. llama.cpp 공식 저장소 README — https://raw.githubusercontent.com/ggml-org/llama.cpp/master/README.md
4. llama.cpp server 문서 — https://raw.githubusercontent.com/ggml-org/llama.cpp/master/tools/server/README.md
5. LM Studio 공식 홈페이지 — https://lmstudio.ai/  (docs.lmstudio.ai: 전송 오류로 조회 실패)
