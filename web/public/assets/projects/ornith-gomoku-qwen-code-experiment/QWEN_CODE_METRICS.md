# Qwen Code + oMLX 실험 기록

이 문서는 블로그 초안이 아니라, 나중에 글을 작성할 때 참고할 수 있는 사실·수치 중심의 실험 메모다.

## 측정 시점

- 측정일: 2026-09-03
- 작업 폴더: `qwen-test`
- 작업 내용: HTML 기반 싱글플레이 오목 웹앱 구현
- 하네스: Qwen Code
- Qwen Code 버전: `0.22.3`
- 호스트: Apple Silicon M1 Max 64GB
- 로컬 백엔드: oMLX OpenAI 호환 API
- 엔드포인트: `http://127.0.0.1:8888/v1`

## 사용 모델과 생성 설정

- 모델 ID: `Ornith-1.5-35B-A3B-oQ6-gs128-mtp-vision`
- 모델 유형: oQ6, MTP, vision 모델
- 컨텍스트 윈도우: `98,304` 토큰
- 최대 출력 토큰: `32,768` 토큰
- 추론 모드: 활성화
- Temperature: `0.7`
- Top-p: `0.8`
- Top-k: `20`
- 최대 재시도: `5`
- 요청 타임아웃: `3,600초`

설정 파일에서는 Provider가 `openai`로 표시되지만, 실제 Base URL은 `127.0.0.1:8888`이다. 따라서 이번 세션은 OpenAI 클라우드가 아니라 로컬 oMLX 서버를 사용한 것으로 판단한다.

## Qwen Code 세션 토큰 기록

현재 세션의 Qwen Code 사용량 JSONL에서 집계한 값이다.

| 항목 | 값 |
|---|---:|
| 모델 API 요청 | 179회 |
| 입력 토큰 | 9,705,033 |
| 출력 토큰 | 275,019 |
| 추론 토큰 | 159,202 |
| 캐시 토큰 | 8,327,168 |
| 새로 처리된 입력 토큰 | 약 1,377,865 |
| API 처리 시간 합계 | 11,997.419초 |
| API 처리 시간 환산 | 약 3시간 19분 57초 |
| 요청당 평균 입력 | 약 54,218토큰 |
| 요청당 평균 출력 | 약 1,536토큰 |
| 요청당 평균 API 시간 | 약 67.0초 |

### 캐시 비율

```text
8,327,168 / 9,705,033 × 100 ≈ 85.8%
```

입력 토큰 중 약 85.8%가 캐시 토큰으로 기록됐다.

### 요청 단위 근사 출력 속도

```text
근사 출력 속도 = outputTokens / (apiDurationMs / 1000)
```

| 기준 | 값 |
|---|---:|
| 출력 토큰만 포함한 세션 평균 | 약 22.9 tok/s |
| 출력+추론 토큰 기준 세션 평균 | 약 36.2 tok/s |
| 요청 단위 근사 속도 중앙값 | 약 17.6 tok/s |
| 요청 단위 근사 속도 90백분위 | 약 30.1 tok/s |
| 요청 단위 근사 속도 범위 | 약 0.7~36.9 tok/s |
| 가장 짧은 API 요청 | 4.669초 |
| 가장 긴 API 요청 | 751.732초, 약 12분 32초 |

이 값은 oMLX의 순수 Decode tok/s가 아니다. 요청 시간에 TTFT, Prefill, 컨텍스트 처리, 추론 토큰 생성, 출력 종료 처리가 함께 들어갈 수 있다.

## 도구 호출 기록

Qwen Code 채팅 로그에서 확인한 도구 결과는 183건이다.

| 결과 | 건수 |
|---|---:|
| 성공 | 157건 |
| 오류 | 26건 |
| 성공률 | 약 85.8% |

### 오류 유형

| 오류 유형 | 건수 |
|---|---:|
| `edit_no_occurrence_found` | 8건 |
| `edit_requires_prior_read` | 6건 |
| `invalid_tool_params` | 6건 |
| `shell_execute_error` | 4건 |
| `edit_no_change` | 2건 |

