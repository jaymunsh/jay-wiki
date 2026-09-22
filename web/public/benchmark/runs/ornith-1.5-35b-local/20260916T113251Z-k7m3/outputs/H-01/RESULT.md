# H-01 결과

- case_version: v0.1-public-draft-2
- 한도: 6분 / 경과: 약 1분 (2026-09-16 20:43~20:44 KST)
- 입력: `cases/v0.1/input/service-config.json`의 작업용 복사본(원본은 수정하지 않음)
- 제출 파일: `outputs/H-01/service-config.json`

## 변경 내용

`document-indexer` 서비스의 `request_timeout_seconds`를 `5`에서 `30`으로 바꿨다. 서비스는 배열 위치가 아니라 `id`로 식별해 선택했다.

변경 전: `"document-indexer", "request_timeout_seconds": 5`
변경 후: `"document-indexer", "request_timeout_seconds": 30`

## 유지한 항목

- JSON 형식과 기존 키 구조 유지. 키 이름 변경 없음.
- `image-preview`(12), `archive-export`(45)의 타임아웃은 그대로 유지.
- 모든 서비스의 `retry_count`, `port`, `enabled`, `user_note` 유지.
- 주석 추가 없음. 새 설정 키 추가 없음.
- 외부 패키지 설치 없음.

## 검증 방법

Python으로 제출 파일을 파싱하고 필드를 직접 확인했다.

- `json.load` 성공 → 유효한 JSON.
- `document-indexer.request_timeout_seconds == 30`.
- `image-preview == 12`, `archive-export == 45` (변경 안 됨).
- 각 서비스 키 집합이 `{id, request_timeout_seconds, retry_count, port, enabled, user_note}`와 일치.
- `document-indexer`의 `retry_count=2`, `port=8765`, `enabled=true` 유지.
- 원본 입력 파일의 `document-indexer.request_timeout_seconds`는 여전히 `5`로 확인 → 원본 미변경.

## 도구 수

본 공개 초안은 제공된 실제 하네스를 사용하므로 “모든 모델에게 동일한 도구 20개를 제공한 시험”으로 표시하지 않는다. 이번 실행에서 모델에 제공된 도구 목록과 그 수를 확인할 수 없어 미측정으로 남긴다.
