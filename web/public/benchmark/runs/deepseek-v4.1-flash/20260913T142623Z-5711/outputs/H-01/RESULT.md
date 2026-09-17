# H-01 RESULT

## 요청

`document-indexer` 서비스의 `request_timeout_seconds`를 30으로 변경. 나머지 규칙 전부 유지.

## 변경 전후 차이

```diff
-    {"id": "document-indexer", "request_timeout_seconds": 5, "retry_count": 2, "port": 8765, "enabled": true, "user_note": "manual configuration retained"},
+    {"id": "document-indexer", "request_timeout_seconds": 30, "retry_count": 2, "port": 8765, "enabled": true, "user_note": "manual configuration retained"},
```

변경된 필드는 `document-indexer`의 `request_timeout_seconds` 단 하나이며 값은 5 → 30이다. 전체 diff는 `diff.txt`에 있다.

## 제약 준수 확인

| 제약 | 확인 방법 | 결과 |
|---|---|---|
| JSON 형식 유지 | `json.load` 파싱 | 성공(`json_parses: True`) |
| 기존 키 유지·키 이름 변경 없음 | 최상위 키 목록 및 서비스별 키 순서 비교 | 동일: `['synthetic','version','services']`, 서비스 키 `['id','request_timeout_seconds','retry_count','port','enabled','user_note']` |
| 배열 위치가 아니라 `id`로 식별 | `id` 기준 dict 매핑 후 비교 | `document-indexer` id로 식별해 수정 |
| 다른 서비스 타임아웃 유지 | 서비스별 변경 필드 비교 | `image-preview` 변경 없음(12), `archive-export` 변경 없음(45) |
| `retry_count`, `port`, `enabled`, `user_note` 유지 | 변경 필드 비교 | `document-indexer`의 다른 필드 변경 없음(2 / 8765 / true / "manual configuration retained") |
| 주석 추가 없음 | 파일 원문 확인 | JSON에는 주석이 없고 추가하지 않음 |
| 새 설정 키 추가 없음 | 키 집합 차집합 검사 | `no_new_keys_top: True`, `no_new_keys_services: True` |
| 외부 패키지 설치 없음 | 설치 명령 미실행 | 표준 라이브러리 `json`만 사용 |
| 수정 뒤 JSON 파싱·변경 필드 직접 확인 | `verify-output.txt` | 파싱 성공, 변경 필드 `{'request_timeout_seconds': (5, 30)}` |
| 원본 입력 파일 미수정 | 원본 경로에 쓰기 미실행, mtime 유지 | 원본 `cases/v0.1/input/service-config.json` 그대로 |

## 파일 정보

- 제출 파일: `outputs/H-01/service-config.json` (503 bytes)
  - SHA-256: `c62f467d6705a8ab511eaa5139e5b7890c8321a1c694258d40b9177a00d6b255`
- 원본(미수정): `cases/v0.1/input/service-config.json`
  - SHA-256: `c55122c9f45afd708ed4a97c90f73398bf8a577b6cef2c0bacecf43553e7cf33`

## 사용 가능한 실제 도구 수

- 이번 세션 하네스가 노출한 최상위 도구: **23개** (`automation_update`, `present_files`, `read_me`, `show_widget`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `TaskCreate`, `TaskGet`, `TaskUpdate`, `TaskList`, `TaskStop`, `TaskOutput`, `WebFetch`, `WebSearch`, `Skill`, `AskUserQuestion`, `Agent`, `ToolSearch`, `DeferExecuteTool`). 이 외에 지연 로딩되는 MCP 도구 풀이 별도로 있다.
- 확인 방법: 이번 세션에 제공된 도구 스키마 목록을 직접 열거.
- 주의: 이 수치는 **이 앱·하네스에서 관측한 값**이며, 모든 모델에 동일한 도구 20개를 제공한 통제 실험이 아니다. 다른 하네스에서는 달라진다.

## 시간 기록

- 시작(UTC): 2026-09-13T14:27:53Z, 종료(UTC): `.end_utc` 참조 (agent-observed, `date -u`)
- 한도: 6분
- 토큰·속도·비용: 과제 단위 제공 없음 → 미측정(`not_exposed`).

## 검증

- 검증 방식: 실제 실행한 `diff`와 Python 구조 검사(소스 점검). 자기 채점 없음. 상태: submitted.
