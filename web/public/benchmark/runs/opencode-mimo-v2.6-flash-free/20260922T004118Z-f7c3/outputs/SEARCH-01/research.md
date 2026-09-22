# SEARCH-01 — Python 3.12의 `tomllib` 읽기/쓰기 지원 확인

- 조사 기준일(실행 날짜): **2026-09-22** (UTC)
- 조회 방식: `websearch`(검색) → `webfetch`로 공식 문서 원문 전체 조회
- 판정 신뢰 구분: 아래 핵심 3개 주장은 **공식 문서 원문을 직접 읽은 경우**(`original_text_read`). 검색 결과 스니펫만 근거로 한 주장은 없음(참조용 검색 결과는 sources.json의 `search_only` 항목으로 구분).

## 확인한 주장

| # | 주장을 요약 | 판정 | 근거 유형 |
|---|---|---|---|
| 1 | Python 3.12에서 `tomllib`는 TOML **읽기**를 지원한다 | 지원함 | original_text_read |
| 2 | Python 3.12에서 `tomllib`는 TOML **쓰기**를 지원한다 | 지원하지 않음 | original_text_read |
| 3 | `tomllib`가 표준 라이브러리에 추가된 버전 | **Python 3.11** (3.12에서도 사용 가능) | original_text_read |
| 4 | 파일을 읽을 때 필요한 모드 | **바이너리 모드 (`"rb"`)**, `tomllib.load(fp)`의 첫 인자는 "readable and binary file object" | original_text_read |

## 근거 (공식 원문)

1. **읽기 지원**: 문서의 함수 정의에 `tomllib.load(fp, ...)` — "Read a TOML file." 과 `tomllib.loads(s, ...)` — "Load TOML from a `str` object." 가 실려 있다. 예제 역시 파일 파싱과 문자열 파싱을 모두 보여 준다.
   - 출처: https://docs.python.org/3.12/library/tomllib.html (섹션 "This module defines the following functions")

2. **쓰기 미지원**: 모듈 서두에 명시 — "This module does not support writing TOML."
   - 같은 페이지 상단 모듈 설명. 쓰기를 원하면 See also로 안내하는 외부 패키지(Tomli-W: dump/dumps 제공, TOML Kit: 읽기·쓰기 모두)가 존재하며, 이는 표준 `tomllib`의 한계를 역으로 확인시켜 준다.
   - 출처: https://docs.python.org/3.12/library/tomllib.html

3. **추가 버전**: "Added in version 3.11." — `tomllib`는 3.11에 추가되었으므로 Python 3.12에는 포함되어 있다(그 자체로 3.12 추가가 아님).
   - 출처: https://docs.python.org/3.12/library/tomllib.html (제목 바로 아래)

4. **읽기 모드**: `tomllib.load` 설명 — "The first argument should be a readable and **binary** file object." 공식 예제는 `with open("pyproject.toml", "rb") as f: data = tomllib.load(f)` 이다. 텍스트 모드(`"r"`)로 열면 반환 객체가 str 조각이 되어 표준 API의 전제와 어긋난다.
   - 출처: https://docs.python.org/3.12/library/tomllib.html (load 정의 + Examples)

## 검색 결과 요약만 본 것 vs 원문을 읽은 것

- **원문 읽음 (original_text_read)**: `https://docs.python.org/3.12/library/tomllib.html` (Python 3.12.14 문서) — 위 4개 주장의 직접 근거. `webfetch`로 페이지 전체를 받아 확인했다.
- **검색 결과 요약만 (search_only, 참고)**: `websearch` 결과로 노출된 `docs.python.org/3/library/tomllib.html`(3.14.7), `docs.python.org/3.11/…`, `docs.python.org/3.15/…`, `docs.python.org/ko/3/…`, `realpython.com/python-toml`, `pypi.org/project/tomli` 등의 스니펫 — 판정에는 쓰지 않고 경로 탐색용으로만 사용했다. 특히 pypi tomli 페이지 스니펫의 "Is there a dumps, write or encode function?" FAQ와 realpython 글은 외부 자료라 공식 3.12 문서보다 우선순위가 낮다.

## 한계

- 본 조회는 docs.python.org 공식 문서 원문에 의존한다. CPython 소스(`Lib/tomllib`)나 실제 3.12 인터프리터에서의 재현 실행은 수행하지 않았다(문서 확인 과제).
- 문서 페이지 갱신 시각은 하단에 "Last updated on Sep 16, 2026"로 표기되어 있다(조회 시점 기준).
