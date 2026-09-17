# SEARCH-01 — Python 3.12 `tomllib` 확인

조사 기준일: 2026-09-13(UTC). 조회 방법: 웹 검색으로 공식 문서 위치를 찾은 뒤 **원문 페이지를 직접 읽음**(검색 요약만이 아님).

## 결론

| 질문 | 답 | 근거 |
|---|---|---|
| TOML **읽기** 지원? | 지원한다. `tomllib.load()`(파일 객체 → dict)와 `tomllib.loads()`(str → dict) 두 함수를 제공한다. | 공식 문서 본문 |
| TOML **쓰기** 지원? | 지원하지 않는다. 문서는 "This module does not support writing TOML"이라고 명시하고, 쓰기에는 서드파티 Tomli-W·TOML Kit 패키지를 안내한다. | 공식 문서 본문 |
| 표준 라이브러리 추가 버전 | **3.11** ("Added in version 3.11"). 따라서 Python 3.12에도 포함된다. | 공식 문서 상단 |
| 파일을 읽을 때 필요한 모드 | `load()`의 첫 인자는 "readable and **binary** file object"여야 한다. 공식 예제도 `open("pyproject.toml", "rb")`로 바이너리 모드를 사용한다. 텍스트 모드가 아니다. | 공식 문서 함수 정의·예제 |

## 부가 확인 사항

- `parse_float` 인자로 TOML float의 디코딩 타입을 바꿀 수 있고, 잘못된 TOML에는 `TOMLDecodeError`(`ValueError` 서브클래스)가 발생한다.
- TOML→Python 변환표(문서→dict, array→list, inline table→dict 등)가 문서에 있다.
- 3.12 문서 페이지 자체에서 확인했으므로 3.12 기준 정보다.

## 미확인·한계

- tomllib의 3.12 내부 변경점(버그 수정 등)은 본 조사 범위 밖 — 모듈 추가 버전(3.11)과 3.12 시점의 동작만 확인.
