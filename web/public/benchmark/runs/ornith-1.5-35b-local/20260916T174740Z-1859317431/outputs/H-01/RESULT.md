# H-01 — 결과 기록 (RESULT)

- 상태: submitted
- case_version: v0.1-public-draft-2
- 시작/종료: 추정 (실시간 측정 아님)
- 산출물: outputs/H-01/service-config.json, RESULT.md
- 도구: read_file(입력), write_file(복사본), bash(python json 파싱/검증)

## 주장과 근거

- `document-indexer` 서비스의 `request_timeout_seconds`를 **5 → 30**으로 바꿨다.
- 변경은 배열 위치가 아니라 `id`로 식별해 적용했다. `document-indexer`는 배열의 두 번째 항목이지만, 위치가 아니라 `id` 매칭으로 선택했다.
- 다른 서비스(image-preview 12, archive-export 45) 타임아웃은 그대로 유지했다.

## 변경 전후 차이

`diff` 결과 한 줄만 변경됨:

```diff
- {"id": "document-indexer", "request_timeout_seconds": 5, "retry_count": 2, "port": 8765, "enabled": true, "user_note": "manual configuration retained"},
+ {"id": "document-indexer", "request_timeout_seconds": 30, "retry_count": 2, "port": 8765, "enabled": true, "user_note": "manual configuration retained"},
```

- `retry_count`(2), `port`(8765), `enabled`(true), `user_note`("manual configuration retained") 모두 동일.
- `image-preview`, `archive-export`는 변경 없음.

## 검증 내용

- `json.load`로 파싱 성공(잘못된 형식 없음).
- `document-indexer.request_timeout_seconds == 30` 확인.
- `image-preview == 12`, `archive-export == 45` 확인.
- 각 서비스 키 집합이 `{id, request_timeout_seconds, retry_count, port, enabled, user_note}`으로 동일하게 유지됨 확인(새 키/주석 없음).
- 원본 입력 파일 `cases/v0.1/input/service-config.json`은 변경 전 해시 `c55122c9f45afd70…`으로 남아 있음(수행 시점 미수정).

## 도구 수와 확인 방법

- 이 공개 초안은 H-01에 대한 고정 도구 집합(예: "20개 도구")을 제공하지 않는다. 따라서 제공된 실제 도구는 이 작업에 직접 쓰지 않았고, 도구 수는 미측정으로 남긴다.
- 확인 방법은 JSON 파싱 + 대상 서비스 `id` 매칭 + 변경 필드 직접 비교로 대체했다.

## 미확인 사항

- 이 세션은 파일 격리 환경이 아니므로, 도구 호출 제한은 지시문에 의한 제한으로만 적용한다.