이 오류들은 최종 실패만을 의미하지 않는다. 이후 모델이 파일을 다시 읽거나 명령을 수정해 복구한 중간 오류도 포함한다.

## 생성된 프로젝트 규모

`qwen-test` 현재 파일 기준이다.

| 구성 | 값 |
|---|---:|
| 전체 파일 | 16개 |
| JavaScript 애플리케이션 코드 | 1,979줄 |
| HTML·CSS | 415줄 |
| 테스트 코드 | 675줄 |
| README·구현 계획 | 388줄 |
| 전체 줄 수 | 3,457줄 |

주요 모듈:

- `src/game/rules.js`: 렌주룰 규칙 엔진
- `src/game/state.js`: 게임 상태·착수·무르기·직렬화
- `src/game/bot.js`: 하·중·상·최상 봇
- `src/ui/board.js`: Canvas 보드와 금수·승리 표시
- `src/ui/clock.js`: 제한 시간 제어
- `tests/*.test.mjs`: 규칙·상태·봇 테스트

## 테스트 결과

실행 명령:

```bash
cd qwen-test
npm test
npm run check
```

결과:

```text
tests 72
pass 72
fail 0
duration_ms 129.479375
```

`npm run check`의 `node --check src/main.js`도 통과했다.

테스트 범위:

- 흑 선공
- 점유 칸·보드 밖 좌표
- 흑 정확히 5목 승리
- 백 5목 이상 승리
- 흑 33·44·장목 금수
- 열린 3·끊어진 3
- 가장자리·모서리
- 자유 오목 규칙
- 양쪽 33 제한 변형
- 무승부
- 무르기·기권·시간 초과·재시작
- 상태 직렬화·복원
- 서버용 수순 payload
- 봇 4단계 난이도

표준 렌주룰에서는 흑만 33·44·장목 금지 대상이다. 백 33 제한은 `both33` 변형 규칙에서만 테스트했다.

## Qwen Code에서 확인할 명령

```text
/stats
/context
/about
```

- `/stats`: 세션 토큰, 모델 사용량, 지원 버전에 따라 TTFT·생성 시간·TPS
- `/context`: 컨텍스트 사용량과 구성별 토큰 정보
- `/about`: 모델·Provider·버전 정보

터미널에서는 다음을 사용한다.

```bash
qwen --version
qwen sessions list --json --limit 10
```

사용량 기록 위치:

```text
~/.qwen/usage/token-usage-YYYY-MM.jsonl
```

주요 필드:

- `model`
- `sessionId`
- `inputTokens`
- `outputTokens`
- `thoughtsTokens`
- `cachedTokens`
- `apiDurationMs`

## 다음에 추가할 수치

현재 기록만으로는 다음 값을 정확히 알 수 없다.

- oMLX 순수 Decode tok/s
- 요청별 정확한 TTFT
- Prefill 시간과 Decode 시간의 분리
- GPU·ANE·CPU 사용률
- 모델 실제 메모리 사용량
- KV Cache 실제 크기
- 브라우저 UI 체감 시간
- 모델 로딩 시간과 워밍업 전후 차이

모델 비교 시 기록할 항목:

| 구분 | 측정값 |
|---|---|
| 모델 | 정확한 모델 ID·양자화·MTP/DFlash2 여부 |
| 환경 | Mac 모델·메모리·oMLX 버전 |
| 생성 | TTFT·generation TPS·출력 토큰 |
| 컨텍스트 | 컨텍스트 크기·입력 토큰·캐시 토큰 |
| 에이전트 | API 요청 수·도구 성공률·오류 복구 수 |
| 결과 | 총 작업 시간·테스트 통과·완료 여부 |

## 원자료와 산출 기준

수치의 출처는 다음과 같다.

| 자료 | 확인 내용 |
|---|---|
| `~/.qwen/usage/token-usage-2026-09.jsonl` | 모델 요청 수, 입력·출력·추론·캐시 토큰, API 처리 시간 |
| Qwen Code 세션 채팅 로그 | 도구 결과 수와 오류 유형 |
| `qwen-test/package.json` | 테스트·구문 검사 명령 |
| `qwen-test/README.md` | 구현 기능과 수동 확인 항목 |
| `qwen-test/src/`, `qwen-test/tests/` | 실제 코드·테스트 규모 |
| `<HOME>/.qwen/settings.json` | Provider, 로컬 엔드포인트, 모델별 생성 설정 |

