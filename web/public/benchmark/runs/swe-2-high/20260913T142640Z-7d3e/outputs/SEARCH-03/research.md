# Ollama vs llama.cpp vs LM Studio — Apple Silicon Mac 64GB 기준 비교

조사 기준일: 2026-09-13(UTC). 용도는 한국어 글쓰기와 코딩 도구 연동이다. 공식 문서·저장소를 우선 사용했고, 속도·메모리·비용은 직접 측정하지 않았으므로 실측 주장을 하지 않는다.

## 비교표

| 기준 | Ollama | llama.cpp | LM Studio |
|---|---|---|---|
| 설치·운영 | 앱/CLI 설치 후 `ollama serve`로 상주 서버. 모델은 `ollama pull` 또는 Modelfile+`ollama create`로 로컬 레지스트리에 등록 [S1][S2] | 소스 빌드 또는 바이너리로 `llama-server` 실행. 모델 파일 경로 또는 `-hf`로 HF에서 직접 지정 [S3][S4] | GUI 앱에서 모델 검색·다운로드·로드. Developer 탭 또는 `lms` CLI로 서버 시작, 헤드리스용 `lms daemon`(llmster) 제공 [S5][S6] |
| 지원 모델 형식 | GGUF를 Modelfile로 등록해 사용(Safetensors는 변환 필요). 자체 레지스트리 카탈로그 [S2] | GGUF 직접 로딩 [S3] | GGUF(llama.cpp 엔진)와 Apple Silicon에서는 MLX도 지원 [S7][S8] |
| 로컬 API | 자체 REST API(`localhost:11434`) + OpenAI 호환 `/v1/chat/completions`, `/v1/responses` 부분 지원 [S9][S10] | HTTP 서버 + OpenAI 호환 `/v1/...`, Anthropic 호환 `/v1/messages` (단, "강한 호환성 주장은 없다"고 명시) [S3][S4] | `/api/v1/*` 자체 REST + OpenAI 호환 + Anthropic 호환 엔드포인트. 기본 포트 1234 [S5][S6] |
| 툴 호출 조건 | `tools` 파라미터로 함수 정의 전달. 모델별 지원 여부에 의존("models with tool calling capabilities" 목록 안내) [S10] | `--jinja`로 서버 시작 + 모델의 도구 인식 Jinja 템플릿 필요. 병렬 호출은 일부 모델·기본 꺼짐(`parallel_tool_calls` 지정) [S4] | `/v1/chat/completions`의 `tools` 파라미터. 모델 출력을 파싱해 `tool_calls`로 변환, 파싱 실패 시 일반 content로 반환. "모든 모델이 어느 정도 수준의 tool use 지원"이라고 문서화 [S11] |
| 오프라인 사용 | 모델 확보 후 로컬 레지스트리에서 실행 가능. 로컬 GGUF를 `ollama create`로 등록하면 다운로드 없이 사용 가능 [S2] | 완전 오프라인 가능. `--offline` 플래그로 캐시 강제·네트워크 차단 옵션도 있음 [S4] | 모델 다운로드에는 네트워크 필요, 실행은 로컬에서 수행 [S5][S8] |

## 조건별 추천

- **GUI 없이 가볍게 API만 띄우고 싶을 때**: llama.cpp. 단일 바이너리로 `127.0.0.1:8080`에 서버가 뜨고 OpenAI·Anthropic 호환 엔드포인트를 제공한다. 대신 툴 호출은 `--jinja`와 모델의 도구 인식 템플릿을 별도로 확인해야 하고, 극단적 KV 양자화는 도구 호출 성능을 깎을 수 있다는 주의가 있다 [S4].
- **모델 관리·버전을 덜 신경 쓰고 싶을 때**: Ollama. 레지스트리 기반 관리와 OpenAI 호환 경로가 정리되어 있고, 코딩 도구 연동에 필요한 `tools` 파라미터와 스트리밍을 제공한다. 다만 `/v1/chat/completions`는 일부 필드(`tool_choice`, `logit_bias` 등)가 미지원이다 [S9][S10].
- **MLX 모델이나 GUI 중심 워크플로를 원할 때**: LM Studio. Apple Silicon에서 MLX 엔진 선택지가 있고, `/api/v1/chat`의 상태 유지 채팅·MCP 연동 같은 자체 REST 기능이 있다 [S5][S6][S11].

## 미확인 사항

- 세 도구 모두 "API의 툴 호출 지원"과 "개별 모델의 툴 호출 품질"은 다른 문제다. 실제 쓸 한국어 글쓰기·코딩 모델이 각 경로에서 기대대로 tool call을 생성하는지는 직접 확인이 필요하다.
- 64GB Mac에서의 실제 속도·메모리 점유·발열은 직접 측정하지 않아 비교 불가. 문서의 성능 수치도 다른 장비 기준이라 옮기지 않았다.
- LM Studio의 상세 라이선스·무료 범위 조건은 이번 조사에서 확인하지 않았다.
- 조회 시점(2026-09-13) 이후 API 지원 범위는 달라질 수 있다.
