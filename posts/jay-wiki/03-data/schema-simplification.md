---
title: "도메인별 PostgreSQL schema 분리를 걷어낸 이유"
slug: schema-simplification
tab: "데이터"
parentId: data
sortOrder: 7
kind: adr
tags: postgres,schema,database,simplicity
source: scripts/seed-portfolio-wiki.mjs
---
- 도메인별 PostgreSQL schema 분리를 검토하다가 왜 걷어냈나?
- 실제 권한 경계가 없는 곳에 schema만 나누는 것은 과설계라고 보고 전부 public에 뒀다.
- spring/src/main/resources/db/migration의 마이그레이션 전체가 public.tb_ 접두사 테이블임을 확인했다.

## 맥락 — schema를 나눠도 권한 경계는 생기지 않았다

초기 설계 단계에서 wiki, community, account처럼 도메인별로 PostgreSQL schema를 나누는 안을 검토했다.
도메인 경계가 눈에 보이게 나뉘어 있으면 코드를 읽을 때도 유리해 보였다.

하지만 이 프로젝트는 하나의 Spring 애플리케이션과 하나의 DB 계정이 모든 도메인 테이블에 접근한다.
schema를 나눈다고 해서 애플리케이션이 스스로 접근을 제한하지는 않는다.

## 후보와 기각 이유 — 시각적 경계에 비용을 치를 이유가 없었다

| 후보 | 얻는 것 | 기각 이유 |
|---|---|---|
| 도메인별 schema 분리 (wiki, community, account) | 코드 상 시각적 경계 | 권한 경계가 실제로 생기지 않는데 운영 마찰만 늘어난다 |
| public 단일 schema, tb_ 접두사 | 단순한 운영 모델 | 시각적 경계는 접두사로도 충분히 읽힌다 |

schema를 나누면 다음 복잡도가 그대로 늘어난다.

- Flyway schema 설정
- JPA default schema 문제
- 테스트 DB 초기화
- SQL 검색 경로
- IntelliJ/DataGrip 스키마 표시

권한 경계가 없는 상태에서 이 비용을 치를 이유가 없었다.

## 결정 — 전부 public에 두고 tb_ 접두사로 읽는다

도메인 테이블은 모두 public schema에 두고, 테이블명에 tb_ 접두사를 붙였다.

~~~text
public.tb_article
public.tb_revision
public.tb_tab
public.tb_post
public.tb_comment
public.tb_user
~~~

batch처럼 실행 주체와 권한 경계가 실제로 생기는 영역만 별도 schema 후보로 남겨 뒀다.

## 결과와 되돌리는 법 — 권한 경계가 생기는 영역만 분리한다

지금 마이그레이션 전체(spring/src/main/resources/db/migration)가 이 결정 그대로 public schema에
tb_ 접두사 테이블만 쓴다. 별도 schema로 되돌린 적은 없다.

되돌리는 기준은 하나다. 실제로 다른 DB role이나 실행 주체가 생겨 접근을 제한해야 하는 시점이 오면,
그때 그 영역만 schema를 분리한다. 프로젝트 전체를 다시 도메인별로 나누지는 않는다 — 처음 걷어낸
이유가 "권한 경계 없는 구조는 비용만 크다"였고, 그 판단은 지금도 유효하다.

## 남은 한계 — 여러 팀이 쓰는 규모에서는 다시 봐야 한다

작은 프로젝트 하나를 기준으로 내린 결정이다. 여러 팀이 같은 DB를 나눠 쓰거나 DB 계정 자체를
도메인별로 분리해야 하는 규모가 되면 그때 이 판단을 다시 검토한다.
