# SEARCH-01 — Python 3.12 `tomllib` 기능 확인

- 조사 기준 날짜: 2026-09-17
- 방법: 공식 문서 원문을 직접 읽음 (`web_fetch`로 `docs.python.org` 200 응답을 받아 섹션 본문 확인). 검색 요약만 보지 않고 원문 구절을 인용하여 확인함.
- 출처: Python Software Foundation 공식 문서 (아래 `sources.json`)

## 질문과 답

### 1) `tomllib`이 TOML 읽기와 쓰기를 각각 지원하는가?

- **읽기: 지원한다.** `tomllib.load()`는 파일 객체에서 TOML을 읽어 `dict`를 반환하고, `tomllib.loads()`는 문자열에서 TOML을 읽어 `dict`를 반환한다.
- **쓰기: 지원하지 않는다.** 공식 문서는 모듈 설명에 “This module does not support writing TOML.”(이 모듈은 TOML을 쓰지 않는다)라고 명시한다.
- 따라서 “읽기도 하고 쓰기도 한다”는 주장은 틀리고, “읽기만 한다”가 맞다.

### 2) `tomllib`이 표준 라이브러리에 추가된 버전은?

- **Python 3.11**이다. 문서 헤더에 “Added in version 3.11.”로 적혀 있다. 3.12는 이 모듈을 그대로 유지하는 버전이다.
- 따라서 “3.12에서 처음 추가되었다”는 주장은 틀리고, “3.11에서 추가되었고 3.12에서 사용 가능하다”가 맞다.

### 3) 파일을 읽을 때 필요한 모드는?

- **이진 모드 `rb`**다. `tomllib.load()`는 “a readable and binary file object”를 첫 인자로 요구하며, 문서 예제는 `with open("pyproject.toml", "rb") as f:`로 연다.
- 텍스트 모드 `r`/`utf-8`가 아니라 이진 스트림을 요구한다.

## 근거 인용 (공식 원문)

- 모듈 설명: “This module provides an interface for parsing TOML 1.0.0 … This module does not support writing TOML.”
- 추가 버전: “Added in version 3.11.”
- `load()`: “Read a TOML file. The first argument should be a readable and binary file object. Return a `dict`.”
- `loads()`: “Load TOML from a `str` object. Return a `dict`.”
- 예제: `with open("pyproject.toml", "rb") as f:`
- 참고 (쓰기): “The Tomli-W package is a TOML writer that can be used in conjunction with this module.” — 쓰기는 외부 패키지로 해결한다.

## 결론

`tomllib`은 **읽기 전용** 표준 라이브러리이며 **3.11에서 추가**되었고, 파일은 **이진 `rb` 모드**로 연다. **쓰기는 지원하지 않으므로** `tomli-w` 같은 외부 패키지를 써야 한다.
