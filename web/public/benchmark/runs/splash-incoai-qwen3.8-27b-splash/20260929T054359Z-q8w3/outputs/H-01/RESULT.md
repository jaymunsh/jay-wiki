# H-01 RESULT

- 상태: submitted
- 문제 버전: v0.1-public-draft-2
- 시작: 2026-09-29T06:06:29Z (agent-observed)
- 종료: 2026-09-29T06:08:30Z (agent-observed)
- 경과: 약 120초
- 입력: `tool-workspace/service-config-original.json` (원본 `cases/v0.1/input/service-config.json` 사본, 원본은 미수정)
- 산출물: `outputs/H-01/service-config.json` (제출본)

## 변경 전후 차이

```diff
-     {"id": "document-indexer", "request_timeout_seconds": 5, ...
+     {"id": "document-indexer", "request_timeout_seconds": 30, ...
```

`document-indexer`의 `request_timeout_seconds`만 5 → 30. 단일 필드 변경.

## 유지 확인 (Python으로 파싱·대조)

- 최상위 키·서비스 개수·각 서비스의 키 집합이 변경 전과 동일.
- 대상은 `id == "document-indexer"`로 식별 (배열 위치가 아니라 id).
- 다른 서비스 타임아웃: image-preview 12, archive-export 45 (유지).
- `retry_count`, `port`, `enabled`, `user_note` 모두 유지. 주석·새 키 없음.
- 수정 뒤 JSON 파싱 성공.

## 사용 가능한 실제 도구

- 이 세션에서 제공된 도구: bash, read, write, edit, glob, grep, webfetch, task, question (총 9개). 확인 방법: 세션 시스템 프롬프트에 열거된 도구 목록. 하네스 제공 실제 도구임을 밝히며, "모든 모델에게 동일한 도구 20개" 시험으로 표시하지 않는다.
- 토큰·속도·비용: 미제공 (null, not_exposed).
