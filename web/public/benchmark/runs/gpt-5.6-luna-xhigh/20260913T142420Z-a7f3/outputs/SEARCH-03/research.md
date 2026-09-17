# Apple Silicon 64GB에서 로컬 모델 실행기 비교

조사 기준일: 2026-09-13 (KST). 대상은 Apple Silicon Mac의 통합 메모리 64GB, 용도는 한국어 글쓰기와 코딩 도구 연동이다. 아래 비교는 공식 문서에 적힌 기능과 조건을 정리한 것이며, 이 Mac에서의 속도·메모리 사용량·비용을 직접 측정한 결과가 아니다.

| 기준 | Ollama | llama.cpp | LM Studio |
|---|---|---|---|
| 설치·운영 | macOS용 앱/CLI와 `ollama serve` 중심. 모델을 `ollama pull`로 받아 로컬 이름으로 관리한다. | 소스 빌드, 릴리스 바이너리 또는 Docker. `llama-server`를 직접 실행하고 옵션을 세밀하게 지정한다. | 데스크톱 GUI가 기본이고 `lms` CLI와 GUI 없는 `llmster`도 제공한다. 모델 다운로드·로드·서버 시작을 UI/CLI에서 관리한다. |
| 모델 형식 | 공식 Import 문서가 GGUF 파일과 일부 Safetensors 아키텍처를 `Modelfile`의 `FROM`으로 가져오는 방법을 설명한다. | 공식 저장소는 GGUF 모델과 Hugging Face GGUF 사용을 안내하고, Apple Silicon에서 Metal·Accelerate를 우선 지원한다. | Mac에서는 llama.cpp 런타임으로 GGUF, Apple MLX 런타임으로 MLX 모델을 실행할 수 있다. |
| 로컬 API | 기본 API는 `http://localhost:11434/api`; `/v1` OpenAI 호환 경로도 제공하지만 “일부 호환”이다. 로컬 접근에는 인증이 필요하지 않다. | `llama-server`의 기본 예시는 `127.0.0.1:8080`이며 `/v1/chat/completions`, Responses, 임베딩 등 호환 경로를 제공한다. | 로컬 서버의 기본 포트는 `1234`로 안내되며 OpenAI·Anthropic 호환 REST API와 자체 REST API가 있다. |
| 툴 호출 | 공식 Tool Calling 문서가 단일 호출과 병렬 호출의 요청·결과 왕복을 설명한다. 모델이 호출을 만들고 애플리케이션이 함수를 실행한다. | `--jinja`와 올바른 chat template가 필요하며, 네이티브 형식과 Generic 폴백을 구분한다. 병렬 호출은 일부 모델에서만 지원되고 기본값이 꺼진다. | `/v1/chat/completions`와 Responses에서 tools를 받는다. Native는 모델 템플릿과 LM Studio 파서가 모두 맞아야 하고, 그렇지 않으면 Default 형식으로 변환한다. 결과는 모델마다 달라진다. |
| 오프라인 | 모델을 먼저 내려받아야 한다. 공식 문서에서 Ollama 전체 기능의 오프라인 보장 범위는 이번 조사에서 별도 확인하지 못했다. | 서버 문서의 `--offline`은 캐시만 사용하고 네트워크를 막는 모드다. 모델 파일과 바이너리가 이미 있어야 한다. | 공식 Offline Operation 문서는 다운로드한 모델로 채팅·문서 RAG·로컬 서버를 인터넷 없이 쓸 수 있다고 명시한다. 검색·다운로드·런타임 설치는 연결이 필요하다. |

## 조건별 선택

한국어 글쓰기와 코딩 도구를 처음 연결하고 화면에서 모델·템플릿·서버 상태를 확인하려면 LM Studio가 편하다. Developer 탭이나 `lms server start`로 서버를 켜고, OpenAI 클라이언트와 MCP를 같은 로컬 흐름에 연결할 수 있다. Native tool use 배지가 있는 모델을 고르면 변환 단계를 줄일 수 있지만, Default tool use는 모델 결과가 달라질 수 있으므로 실제 도구 왕복을 확인해야 한다.

스크립트와 반복 가능한 개발 환경이 우선이면 Ollama가 단순하다. `localhost:11434` API와 Python/JavaScript 클라이언트, `/v1/chat/completions`를 이용할 수 있고, GGUF를 Modelfile로 가져와 이름과 컨텍스트 설정을 고정할 수 있다. 다만 OpenAI 호환은 부분 지원이고, 모델의 툴 호출 능력과 API의 tools 필드는 별개다. 한국어 편집 도구에서 병렬 호출이 필요한 경우에는 대상 모델과 요청 payload를 함께 검증한다.

백엔드·GPU 레이어·배치·컨텍스트·캐시를 직접 튜닝하거나 `llama-bench`로 pp/tg/pg를 비교하려면 llama.cpp가 맞다. Apple Silicon에서 Metal이 기본이고, 서버의 `--jinja`, 템플릿 파일, `--tools`·MCP·`--offline`을 명시적으로 통제할 수 있다. 이 자유도는 설정 부담과 같은 크기다. `/completion`과 `/v1`의 차이, 파일 도구가 서버 권한으로 실행될 수 있다는 점, 병렬 툴 호출이 모델별이라는 점을 문서화해야 한다.

## 64GB 통합 메모리에서의 실제 판단

64GB라는 용량만으로 모델 크기나 속도를 결정하지 않는다. 모델 파일의 양자화, 컨텍스트 길이, KV 캐시, Metal/MLX/CPU 배치가 함께 메모리를 사용하며, 세 도구 모두 모델을 내려받고 로드한 뒤에야 실제 상태를 확인할 수 있다. 이 조사에서는 설치·모델 다운로드·서버 실행을 하지 않았으므로 t/s, 첫 토큰 시간, 메모리 점유, 전력, 가격은 미확인이다. 선택 후에는 같은 GGUF와 같은 프롬프트로 글쓰기와 코드 도구 호출을 각각 반복하고, 스트리밍·도구 왕복·캐시를 포함한 사용자 대기 시간을 별도로 기록한다.

출처: [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), [Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling), [Ollama import](https://docs.ollama.com/import), [llama.cpp README](https://github.com/ggml-org/llama.cpp/blob/master/README.md), [llama.cpp server reference](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [LM Studio Tool Use](https://lmstudio.ai/docs/developer/openai-compat/tools), [LM Studio Offline Operation](https://lmstudio.ai/docs/app/offline), [LM Studio lms/llmster](https://lmstudio.ai/docs/app/basics/lmstudio-vs-llmster-vs-lms).
