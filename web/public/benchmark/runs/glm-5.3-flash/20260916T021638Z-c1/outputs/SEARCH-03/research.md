# SEARCH-03 — Apple Silicon Mac(통합 메모리 64GB)에서 Ollama · llama.cpp · LM Studio 비교

조사 기준 날짜: **2026-09-16**. 환경 가정: Apple Silicon, 통합 메모리 64GB. 용도: **한국어 글쓰기**와 **코딩 도구 연동**. 모든 정보는 아래 나열한 공식 문서·저장소·공식 사이트를 직접 조회한 내용이며, 직접 측정한 성능·메모리·비용 수치는 없다(실측처럼 쓰지 않는다).

## 공통 기준 요약

| 기준 | Ollama | llama.cpp | LM Studio |
|---|---|---|---|
| 설치·운영 방식 | macOS 공식 설치 스크립트/수동 설치 제공(저장소 README) | llama.app에서 설치, Docker, 릴리스 사전 빌드 바이너리, 소스 빌드(README "Quick start") | GUI 앱 다운로드. 헤드리스용 `llmster` 데몬은 설치 스크립트 제공(공식 문서) |
| 모델 형식 | 저장소 예시·모델 생태계 기준 GGUF 계열이 일반적. 저장소 README는 모델 실행 중심으로 기술 | GGUF 전용(저장소에 `gguf-py`, `-hf` 다운로드 예시, 양자화 1.5~8bit 지원 명시) | 자체 런타임이 "MLX와 llama.cpp를 기반"(공식 사이트) — GGUF·MLX 형식 지원으로 해석됨. 세부 지원 목록은 앱에서 확인 필요 |
| 로컬 API | `http://localhost:11434/api` + **OpenAI 호환 `/v1`**, Anthropic 클라이언트 URL도 제공(공식 API 문서) | **OpenAI 호환 API 서버**: `llama serve -hf ...`(README). 전통적으로 llama-server가 REST API 제공 | **OpenAI 호환 + Anthropic 호환 엔드포인트**, REST API v0, 예시 포트 1234(`lms server start --port 1234`). 도구 호출·MCP 지원 문서화 |
| 도구 호출 | API 문서에 OpenAI/Anthropic 호환 섹션 존재. 도구 호출 지원은 호환성 문서에서 모델별 확인 필요(이번 조회에서 원문 세부 미확인) | 서버에 tools 도구 디렉터리 존재. 템플릿 의존적이라 모델별 확인 필요(README에서 세부 미확인) | 공식 문서가 "Tool calling and local agents with MCP"을 명시적으로 지원한다고 기술 |
| 오프라인 사용 | 로컬 서버는 설치·모델 다운로드 후 로컬 동작. 다만 최근 클라우드 모델 옵션은 API 키 필요(공식 문서) | 네트워크 의존 없는 C/C++ 로컬 추론이 목적(README). 모델 파일만 있으면 오프라인 가능 | "Natively local", 음성 데이터도 로컬 처리(공식 사이트). 클라우드 ZDR 정책 안내가 있으나 로컬 사용은 오프라인 가능 |

## 용도별 해석 (출처 근거 위 해석이며 실측 아님)

**한국어 글쓰기**: 세 도구 모두 모델에 따라 품질이 결정되므로, 도구 선택보다 한국어 성능이 검증된 GGUF/MLX 모델을 고르는 일이 중요하다. 64GB 통합 메모리라 Apple Silicon Metal( llama.cpp가 "Apple silicon is a first-class citizen"이라 명시) 또는 MLX(LM Studio) 백엔드가 유리하다. Ollama는 설치·모델 관리가 가장 단순해 글쓰기 용도의 상시 구동에 편리하다.

**코딩 도구 연동**: 코딩 에이전트·에디터는 보통 OpenAI 호환 API를 기대한다. 세 도구 모두 OpenAI 호환 엔드포인트를 제공한다(Ollama `/v1`, llama-server, LM Studio 호환 엔드포인트). LM Studio는 공식 문서에서 도구 호출·MCP 기반 로컬 에이전트를 명시적으로 지원한다. 도구 호출의 실제 동작은 **API 지원과 개별 모델의 능력이 별개**다 — 서버가 tools 필드를 받아도 모델이 툴 호출을 잘하지 못하면 실패한다. 모델별 툴 호출 능력은 각 모델 카드·릴리스 노트로 별도 확인이 필요하다.

## 조건별 추천 (판단 근거는 위 표의 공식 자료)

- 가장 빨리 시작하고 싶다 → **Ollama**. 설치 스크립트·모델 관리·OpenAI 호환 `/v1`이 공식 문서로 정리돼 있다.
- 성능 튜닝·최신 기능 추적이 중요하다 → **llama.cpp**. 소스 빌드·백엔드 선택(Metal 포함)·양자화 옵션이 README에 명시된다.
- GUI와 에이전트·MCP 워크플로가 필요하다 → **LM Studio**. 앱 + 로컬 API + 도구 호출/MCP 지원이 공식 문서로 확인된다. 헤드리스 서버 구성도 `llmster`/`lms`로 가능하다.

## 미확인 사항

- 세 도구의 실측 속도(tok/s)·메모리 점유·한국어 품질 비교: 직접 측정하지 않았다. 이 글에 수치가 없는 이유다.
- Ollama·llama.cpp의 도구 호출 지원 범위와 지원 모델 목록: 호환성 문서의 세부 페이지까지 이번에 읽지 않았다.
- LM Studio의 정확한 지원 형식 목록(GGUF/MLX별 제약): 앱·문서 추가 확인 필요.
- 64GB에서 가용한 최대 모델 크기: 컨텍스트 길이·양자화에 따라 달라져 단정 불가.
