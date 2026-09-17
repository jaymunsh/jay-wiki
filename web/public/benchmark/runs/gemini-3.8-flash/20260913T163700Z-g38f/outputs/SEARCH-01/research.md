# Python 3.12 `tomllib` 공식 문서 기능 조사 보고서

- 조사 기준일: 2026년 9월 14일 (KST)
- 공식 문서 URL: https://docs.python.org/3.12/library/tomllib.html

## 1. TOML 읽기 및 쓰기 지원 여부
- **TOML 읽기 (Parsing)**: **지원함**.
  - `tomllib.load(fp)`: 바이너리 파일 객체로부터 TOML 문서를 파싱하여 Python `dict` 객체로 반환.
  - `tomllib.loads(s)`: UTF-8 인코딩된 `str` 객체로부터 TOML을 파싱.
  - TOML 1.0.0 사양(Tom's Obvious Minimal Language)을 완벽하게 지원함.
- **TOML 쓰기 (Writing/Dumping)**: **지원하지 않음**.
  - 공식 문서 첫머리에 `"This module does not support writing TOML."`이라고 명시되어 있음.
  - TOML 쓰기(생성/직렬화)가 필요한 경우 서드파티 패키지인 `Tomli-W` 또는 읽기/쓰기를 모두 지원하는 `TOML Kit`을 사용할 것을 공식 문서에서 안내함.

## 2. 표준 라이브러리 추가 버전
- **추가 버전**: **Python 3.11** (`Added in version 3.11.`)
- Python 3.12 표준 라이브러리에 기본 내장 모듈로 포함되어 별도 설치 없이 `import tomllib`으로 즉시 사용 가능함.

## 3. 파일 읽기 시 필요한 모드
- **필요 모드**: **바이너리 읽기 모드 (`"rb"`)**
- 공식 문서 설명:
  - `"The first argument should be a readable and binary file object."`
  - 텍스트 모드(`"r"`)가 아닌 반드시 바이너리 모드(`"rb"`)로 파일을 열어 `tomllib.load(f)`에 전달해야 함.
- 코드 예시:
  ```python
  import tomllib

  with open("config.toml", "rb") as f:
      data = tomllib.load(f)
  ```

## 4. 원문 인용 및 근거 대조
1. **쓰기 미지원 근거**:
   > "Source code: Lib/tomllib. This module provides an interface for parsing TOML 1.0.0 (Tom’s Obvious Minimal Language, https://toml.io). This module does not support writing TOML."
2. **추가 버전 근거**:
   > "Added in version 3.11."
3. **바이너리 모드 근거**:
   > "tomllib.load(fp, /, *): Read a TOML file. The first argument should be a readable and binary file object. Return a dict."
