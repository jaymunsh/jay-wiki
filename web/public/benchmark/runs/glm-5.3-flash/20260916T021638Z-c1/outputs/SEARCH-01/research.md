# SEARCH-01 — Python tomllib의 TOML 읽기·쓰기 지원 확인

조회 날짜: 2026-09-16 (UTC). 조회 방법: 웹 문서 직접 조회 도구로 공식 문서 원문을 읽음 — 검색 결과 요약만 본 것이 아니라 원문 페이지 전체를 조회했다.

## 확인한 사실

1. **쓰기는 지원하지 않는다.** 원문: "This module does not support writing TOML." — tomllib은 읽기(파싱) 전용이다. 문서는 쓰기가 필요하면 서드파티 Tomli-W를, 스타일 보존 편집이면 TOML Kit을 참고하라고 안내한다.
2. **표준 라이브러리 추가 버전은 3.11이다.** 원문: "Added in version 3.11." 따라서 Python 3.12에서도 tomllib은 표준 라이브러리로 포함된다(3.11부터).
3. **파일 읽기 시 필요한 모드는 바이너리 읽기 모드("rb")다.** 원문: `tomllib.load(fp, /, *, parse_float=float)` — "The first argument should be a readable and binary file object." 예제도 `with open("pyproject.toml", "rb") as f:`를 사용한다. 문자열에서 바로 읽는 `tomllib.loads`도 있다.

## 근거 요약

| 주장 | 근거 위치(원문 구절) |
|---|---|
| 읽기만 지원, 쓰기 미지원 | "This module provides an interface for parsing TOML 1.0.0" / "This module does not support writing TOML." |
| 3.11에 추가 (3.12에서도 표준) | "Added in version 3.11." |
| 파일은 바이너리 모드 필요 | "should be a readable and binary file object" + 예제 `open("pyproject.toml", "rb")` |
