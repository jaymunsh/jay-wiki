# SEARCH-01 — Python `tomllib` 기능 확인

조사 대상: Python 3.12의 `tomllib`이 TOML 읽기와 쓰기를 각각 지원하는지, 표준 라이브러리에 추가된 버전, 파일을 읽을 때 필요한 모드.

조사 일시(UTC): 2026-09-13 (검색·원문 조회 시각은 아래 `sources.json`에 기록)

## 결론

| 질문 | 답 | 근거 |
|---|---|---|
| TOML 읽기 지원? | 지원한다. | Python 3.12 문서: "This module provides an interface for parsing TOML 1.0.0" |
| TOML 쓰기 지원? | 지원하지 않는다. | Python 3.12 문서: "This module does not support writing TOML." |
| 표준 라이브러리 추가 버전? | **Python 3.11** (3.12가 아니다) | Python 3.12 문서: "Added in version 3.11." / PEP 680: `Python-Version: 3.11` |
| 읽을 때 필요한 파일 모드? | **바이너리 모드**(`"rb"`) | 문서: "The first argument should be a readable and binary file object." 예제: `open("pyproject.toml", "rb")` |

즉 `tomllib`은 Python 3.12에 들어 있는 것은 맞지만 3.12에서 새로 추가된 모듈이 아니라 3.11에서 추가된 모듈이며, 읽기 전용이다.

## 근거 상세 (원문에서 직접 인용)

### 1) 추가된 버전 — Python 3.11

Python 3.12 문서 페이지 상단에 다음과 같이 표기되어 있다.

> Added in version 3.11.

같은 내용이 표준 라이브러리 제안 문서(PEP 680)에도 있다.

> Python-Version: 3.11

3.11 릴리스 노트("What's New In Python 3.11")의 새 모듈 목록에도 항목이 있다.

> `tomllib`: For parsing TOML. See PEP 680 for more details. (Contributed by Taneli Hukkinen in bpo-40059.)

따라서 "Python 3.12의 tomllib"이라고 부르는 것은 3.12 환경에서 사용 가능하다는 뜻으로는 맞지만, "3.12에서 추가되었다"는 뜻으로 읽으면 틀리다.

### 2) 읽기 전용 — 쓰기 미지원

Python 3.12 문서의 모듈 설명 첫 문단:

> This module provides an interface for parsing TOML 1.0.0 (Tom's Obvious Minimal Language, https://toml.io). This module does not support writing TOML.

PEP 680도 같은 결정을 명시한다.

> Note that this PEP does not propose `tomllib.dump` or `tomllib.dumps` functions; see Including an API for writing TOML for details.

> Therefore, writing TOML is left to third-party libraries.

쓰기를 뺀 이유로 PEP 680은 다음을 든다.

> The ability to write TOML is not needed for the use cases that motivate this PEP: core Python packaging tools, and projects that need to read TOML configuration files.

> Use cases that involve editing an existing TOML file (as opposed to writing a brand new one) are better served by a style preserving library.

> Even without considering style preservation, there are too many degrees of freedom in how to design a write API.

문서는 쓰기가 필요할 때의 대안도 안내한다.

> The Tomli-W package is a TOML writer that can be used in conjunction with this module...

> The TOML Kit package is a style-preserving TOML library with both read and write capability. It is a recommended replacement for this module for editing already existing TOML files.

즉 표준 라이브러리만으로 TOML을 쓰려면 `tomllib`로는 불가능하고 `tomli-w`나 `tomlkit` 같은 외부 패키지가 필요하다.

### 3) 파일 모드 — 바이너리

`tomllib.load`의 서명과 설명(Python 3.12 문서):

> `tomllib.load(fp, /, *, parse_float=float)`
> Read a TOML file. The first argument should be a readable and binary file object. Return a `dict`.

문서의 예제 코드도 바이너리 모드를 쓴다.

```python
import tomllib

with open("pyproject.toml", "rb") as f:
    data = tomllib.load(f)
```

여기서 `"rb"`가 곧 "읽기 + 바이너리" 모드다. 텍스트 모드(`"r"`)로 연 객체를 넘기는 것은 문서가 요구하는 조건("readable and binary file object")에 맞지 않는다. 문자열을 직접 다룰 때는 파일 객체 대신 `tomllib.loads`를 쓴다.

> `tomllib.loads(s, /, *, parse_float=float)`
> Load TOML from a `str` object. Return a `dict`.

### 4) 구현 계보 (보조 사실)

PEP 680은 표준 라이브러리 구현이 서드파티 `tomli`를 기반으로 한다고 밝힌다.

> This PEP proposes basing the standard library support for reading TOML on the third-party library `tomli` (github.com/hukkin/tomli).

PEP 680의 상태는 `Final`이다.

## 검색 결과 요약만 본 경우와 원문을 읽은 경우의 구분

- **원문을 직접 읽은 것(1차 근거)**: `https://docs.python.org/3.12/library/tomllib.html`, `https://docs.python.org/3/library/tomllib.html`(최신 버전 페이지), `https://peps.python.org/pep-0680/`, `https://docs.python.org/3/whatsnew/3.11.html`. 위 인용문은 모두 이 네 페이지에서 직접 확인했다.
- **검색 결과 목록만 본 것(2차, 근거로 쓰지 않음)**: 검색엔진 결과에 나타난 제3자 페이지들(예: `realpython.com`, `bookstack.cn`, `blog.csdn.net`). 이들의 요약 문장은 결론의 근거로 인용하지 않았고, 공식 문서와 일치하는지 확인하는 용도로만 참고했다.
- 검색은 공식 문서 위치를 찾기 위해 사용했고, 사실 판단은 공식 원문 인용으로만 했다.

## 한계

- 조회한 문서 페이지는 `3.12.14` 버전 페이지와 최신(`3.14.7`) 페이지다. 이번 응시 환경의 Python은 3.13.12이며, `tomllib`의 읽기 전용 성질과 바이너리 요구는 3.11 이후 동일하게 유지된다는 것만 문서로 확인했다. 실제로 코드를 실행해 검증하지는 않았다(이 과제는 문서 확인 과제이며, 실행 검증은 요구되지 않았다).
- 문서 페이지는 버전이 올라가며 내용이 바뀔 수 있다. 위 인용은 2026-09-13 조회 시점의 내용이다.