### 수치의 신뢰도

| 분류 | 항목 | 해석 |
|---|---|---|
| 직접 기록 | 모델 ID, 요청 수, 토큰 수, API 시간 | JSONL 필드에서 직접 집계 |
| 직접 실행 | 테스트 72개 통과, 구문 검사 통과 | `npm test`, `npm run check` 실행 결과 |
| 로그 집계 | 도구 성공·오류 수 | 세션 로그의 `toolCallResult` 기준 |
| 근사 계산 | 22.9 tok/s, 36.2 tok/s | 출력 토큰과 API 시간으로 계산한 값 |
| 별도 측정 필요 | 순수 Decode TPS, TTFT, GPU·ANE 사용률 | 현재 사용량 기록만으로는 확인 불가 |

### 근사 TPS를 기록할 때의 주의점

- `apiDurationMs`는 oMLX 화면의 Decode 시간과 같은 필드가 아니다.
- 출력 토큰 기준 22.9 tok/s는 요청 전체 평균이다.
- 추론 토큰을 더한 36.2 tok/s는 전체 생성량 기준의 근사치다.
- 긴 입력의 Prefill, 컨텍스트 처리, TTFT가 결과에 영향을 준다.
- 요청별 속도 분포가 0.7~36.9 tok/s로 넓어 평균 하나만으로는 변동성을 설명하기 어렵다.
- 실제 모델 비교에서는 `/stats`의 generation metrics 또는 oMLX 자체 벤치마크 값을 우선한다.

## 나중에 블로그로 작성할 때의 구성 메모

아직 문장으로 작성하지 않고, 다음 순서로 내용을 풀면 된다.

1. 코딩 에이전트의 성능을 tok/s 하나로 판단하기 어려웠던 배경
2. M1 Max 64GB와 oMLX·Qwen Code·Ornith 연결 구조
3. 실제 모델·컨텍스트·추론·샘플링 설정
4. 179회 API 요청과 약 970만 입력 토큰이라는 작업 규모
5. 22.9 tok/s의 의미와 순수 Decode 속도와의 차이
6. 85.8% 캐시 비율과 긴 컨텍스트의 영향
7. 도구 성공 157건·오류 26건이라는 하네스 안정성 지표
8. 16개 파일, 72개 통과 테스트라는 결과물 검증
9. 다음 모델 비교에서 추가할 TTFT·순수 TPS·메모리·사용률
10. 실제 에이전트 평가에서 속도·안정성·완료 품질을 함께 봐야 한다는 결론

## 기록을 갱신할 때 지켜야 할 것

- 모델을 바꿀 때 모델 ID와 양자화명을 정확히 기록한다.
- 컨텍스트·최대 출력·추론 모드·Temperature를 함께 기록한다.
- 같은 세션의 누적값인지 새 세션의 값인지 구분한다.
- `apiDurationMs` 기반 근사 TPS와 oMLX 순수 TPS를 같은 표에 섞지 않는다.
- 테스트 명령과 통과 수를 결과물과 함께 남긴다.
- 프롬프트와 응답 전문은 저장하지 않고 집계 필드만 사용한다.
- 실험 결과가 바뀌면 기존 수치를 덮어쓰지 말고 측정일과 설정을 별도 항목으로 남긴다.

## 참고 링크

- [Qwen Code 설정 문서](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/)
- [Qwen Code Goals 문서](https://qwenlm.github.io/qwen-code-docs/en/users/features/goals/)
- [Qwen Code 통계 기능 안내](https://qwenlm.github.io/qwen-code-docs/en/blog/updates/weekly-update-2026-07-30/)
- [Qwen Code 토큰 통계 및 캐시 안내](https://qwenlm.github.io/qwen-code-docs/en/blog/updates/weekly-update-2026-06-25/)
