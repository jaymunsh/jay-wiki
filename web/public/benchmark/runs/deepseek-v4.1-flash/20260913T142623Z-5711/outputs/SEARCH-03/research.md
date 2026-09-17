# SEARCH-03 — Apple Silicon 64GB 환경 로컬 LLM 도구 비교

조사 기준일: **2026-09-13 (UTC)**. 환경: Apple Silicon Mac, 64GB 통합 메모리. 용도: 한국어 글쓰기, 코딩 도구 연동. `[S#]`는 `sources.json` 항목이며 출처 유형을 구분했다. 제3자 블로그는 근거로 쓰지 않았다.

## 1. 비교표

| 기준 | Ollama | llama.cpp | LM Studio |
|---|---|---|---|
| 설치·운영 | 앱 설치, 서버 자동, `ollama pull` `[S1]` | 소스 빌드/바이너리, `llama serve` `[S8]` | GUI Developer 탭, `lms server start` `[S14]` |
| 모델 형식 | GGUF, Safetensors `[S5]` | GGUF `[S8]` | GGUF + MLX `[S12]` |
| 로컬 API | `/api/*` + `/v1/*` `[S3][S4]` | `/v1/*` + `/completion`, `/v1/messages` `[S10]` | `/v1/*` + Anthropic 호환 + REST `[S14][S15]` |
| 기본 주소 | `127.0.0.1:11434` `[S2]` | `127.0.0.1:8080` `[S10]` | `localhost:1234` `[S15]` |
| 툴 호출 | `tools` 파라미터, "if supported" `[S3]` | `--jinja` 필요, 병렬 기본 off `[S11]` | `/v1/chat/completions`, Native/Default `[S16]` |
| 오프라인 | 로컬 실행, 다운로드만 인터넷 `[S2]` | 완전 로컬, `--offline` `[S10]` | "entirely offline" `[S18]` |
| Apple Silicon | Metal API 지원 `[S6]` | "first-class citizen", Metal `[S8]` | M1~M4 지원, Intel 미지원 `[S13]` |

## 2. 핵심 사실

**설치·운영.** Ollama는 앱 설치 후 서버가 자동 실행되고 모델은 `ollama pull`로 받는다. 모델은 기본 5분 메모리 유지이며 `keep_alive`/`OLLAMA_KEEP_ALIVE`로 조정한다 `[S1][S2]`. llama.cpp는 빌드가 전제이고 macOS는 Metal이 기본 활성이라 `-DGGML_METAL=OFF`나 `--n-gpu-layers 0`으로 끄고 완전 배제는 `--device none`을 쓴다 `[S8][S9]`. LM Studio는 GUI가 기본이고 런타임 교체와 헤드리스(llmster)를 지원한다 `[S12][S14]`.

**모델 형식.** Ollama는 GGUF와 Safetensors를 가져오고(`FROM`, `ADAPTER`) `ollama create --quantize`로 양자화한다 `[S5]`. llama.cpp는 GGUF와 1.5~8비트 정수 양자화 `[S8]`. LM Studio는 GGUF와 MLX `[S12]`.

**로컬 API.** Ollama는 `base_url='http://localhost:11434/v1/'`에 `api_key='ollama'`(무시됨)를 넣고, `/v1/chat/completions`가 Tools·Vision을 지원하며 `/v1/responses`는 v0.13.3 추가다 `[S4]`. llama.cpp와 LM Studio는 OpenAI 호환 `/v1/*`와 Anthropic 호환 경로를 함께 제공한다 `[S10][S14][S15]`. Anthropic 호환을 문서에 명시한 것은 llama.cpp와 LM Studio다.

**툴 호출 — 도구 API와 모델 능력은 별개다.** 세 도구 모두 툴 호출 API는 갖췄지만 실제 호출 여부는 모델과 템플릿에 달렸다. Ollama는 "for the model to use if supported"라 하며 단일 툴 호출 모델에만 권장한다 `[S3][S7]`. llama.cpp는 `--jinja`가 필요하고, **병렬 툴 호출은 기본이 꺼져 있어 `"parallel_tool_calls": true`를 보내야 켜진다** `[S11]`. LM Studio는 모든 모델이 최소 수준은 지원하되 Native/Default 두 단계이고, 어긋나면 `tool_calls` 대신 `content`로 돌아온다 `[S16]`.

**오프라인.** 세 도구 모두 모델 확보 후 로컬에서 동작한다. Ollama는 모델 다운로드에만 인터넷이 필요하고 클라우드 기능을 끄면 local only가 된다 `[S2]`. llama.cpp는 `--offline`으로 캐시를 강제하고 네트워크를 막는다 `[S10]`. LM Studio는 채팅·RAG·로컬 서버가 인터넷 없이 동작하고 검색·다운로드·업데이트만 연결이 필요하다고 한다 `[S18]`.

## 3. 조건별 추천

- **한국어 글쓰기 + 빠른 시작**: Ollama. 설치·모델 관리가 가장 단순하고 OpenAI 호환 경로로 기존 도구에 붙이기 쉽다 `[S1][S2][S4]`.
- **코딩 도구 연동·세밀한 서버 제어**: llama.cpp. Anthropic 호환과 `/v1/responses`를 모두 문서에 명시하고 `--jinja`·`parallel_tool_calls`·MCP·내장 도구를 직접 제어한다 `[S10][S11]`.
- **GUI 중심 + MLX 실험**: LM Studio. GGUF와 MLX를 함께 다루고 서버 켜기가 GUI로 통일된다. 모델 선택 시 툴 호출 배지를 확인해야 한다 `[S12][S16]`.
- **여러 기기에서 서버 공유**: LM Studio의 "Serve on Local Network"가 가장 명시적이다. 문서는 "Any bind other than `127.0.0.1` exposes the server beyond localhost; we recommend enabling authentication"이라고 경고한다 `[S17]`.

## 4. 미확인 사항

- **속도·메모리·전력·비용**: 세 도구 모두 이 환경에서 실측하지 않았고, 문서 예시 수치도 인용하지 않았다.
- **Ollama의 Anthropic 호환**: 조회한 공식 문서에서 확인하지 못했다. "없다"가 아니라 "확인하지 못했다"이다.
- **LM Studio 포트 1234**: 문서가 "assume the server port is `1234`"로 서술해 하드 기본값 단정은 확인하지 못했다 `[S15]`.
- **Ollama Metal 가속의 자동 활성 여부**: 공식 페이지는 Metal API 지원까지만 밝히고 자동 활성 여부는 서술하지 않는다 `[S6]`. 제3자 설명은 채택하지 않았다.
- **한국어 출력 품질**: 측정하지 않았고 모델에 좌우된다.
- **문서 버전 차이**: `[S9]~[S11]`은 고정 커밋 스냅샷, `[S8]`은 조회 시점 README다.
- **툴 호출 성공률**: 세 도구 모두 정량 수치를 제시하지 않으며 측정하지 않았다.
