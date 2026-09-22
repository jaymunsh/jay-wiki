# H-01 RESULT

- 과제 ID: H-01 / 문제 버전: v0.1-public-draft-2
- 상태: submitted (제출 상태이며 채점 통과가 아님)
- 시작(UTC): 2026-09-22T00:43:16Z (입력 복사 시점)
- 종료(UTC): 2026-09-22T00:43:25Z
- 소요: 9초 (agent-observed, 터미널 `date -u`)
- 제출 파일: `outputs/H-01/service-config.json`
- 입력: `cases/v0.1/input/service-config.json`을 실행 폴더로 복사한 사본만 수정. 원본 SHA-256 `c55122c9f45afd708ed4a97c90f73398bf8a577b6cef2c0bacecf43553e7cf33` (원본=복사본 일치 확인 후 수정).

## 변경 전후 차이

```diff
- {"id": "document-indexer", "request_timeout_seconds": 5, ...}
+ {"id": "document-indexer", "request_timeout_seconds": 30, ...}
```

- 대상은 배열 위치가 아니라 `id: "document-indexer"`로 식별해 선택했다.
- 변경 필드는 `request_timeout_seconds` 하나(5 → 30).

## 검증 내용 (실행 명령과 결과)

`python3`로 JSON 파싱 및 단언 검증:

```text
parse: OK
service count: 3
image-preview   timeout=12 retry=1 port=8766 enabled=True  note='preserve this note'
document-indexer timeout=30 retry=2 port=8765 enabled=True note='manual configuration retained'
archive-export  timeout=45 retry=0 port=8767 enabled=False note='do not enable'
ASSERTIONS: all passed (document-indexer=30, others 12/45 intact, key sets unchanged)
```

`diff -u 원본 수정본`: 위 한 줄 차이만 존재함을 확인.

## 규칙 준수 확인

- JSON 형식·기존 키 유지, 키 이름 변경 없음, 주석 추가 없음, 새 키 추가 없음.
- 다른 서비스 타임아웃(12, 45) 유지, `retry_count`·`port`·`enabled`·`user_note` 유지.
- 외부 패키지 설치 없음(파이썬 표준 라이브러리 `json`만 사용).
- 원본 입력 파일 미수정(해시로 확인), 제출 폴더 사본만 수정.

## 사용 가능한 실제 도구 수

- 12종: read, write, edit, bash, glob, grep, websearch, webfetch, task, todowrite, skill, question.
- 확인 방법: 이 세션에 제공된 도구 정의(하네스 시스템 프롬프트)를 직접 확인한 값. "모든 모델에게 동일한 도구 20개를 준 시험"이 아니며, 이 값은 이번 하네스 기준 관측치다.

## 미확인 사항

- 해당 없음(자체 검증 완료). 단, 자체 검증은 독립 사후 채점이 아니다.

## 토큰·속도·비용

- null / not_exposed (하네스 미노출).
