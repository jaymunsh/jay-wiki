# SEARCH-01 실행 기록

## 상태

- 상태: `submitted` (산출물 제출 완료, 채점은 미채점)
- 웹 검색·원문 조회: **수행함**. 플랫폼의 웹 검색·페이지 조회 도구를 실제로 사용했다. 기억으로 답한 결과를 검색 성공으로 보고하지 않는다.
- 시계 시작(UTC): `2026-09-13T15:01:50Z` (epoch 1789311710)
- 시계 종료(UTC): `2026-09-13T15:03:07Z` (epoch 1789311787)
- 소요 시간: `76000 ms` (약 1분 16초, agent-observed wall clock)
- 한도: 8분. 한도 내 완료.

## 실제로 조회한 URL

| # | URL | 유형 | 읽은 수준 | 조회 시각 |
|---|---|---|---|---|
| 1 | https://docs.python.org/3.12/library/tomllib.html | 공식 문서 | 전문 | 위 구간 내 |
| 2 | https://docs.python.org/3/library/tomllib.html | 공식 문서(최신) | 전문 | 위 구간 내 |
| 3 | https://peps.python.org/pep-0680/ | 표준 제안 문서 | 전문 | 위 구간 내 |
| 4 | https://docs.python.org/3/whatsnew/3.11.html | 공식 릴리스 노트 | 해당 항목 | 위 구간 내 |

검색 질의 1회: `Python 3.12 tomllib read write TOML standard library binary mode`. 검색은 공식 문서 위치를 찾는 데만 썼고, 제3자 페이지 요약은 사실 근거로 인용하지 않았다.

요청 단위 타임스탬프는 플랫폼이 노출하지 않아 `null`로 두고, 조회 구간(15:01:50Z~15:02:45Z)만 관측값으로 기록했다.

## 조회 결과 요약

1. **읽기**: 지원한다. `tomllib`은 TOML 1.0.0 파싱 인터페이스를 제공한다.
2. **쓰기**: 지원하지 않는다. 공식 문서에 "This module does not support writing TOML."이라고 명시되어 있고, PEP 680은 `tomllib.dump`/`tomllib.dumps`를 제안하지 않는다고 밝힌다. 쓰기는 `tomli-w`나 `tomlkit` 같은 서드파티에 맡긴다.
3. **추가된 버전**: **Python 3.11**이다. 3.12 문서 페이지에도 "Added in version 3.11."로 표기되고 PEP 680의 `Python-Version`도 3.11이다. 따라서 "Python 3.12의 tomllib"은 3.12 환경에서 사용 가능하다는 뜻이며, 3.12에서 새로 추가된 모듈이 아니다.
4. **읽을 때 필요한 모드**: **바이너리**. `tomllib.load`의 첫 인자는 "a readable and binary file object"여야 하며 공식 예제는 `open("pyproject.toml", "rb")`를 쓴다. 문자열은 `tomllib.loads`로 처리한다.

## 검색 결과 요약만 본 경우 vs 원문을 읽은 경우

- 원문을 직접 읽은 근거만 결론에 사용했다(위 4개 URL).
- 검색 결과 목록에 나타난 제3자 페이지(realpython.com, bookstack.cn, blog.csdn.net)는 근거로 쓰지 않았고 `sources.json`에 `used_as_evidence: false`로 분리 기록했다.

## 미측정·미확인 항목

- 텍스트 모드로 연 파일 객체를 `tomllib.load`에 넘길 때의 구체적 예외 타입·메시지: 공식 문서에서 명시 문장을 확인하지 않았고 코드를 실행해 확인하지도 않았다. `null`.
- 이 응시 환경(Python 3.13.12)에서의 실제 실행 동작: 문서상 성질만 확인했고 실행 검증은 하지 않았다. 이 과제는 문서 확인 과제이며 실행은 요구되지 않았다.
- 토큰 수, 첫 토큰 응답 시간, 출력 속도, 비용: `null` (`not_exposed`).
- 호출·재시도 횟수: 웹 조회 4건 + 검색 1건을 관측했으나, 모델 API 호출 수는 노출되지 않아 `null`.

## 범위 준수

생성한 파일은 `outputs/SEARCH-01/` 안에만 있다. 프로젝트 원본·설정·다른 실행 결과는 수정하지 않았고, 전역 설치나 외부 배포도 하지 않았다.
