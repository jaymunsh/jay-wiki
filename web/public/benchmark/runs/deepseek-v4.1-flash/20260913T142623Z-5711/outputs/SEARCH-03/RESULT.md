# SEARCH-03 실행 기록

## 상태

- 상태: `submitted` (산출물 제출 완료, 채점은 미채점)
- 웹 검색·원문 조회: **수행함**. 검색 4회, 공식 문서·저장소 페이지 조회 다수.
- 시계 시작(UTC): `2026-09-13T15:03:21Z` (epoch 1789311801)
- 시계 종료(UTC): `2026-09-13T15:07:55Z` (epoch 1789312075)
- 소요 시간: `274000 ms` (약 4분 34초, agent-observed wall clock)
- 한도: 15분. 한도 내 완료.
- 조사 기준일: 2026-09-13 (UTC). 문서에 실행 날짜를 명시했다.

## 조사한 출처 (18건, 전부 공식)

출처 유형을 구분해 `sources.json`에 기록했다.

| 제품 | 출처 수 | 유형 |
|---|---|---|
| Ollama | 7 (`S1`~`S7`) | 공식 저장소 README 1, 공식 문서 6 |
| llama.cpp | 4 (`S8`~`S11`) | 공식 저장소 README 1, 고정 커밋 스냅샷 3 |
| LM Studio | 7 (`S12`~`S18`) | 공식 문서 7 |

`S9`~`S11`은 WRITE-01·THINK-01의 공통 입력으로 고정된 커밋 `4a89937354190cef5a97baf8eeb17336105eb72d` 스냅샷이고, `S8`은 조회 시점의 `master` README다. 버전 차이가 있을 수 있음을 본문에 적었다.

## 검색 결과 요약만 본 경우 vs 원문을 읽은 경우

- 검색은 공식 문서 위치를 찾는 데만 썼다. 결론의 근거는 모두 공식 문서·저장소 원문 인용이다.
- 제3자 글 7건은 `sources.json`의 `secondary_sources_not_used_as_evidence`에 분리하고 `used_as_evidence: false`로 표시했다. 특히 "Ollama의 Metal 가속이 자동 활성"이라는 제3자 설명은 채택하지 않고 미확인 항목으로 남겼다.
- Ollama의 Apple Silicon 지원은 검색 결과가 제3자뿐이었으므로, `docs.ollama.com/gpu`를 직접 열어 "Ollama supports GPU acceleration on Apple devices via the Metal API." 문장을 확인한 뒤 근거로 썼다.

## 산출물

| 파일 | 내용 | 분량 |
|---|---|---|
| `research.md` | 한국어 비교표(7개 기준 × 3도구), 핵심 사실, 조건별 추천, 미확인 사항 | **3,492 Unicode 코드 포인트** (목표 2,000~3,500, 범위 내) |
| `sources.json` | URL·출처 유형·조회 구간·뒷받침 항목·인용문·미사용 제3자 목록 | JSON |

### 핵심 결론 요약

- 세 도구 모두 Apple Silicon에서 동작하고 OpenAI 호환 로컬 API를 제공한다. 기본 주소는 Ollama `127.0.0.1:11434`, llama.cpp `127.0.0.1:8080`, LM Studio `localhost:1234`(문서 예제 기준).
- 모델 형식은 Ollama가 GGUF+Safetensors, llama.cpp가 GGUF, LM Studio가 GGUF+MLX다.
- **툴 호출은 "도구 API 지원"과 "개별 모델의 능력"을 구분해야 한다.** Ollama는 "if supported", llama.cpp는 `--jinja` 필요 + 병렬 툴 호출 기본 off, LM Studio는 Native/Default 2단계다.
- 조건별 추천: 한국어 글쓰기·빠른 시작 → Ollama, 코딩 도구 연동·세밀한 제어 → llama.cpp, GUI·MLX → LM Studio, 네트워크 공유 → LM Studio(인증 권장 경고 있음).
- 실제 속도·메모리·전력·비용은 측정하지 않았고, 문서 예시 수치도 이 환경 값이 아니므로 인용하지 않았다.

## 미측정 항목

- 토큰 수, 첫 토큰 응답 시간, 출력 속도, 비용: `null` (`not_exposed`).
- 호출·재시도 횟수: 검색 4회와 문서 조회는 관측했으나 모델 API 호출 수는 노출되지 않아 `null`.
- 개별 웹 요청 완료 시각: `null` (`not_exposed`). 조회 구간만 기록했다.
- 세 도구의 이 환경 실측 성능: 측정하지 않음.

## 범위 준수

생성한 파일은 `outputs/SEARCH-03/` 안에만 있다. 프로젝트 원본·설정·다른 실행 결과를 수정하지 않았고, 전역 설치·외부 배포·커밋도 하지 않았다. 모델 다운로드나 서버 실행은 하지 않았고, 공식 문서의 명령은 분석 대상으로만 읽었다.
