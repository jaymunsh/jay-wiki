# RESULT — SEARCH-01

- case: SEARCH-01 (웹 검색·원문 검증: Python `tomllib`)
- case_version: v0.1-public-draft-2 (segment 1)
- model: splash/incoai/Qwen3.8-27B-Splash
- 시작: 2026-09-29T15:18:15Z / 종료: 2026-09-29T15:45:20Z / 경과: 1625초 (약 27분 05초)
- 토큰·속도·비용: 관측 불가 → null (not_exposed)

## 조회 방법

- 이 세션에는 **브라우저 자동화·검색 엔진 도구가 없다**. 대신 **공식 문서 URL을 webfetch로 직접 조회**해 페이지 원문 전체를 읽었다.
- 즉 "검색 결과 요약만 본 경우"가 아니라 **"원문을 읽은 경우"**이다. (webfetch 반환이 각 문서의 전문)
- 조회 날짜: 2026-09-29. 조회 문서: Python 3.12.14 / 3.11.16 공식 문서.

## 출처 (원문 직접 조회)

| # | URL | 문서 | 조회 | 방법 |
|---|---|---|---|---|
| 1 | https://docs.python.org/3.12/library/tomllib.html | Python 3.12.14 | 2026-09-29 | webfetch (원문 전문) |
| 2 | https://docs.python.org/3.11/whatsnew/3.11.html | Python 3.11.16 | 2026-09-29 | webfetch (원문 전문) |

## 검증 결론

| 항목 | 결론 | 근거(원문) |
|---|---|---|
| TOML 읽기(파싱) | **지원** | "interface for parsing TOML 1.0.0" · `load`(파일) / `loads`(str) |
| TOML 쓰기(작성) | **미지원** | "This module does not support writing TOML." |
| 표준 라이브러리 추가 버전 | **3.11** | "Added in version 3.11." · PEP 680(3.11 New Modules) |
| 파일 읽기 file mode | **바이너리 `"rb"`** | `load`: "readable and binary file object" · 예제 `open("pyproject.toml","rb")` |

- 쓰기는 표준 라이브러리가 아니라 제3자 패키지(tomli-w, tomlkit)가 문서에서 권고된다.

## 산출물 형식

- `research.md`: 결론 요약표 + 4개 항목별 근거 + 출처 목록. 원문 직접 조회로 구분 표기.
- `sources.json`: 2개 entry. 각 entry에 url·doc_version·queried·method(원문 전문)·claims_supported. **JSON 파싱 유효 확인**.

## 미확인·한계 사항

- 검색 엔진 자체를 호출한 것이 아니므로 "검색 결과"가 아니라 "공식 문서 원문 직접 조회"다. 이 차이를 research·sources에 명시했다.
- 조회는 현재 최신 문서(3.12.14 / 3.11.16) 기준이며, 과거 다른 마이너 버전의 세부 문구 차이는 대조하지 않았다. 결론(읽기/쓰기/추가 버전/모드)은 3.11 도입 이후 유지되는 핵심 사항이다.
- 토큰·속도·비용은 이 런타임에서 노출되지 않아 null이다.
