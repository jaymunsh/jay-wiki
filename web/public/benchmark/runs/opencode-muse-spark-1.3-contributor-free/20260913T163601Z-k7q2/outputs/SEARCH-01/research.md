# SEARCH-01: Python 3.12 `tomllib`의 읽기·쓰기 지원 확인

조회 날짜: 2026-09-13 (UTC). 공식 문서 원문을 직접 읽음.

## 결론

- TOML 읽기: 지원한다. `tomllib.load(fp)`와 `tomllib.loads(s)`가 TOML 1.0.0 파싱 인터페이스를 제공한다.
- TOML 쓰기: 지원하지 않는다. 문서는 "This module does not support writing TOML."이라고 명시한다. 쓰기가 필요하면 Tomli-W(쓰기 전용)나 TOML Kit(읽기·쓰기, 스타일 보존)를 함께 쓰라고 안내한다.
- 표준 라이브러리 편입 버전: 3.11에서 추가되었다("Added in version 3.11."). 따라서 Python 3.12의 `tomllib`도 읽기는 지원하고 쓰기는 지원하지 않는다.
- 파일을 읽을 때 필요한 모드: 바이너리 모드이다. 첫 인자는 "readable and binary file object"이어야 하며, 예시는 `open("pyproject.toml", "rb")`이다.

## 근거 구분

- 원문 직접 읽기: 위 4개 항목 모두 공식 문서 페이지 본문에서 직접 확인함(아래 sources.json의 URL).
- 검색 결과 요약만 본 항목: 없음.
