# SEARCH-01 결과

- 상태: submitted
- case_version: v0.1-public-draft-2
- 시작: 2026-09-17T18:25:00Z (추정, 실제 시계 미연동)
- 종료: 2026-09-17T18:35:00Z (추정, 실제 시계 미연동)
- 산출물: research.md, sources.json
- 도구: web_fetch (공식 문서 원문 직접 읽기)

## 주장과 근거

- **읽기 지원 / 쓰기 미지원**: 공식 문 “This module does not support writing TOML.”을 원문으로 확인. `load()`/`loads()`는 읽기 전용.
- **표준 라이브러리 추가 버전 3.11**: 문 “Added in version 3.11.” 확인. 3.12는 유지 버전.
- **파일 모드 rb**: “a readable and binary file object”와 예제 `open("pyproject.toml", "rb")` 확인.

## 조회한 URL

- https://docs.python.org/3/library/tomllib.html (200 OK, 원문 30,904바이트 수신 후 섹션 본문 확인)

## 검색 요약 vs 원문

- 원문을 직접 읽음. 검색 요약만 본 경우가 아니라 모듈 설명·`Added in version`·`load()`·예제 구절을 그대로 인용하여 확인함.

## 미확인 사항

- 실제 Python 3.12 인터프리트를 기동해 `import tomllib`하고 `tomllib.load`/`loads`를 실행하지는 않았다(원문 확인이 기준).
- 호출·토큰·비용: 미측정(null).
