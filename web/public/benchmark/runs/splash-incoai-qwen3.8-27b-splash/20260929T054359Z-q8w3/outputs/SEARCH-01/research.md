# SEARCH-01 — Python 3.12 `tomllib` 검증 (읽기·쓰기·추가 버전·file mode)

## 방법
- Python **공식 문서 원문**을 webfetch로 직접 조회 (검색 결과 요약이 아닌 페이지 전체).
- 조회 날짜: 2026-09-29. 조회한 문서: Python 3.12.14 / 3.11.16 공식 문서.
- 검색 엔진은 사용 불가(브라우저 자동화 없음) → 대신 **공식 문서 URL을 직접 웹페치**하여 원문을 읽음.
- 출처 2건 모두 **원문 전체를 직접 읽은 경우**(검색 결과 요약만 본 것이 아님).

## 결론 요약
| 항목 | 결론 | 근거(문서) |
|---|---|---|
| TOML 읽기(파싱) | **지원** | "This module provides an interface for parsing TOML 1.0.0." |
| TOML 쓰기(작성) | **미지원** | "This module does not support writing TOML." (문서에서 강조) |
| 표준 라이브러리 추가 버전 | **3.11** | "Added in version 3.11." / PEP 680 |
| 파일 읽기 file mode | **바이너리 `"rb"`** | `tomllib.load`: "readable and binary file object"; 예제 `open("pyproject.toml", "rb")` |

## 상세 근거

### 1) 읽기(파싱) — 지원
- 3.12 `tomllib` 문서: "This module provides an interface for parsing TOML 1.0.0. The primary purpose of this module is parsing of pyproject.toml files, in the form defined by PEP 518."
- API:
  - `tomllib.load(fp, *, parse_float=float)` — "Read a TOML file. The first argument should be a readable and binary file object. Return a dict."
  - `tomllib.loads(s, *, parse_float=float)` — "Load TOML from a str object. Return a dict."
- 예외: `tomllib.TOMLDecodeError`(`ValueError` 서브클래스) — 형식 오류·인코딩 오류 시 발생.
- 문서 예제: `with open("pyproject.toml", "rb") as f: data = tomllib.load(f)`.

### 2) 쓰기(작성) — 미지원
- 3.12 `tomllib` 문서(강조 문장): **"This module does not support writing TOML."**
- 문서가 제3자 대안 제시:
  - "The Tomli-W package is a TOML writer that can be used in conjunction with this module, and aims to be compatible with the syntax accepted by tomllib."
  - "The TOML Kit package is a style-preserving TOML library with both read and write capability, and aims to be compatible with the syntax accepted by tomllib."
- 결론: 3.12 표준 라이브러리 `tomllib`는 **읽기 전용**이며, 쓰기는 별도 설치 패키지(tomli-w, tomlkit 등)가 필요.

### 3) 표준 라이브러리 추가 버전 — 3.11
- 3.12 `tomllib` 모듈 헤더: **"Added in version 3.11."**
- Python 3.11 What's New(신규 표준 라이브러리 모듈): "PEP 680: tomllib — Support for parsing TOML in the Standard Library."
- 3.11 New Modules: "tomllib: For parsing TOML. See PEP 680 for more details. (Contributed by Taneli Hukkinen in bpo-40059.)"
- 즉 3.12도 `tomllib`를 포함(3.11에서 추가되어 이관).

### 4) 파일 읽기 file mode — 바이너리 `"rb"`
- `tomllib.load(fp)`: "The first argument should be a **readable and binary file object**."
- 문서 예제는 `open("pyproject.toml", "rb")` → **바이너리 모드** 필수.
- 문자열은 `tomllib.loads(str)` 사용. 파일은 바이너리 모드(`"rb"`)여야 하며, 텍스트 모드(`"r"`)는 불가.

## 출처 (원문 직접 조회)
1. https://docs.python.org/3.12/library/tomllib.html — Python 3.12.14 공식 문서 (2026-09-29 조회, webfetch)
2. https://docs.python.org/3.11/whatsnew/3.11.html — Python 3.11.16 What's New (2026-09-29 조회, webfetch)
