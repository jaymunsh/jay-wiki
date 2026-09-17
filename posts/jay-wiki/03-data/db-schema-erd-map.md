---
title: "전체 DB 스키마를 도메인별 ERD로 읽기"
slug: db-schema-erd-map
tab: "데이터"
parentId: data
sortOrder: 5
kind: wiki
tags: postgres,schema,erd,data-model
source: scripts/seed-portfolio-wiki.mjs
---
- 모놀리스 PostgreSQL 29개 테이블이 어떤 경계로 나뉘어 있고, FK를 건 10곳과 걸지 않은 곳이 왜 갈리나?
- 29개 테이블을 한 장의 ERD가 아니라 서로 독립된 8개 도메인으로 잘라 그리고, FK 10곳이 도메인마다 다른 이유로 걸린 실물 구조를 기준으로 설명하기로 판단했다.
- 마이그레이션 파일이 아니라 로컬 PostgreSQL 18.4의 pg_catalog를 2026-08-17에 직접 조회해 테이블 29개·컬럼 205개·FK 10개를 확인했고, ORDER_SAGA outbox 33건이 전부 NEW로 남아 발행되지 않는 것도 행을 세어 확인했다.

**이 글이 그리는 것은 모놀리스의 DB 하나다. 그리고 그것이 전부가 아니다.**
결제와 배송의 원본은 pg-services 인스턴스의 payment·shipping 데이터베이스로 나갔고,
여기 남은 것은 이벤트로 채우는 읽기 전용 사본 둘뿐이다. 그 경계를 왜 그었는지는
[결제·배송 데이터의 주인을 모놀리스에서 떼고 두 겹으로 강제했다](/wiki/msa-data-ownership-split)에 있다.

그 모놀리스 PostgreSQL에는 애플리케이션 테이블 29개가 있다.
[Markdown 파일에서 DB 위키로 전환한 이유](/wiki/postgres-db-wiki-revision)는 그중 위키 3개만 다룬다.
나머지 26개가 어떤 경계로 나뉘어 있는지를 한 곳에서 볼 수 있는 글이 없어서 이 글을 썼다.
본문의 테이블·컬럼·행 수는 전부 2026-08-17 로컬 DB 스냅샷 값이다. 로컬 행 수는 계속 변하므로,
숫자가 어긋나 보이면 틀린 것이 아니라 스냅샷이 낡은 것이다.

기준은 마이그레이션 파일이 아니라 **실물 스키마**다.
로컬 PostgreSQL 18.4 컨테이너의 pg_catalog를 직접 조회해 테이블·컬럼·제약·인덱스를 확인했고,
Spring 엔티티와 대조해 실제로 읽고 쓰는 테이블인지를 따로 표시했다.
마이그레이션은 "어떻게 여기까지 왔는가"를, 실물 스키마는 "지금 무엇이 있는가"를 답한다. 두 답은 같지 않을 수 있다.

## 한 장의 ERD는 분리를 연결처럼 보이게 한다

29개 테이블, 컬럼 205개를 하나의 ERD에 넣으면 1440px 데스크톱에서도 관계선을 따라갈 수 없다.
그리고 그렇게 그린 그림은 **모든 테이블이 서로 연결된 하나의 도메인처럼 보이게 만든다**. 사실은 그 반대다.

이 스키마의 특징은 연결이 아니라 **분리**다. 위키는 게시판을 모르고, Saga는 시나리오 원장을 모르고,
Kafka 시연은 Saga 주문을 참조하지 않고, 블로그는 위키 탭·계정 어느 쪽과도 FK로 이어지지 않는다.
한 데이터베이스에 있을 뿐 서로 독립된 8개의 섬이다.
그래서 도메인별로 잘라 그리는 편이 구조를 더 정확하게 전달한다.

## 경계 넷이 도메인 여덟을 가로지른다

### 1. 원본은 PostgreSQL 하나, OpenSearch는 언제든 다시 만드는 파생물

tb_article과 tb_post의 본문은 PostgreSQL에만 있다. OpenSearch에도 같은 본문이 들어가지만 그것은 색인이지 원본이 아니다.

| 구분 | PostgreSQL | OpenSearch |
|---|---|---|
| 위키 | tb_article 전체 행 | 문서 저장 시 slug 단위 PUT, 색인 필드는 slug/parentId/title/summary/body/kind/status/tags/updatedAt |
| 게시판 | tb_post 전체 행 | reindex 시 bulk 색인, 필드는 id/title/content/authorType/authorName/views/commentCount/createdAt |
| 사라지면 | 콘텐츠가 사라진다 | reindex 한 번으로 복구된다 |

이 경계는 코드에도 남아 있다. 위키 색인은 저장 이벤트를 받아 갱신하는데,
색인이 실패해도 예외를 삼키고 경고 로그만 남긴다. 검색이 잠깐 낡는 것보다 저장이 실패하는 쪽이 나쁘기 때문이다.
그래서 **OpenSearch 장애는 데이터 손실이 아니라 검색 품질 저하로 격리된다.**

Redis도 같은 방향의 파생이다. 다만 여기에는 아직 닫히지 않은 구멍이 하나 있다(아래 미완 항목 참고).

### 2. 실행 원장과 도메인 데이터를 같은 테이블에 섞지 않았다

[시나리오 허브](/scenarios)의 도메인 리허설은 상품권, 쿠폰, 정산, Connection Pool처럼 서로 다른 소재를 다룬다.
그런데 저장 테이블은 tb_domain_scenario_run과 tb_domain_scenario_step 두 개뿐이다.
상품권 잔액 테이블도, 쿠폰 재고 테이블도 없다.

의도한 결정이다. 이 시나리오들이 남기는 것은 **"어떤 정책으로 실행했더니 어떤 결과가 나왔다"는 실행 기록**이지
운영 중인 도메인 데이터가 아니다. 상품권 잔액을 진짜 테이블로 만들면 그 순간부터 정합성, 마이그레이션,
동시성 제어를 책임져야 하는데 그것은 이 리허설의 목적이 아니다.

그래서 run 한 행이 실행 하나를 통째로 담는다. 로컬에는 15종 117건이 쌓여 있다(2026-08-10 기준).

### 3. 본문 문자열이 이미지 자산을 붙잡는다

tb_article_asset과 tb_article 사이에는 FK도 조인 테이블도 없다. 연결은 본문 안의 문자열이다.

~~~text
본문:  ![구성도](/api/wiki-assets/6f1c...-...-...)
       └─ 정규식 /api/wiki-assets/([0-9a-f-]{36}) 로 assetId 추출
~~~

자산을 지우려 할 때 서비스는 tb_article.body와 **tb_revision.body를 모두 검사**하고,
어느 하나라도 그 경로 문자열을 포함하면 삭제를 거부한다.
revision까지 검사하는 이유는 과거 버전으로 되돌렸을 때 깨진 이미지가 나오지 않게 하기 위해서다.

부작용도 명확하다. 이미지를 본문에서 뺀 뒤에도 그 이미지가 들어 있던 revision이 남아 있는 한 자산은 지워지지 않는다.
자산의 수명은 현재 본문이 아니라 **이력 전체**가 결정한다.

### 4. 29개 테이블에서 FK는 10곳이다 — 건 이유가 세 갈래다

블로그(V13)가 들어오기 전까지 실물 스키마의 외래키는 딱 네 개였고, 넷 다 ON DELETE CASCADE다.

| 자식 | 부모 | 왜 걸었나 |
|---|---|---|
| tb_comment | tb_post | 글이 사라지면 댓글은 존재 이유가 없다 |
| tb_domain_scenario_step | tb_domain_scenario_run | 실행 기록 없는 단계는 읽을 수 없다 |
| tb_kafka_demo_event_log | tb_kafka_demo_order | 주문 없는 이벤트 로그는 의미가 없다 |
| tb_kafka_demo_consumer_result | tb_kafka_demo_order | 위와 같다 |

공통점은 **부모와 수명이 완전히 같은 자식**이라는 점이다.

블로그 도메인이 다섯 개를 더했다. 셋은 같은 이유의 CASCADE지만,
둘은 방향이 반대인 **ON DELETE RESTRICT**다.

| 자식 | 부모 | 삭제 규칙 |
|---|---|---|
| tb_blog_post_tag | tb_blog_post | CASCADE — 글이 지워지면 태그 연결도 지운다 |
| tb_blog_post_tag | tb_blog_tag | CASCADE — 태그가 지워지면 연결도 지운다 |
| tb_blog_comment | tb_blog_post | CASCADE — 글 없는 댓글은 의미가 없다 |
| tb_blog_post | tb_blog_category | RESTRICT — **글이 남아 있는 카테고리는 지울 수 없다** |
| tb_blog_category | tb_blog_category (자기참조) | RESTRICT — 하위 카테고리가 있으면 지울 수 없다 |

CASCADE가 "부모가 죽으면 자식도 죽는다"라면 RESTRICT는 "자식이 있으면 부모를 못 죽인다"다.
카테고리를 지우다가 글이 조용히 사라지는 사고를 DB가 막게 한 선택이다.

열 번째는 세 번째 갈래다. tb_wiki_featured(V22)가 tb_article.slug를 참조하는데,
**이 스키마에서 PK가 아닌 자연키를 참조하는 유일한 FK이고 ON UPDATE CASCADE가 붙어 있다.**
대표 문서 목록은 사람이 화면에서 고르는 값이라 시드가 안 채운다. 그래서 글을 지우면 목록에서도
빠져야 하고(ON DELETE CASCADE), slug를 바꾸면 목록이 따라와야 한다(ON UPDATE CASCADE).
slug를 참조하는 다른 관계들(tb_revision 등)이 FK를 안 건 것과 정반대의 판단인데,
이력은 문서가 사라져도 남아야 하고 전시 목록은 사라져야 하기 때문이다.

나머지는 일부러 걸지 않았고, 이유가 각각 다르다.

- tb_article.parent_id → tb_tab: 시드가 탭을 먼저 넣고 문서를 넣는다. 실제로 로컬에서 고아 문서는 0건이다.
  DB 제약 대신 시드 순서로 보장하는 쪽을 택했다.
- tb_revision.slug → tb_article: **문서를 지워도 이력은 남겨야 하므로 FK를 걸 수 없다.**
  로컬 DB에는 이미 삭제된 문서 12개의 revision 27행이 남아 있다(2026-08-10 기준, project-overview 3행 등).
  코드에도 "revision 은 이력 보존을 위해 남겨둠"이라는 주석이 그대로 있다.
- tb_saga_* 전체: 아래 Saga 절에서 따로 설명한다.

두 번째 항목은 3번 경계와 맞물린다. 삭제된 문서의 revision이 남아 있으면, 그 revision이 참조하던 이미지 자산도 계속 삭제되지 않는다.

## 전체 지도 — 29개 테이블이 8개 도메인으로 갈린다

| 도메인 | 테이블 | 도입 | 로컬 행 수 (2026-08-17) | 엔티티 |
|---|---|---|---:|---|
| 위키 콘텐츠 | tb_tab, tb_article, tb_revision, tb_wiki_featured | V1, V2, V12, V22 | 11 / 80 / 603 / 5 | 있음 |
| 위키 이미지 자산 | tb_article_asset | V8 | 9 | 있음 |
| 계정 | tb_user | V3 | 3 | 있음 |
| 게시판 | tb_post, tb_comment | V4, V5 | 100,007 / 1 | 있음 |
| Saga | tb_saga_customer, order, inventory, instance, step + 사본 둘(payment·shipping projection) | V6, V25, V26, V28 | 5 / 40 / 1 / 40 / 229 + 14 / 6 | 있음 |
| Outbox·Kafka 시연 | tb_outbox_event, tb_kafka_demo_order, event_log, consumer_result | V6, V7 | 42 / 9 / 62 / 27 | outbox만 없음 |
| 도메인 시나리오 | tb_domain_scenario_run, tb_domain_scenario_step | V9, V10, V11 | 128 / 494 | 있음 |
| 블로그 | tb_blog_category, post, tag, post_tag, comment | V13, V18, V20, V31 | 7 / 20 / 113 / 146 / 2 | 다섯 다 엔티티가 있다 |
| 사이트 집계 | tb_site_daily_stat, tb_site_referrer_daily, tb_site_device_daily | V14, V15, V32 | 16 / 33 / 22 | 셋 다 엔티티가 없다 |

Saga 칸에서 payment와 shipping이 사본으로 바뀐 것이 이 표에서 가장 크게 달라진 자리다.
V27과 V29가 tb_saga_payment와 tb_saga_shipping을 드롭했고, 그 자리를 V26·V28의 projection 둘이 대신한다.
원본은 이 DB에 없다.

엔티티가 있다는 것은 spring 안에 JPA @Entity 매핑이 있다는 뜻이다.
엔티티가 없는 테이블은 tb_outbox_event와 사이트 집계 셋(tb_site_daily_stat,
tb_site_referrer_daily, tb_site_device_daily)이다. 넷 다 JdbcTemplate으로 직접 SQL을 쓴다.
outbox의 이유는 Outbox 절에서, 집계 셋은 블로그 절에서 다룬다.

주의할 점이 하나 더 있다. **이 스키마에는 JPA 연관 관계 매핑이 하나도 없다.**
@ManyToOne, @OneToMany, @JoinColumn이 전체 코드에 0건이다. FK 컬럼은 전부 평범한 String 필드로 두고
필요할 때 repository로 다시 조회한다. 지연 로딩과 N+1을 프레임워크가 아니라 호출부에서 통제하겠다는 선택이며,
[JPA N+1 시나리오](/scenarios)가 정책 비교를 할 수 있는 것도 이 구조 덕분이다.

아래 ERD에서 실선은 실제 FK, **점선은 FK 없이 애플리케이션 코드로만 유지되는 논리 관계**다.

## 도메인 1. 위키 콘텐츠 — 이력은 tb_revision으로 뺐다

~~~mermaid
erDiagram
    tb_tab ||..o{ tb_article : "parent_id, FK 없음"
    tb_article ||..o{ tb_revision : "slug, FK 없음, 문서 삭제 후에도 남음"
    tb_article ||--o| tb_wiki_featured : "article_slug, 실제 FK, 삭제·slug 변경 모두 CASCADE"
    tb_tab {
        text tab_id PK
        text title
        int sort_order "탭 정렬"
        timestamptz created_at
    }
    tb_article {
        text slug PK "문서 식별자"
        text parent_id "탭"
        text title
        text summary
        text body "본문 SoT"
        text kind "wiki adr postmortem note"
        text status "published draft"
        text tags "콤마 문자열"
        date last_review
        timestamptz synced_at "V1 잔재, 읽는 코드 없음"
        int version "콘텐츠 버전, JPA Version 아님"
        int sort_order "start 탭만 1차 정렬, 그 밖은 tiebreak"
        bool toc_enabled "V19, 목차 노출"
        int view_count "V21, 시드가 안 덮는다"
        timestamptz updated_at
        timestamptz created_at "V12, 근거 없으면 null"
    }
    tb_wiki_featured {
        smallint position PK "1부터, 같은 자리에 둘 불가"
        text article_slug UK "한 글이 두 번 못 들어간다"
    }
    tb_revision {
        bigserial id PK
        text slug UK "slug+version 유일"
        int version UK
        text title
        text body "그 시점 스냅샷"
        text editor
        timestamptz created_at
    }
~~~

읽을 때 헷갈리기 쉬운 컬럼이 넷 있다.

| 컬럼 | 흔한 오해 | 실제 |
|---|---|---|
| version | JPA 낙관적 잠금 | 직접 관리하는 콘텐츠 버전. 저장할 때마다 +1 |
| sort_order | 탭 목록의 1차 정렬 기준 | 1차인 탭은 **start 하나뿐**(WikiArticleRepository.READING_ORDER_TABS). 나머지 탭은 최근 수정 순이 1차이고 sort_order는 동률 tiebreak다 |
| created_at | 정렬용 | 표시용. 근거 없는 문서는 null로 남긴다 |
| synced_at | 마지막 동기화 시각 | Markdown 파일 동기화 시절의 잔재. 엔티티에 필드가 있고 ArticleService가 저장할 때 null이면 채우지만, 이후 읽는 코드는 없다 |

version과 sort_order를 tb_article 안에 둔 이유는 두 값이 문서의 현재 상태이지 이력이 아니기 때문이다.
반대로 본문 스냅샷은 tb_article에 누적하지 않고 tb_revision으로 뺐다. 그래야 목록 조회가 본문 이력의 크기에 영향받지 않는다.

## 도메인 2. 위키 이미지 자산 — 관계선이 하나도 없다

~~~mermaid
erDiagram
    tb_article_asset {
        text id PK "본문에 쓰는 assetId"
        text object_key UK "MinIO 객체 키"
        text original_name
        text content_type
        bigint size_bytes "0보다 커야 함"
        varchar_64 checksum_sha256
        text status "TEMP ATTACHED UNUSED"
        text uploaded_by
        timestamptz created_at
        timestamptz attached_at
        timestamptz deleted_at
    }
~~~

관계선이 하나도 없는 것이 이 다이어그램의 요점이다. 본문과의 연결은 3번 경계에서 설명한 문자열 참조뿐이다.

status는 세 값만 허용하는 CHECK 제약이 붙어 있다. 업로드 직후 TEMP, 본문에 참조되면 ATTACHED,
참조가 사라지면 UNUSED가 된다. 실제 바이트는 MinIO에 있고 이 테이블은 metadata와 상태만 갖는다.
크기와 checksum을 여기에 둔 이유는 같은 파일을 다시 올렸는지, 저장된 객체가 온전한지를
MinIO에 묻지 않고 DB에서 먼저 판단하기 위해서다.

로컬 9건은 ATTACHED 1건, UNUSED 8건이다(2026-08-10 기준). 이미지 자산은 환경마다 assetId가 새로 발급되므로 로컬과 운영이 같은 값을 갖지 않는다.
그래서 저장소에 함께 두고 검토·배포하는 고정 이미지는 이 테이블이 아니라 web public에 둔다.

## 도메인 3. 계정 — 어떤 도메인과도 FK로 잇지 않았다

~~~mermaid
erDiagram
    tb_user {
        bigserial id PK
        text username UK
        text password "BCrypt 해시"
        text nickname
        text role "ADMIN USER"
        text provider "local"
        text source "V33. 가입한 사람의 유입 경로"
        timestamptz created_at
    }
~~~

테이블 하나뿐이고 다른 도메인과 FK로 연결되지 않는다. 게시글의 작성자도 user_id가 아니라
author_type과 author_name 문자열로 들어간다. 익명 글이 1급 시민이기 때문이다.

이 구조가 나중에 값을 했다. 구글 로그인을 빼면서 계정 행을 지웠는데 기존 글이 하나도 깨지지 않았다.
작성 시점의 이름이 글에 복사돼 있어 계정과 글의 수명이 따로 놀기 때문이다. FK로 묶었다면 계정 삭제가
곧 글 삭제이거나 제약 위반이었다.

V33이 더한 source는 tb_blog_comment.source와 같은 값이고 같은 쿠키에서 온다.
담기는 것은 분류된 소스 이름 하나뿐이며 원본 Referer URL도 새 식별자도 만들지 않는다.
**다만 댓글의 것과 성격이 다르다.** 댓글은 익명 한 건에 붙는 값이라 사람과 이어지지 않지만,
계정의 source는 지속되는 신원에 붙어 아이디·별명과 함께 한 사람을 가리킨다.
그래서 가입 화면에 그 사실을 적어 두었다 — 알리지 않고 쌓지 않는다.

### 사라진 부분 유니크 인덱스

원래 이 테이블에는 컬럼이 둘 더 있었다. OAuth subject와 email이다. 그리고 이런 인덱스가 걸려 있었다.

~~~sql
create unique index idx_user_provider_subject
    on public.tb_user (provider, subject) where subject is not null;
~~~

local 계정은 subject가 null이라 이 인덱스에 들어가지 않았다. 조건 없이 유니크를 걸었어도 null이 여러
개인 것은 허용되므로 동작은 했겠지만, OAuth 계정만 provider와 subject로 유일하다는 의도가 스키마에
드러나지 않는다. 부분 인덱스는 그 의도를 적는 자리였다.

2026년 8월 6일에 구글 로그인을 제거하면서 두 컬럼과 이 인덱스를 함께 드롭했다. PostgreSQL은 컬럼을
드롭하면 그 컬럼을 쓰는 인덱스도 같이 지우지만, 마이그레이션에는 인덱스 제거를 따로 적었다. 파일만
읽어도 무엇이 사라지는지 보이게 하려는 것이다. 지금 이 테이블에 구글 계정은 없다.

## 도메인 4. 게시판 — 검색 비교를 위해 인덱스가 비대칭이다

~~~mermaid
erDiagram
    tb_post ||--o{ tb_comment : "post_id, FK, ON DELETE CASCADE"
    tb_post {
        bigserial id PK
        text title
        text content
        text author_type "anonymous user"
        text author_name
        text password_hash "익명 글 본인 삭제용"
        int views "누적 기저값"
        int comment_count "비정규화"
        timestamptz created_at
        tsvector tsv "생성 컬럼, GIN 색인"
    }
    tb_comment {
        bigserial id PK
        bigint post_id FK
        text content
        text author_type
        text author_name
        timestamptz created_at
    }
~~~

이 도메인은 검색 비교 실험의 대비군이라서 인덱스 구성 자체가 의도적으로 비대칭이다.

| 접근 경로 | 인덱스 | 이유 |
|---|---|---|
| 목록 페이징 | idx_post_id_desc | 최신순 조회 가속 |
| 전문 검색 | idx_post_tsv (GIN) | tsvector 생성 컬럼 위의 색인 |
| LIKE 검색 | **없음** | 순차 스캔이 나오도록 일부러 비워 둔 대비군 |
| 댓글 조회 | idx_comment_post | post_id+id |

tsv는 생성 컬럼(generated always as ... stored)이다. 애플리케이션이 갱신하지 않고 PostgreSQL이 유지한다.
config가 simple인 것은 공백 토큰화라는 뜻이고, 한국어 형태소 분석은 이 컬럼이 아니라
[OpenSearch nori](/wiki/opensearch-nori-image)가 맡는다. 이 차이가 검색 비교의 핵심 변수다.

comment_count는 비정규화 컬럼이다. 목록 100건을 그릴 때 댓글 수를 집계하지 않기 위해 정확성 대신 조회 비용을 택했다.

## 도메인 5. Saga — FK 없이 문자열 id로만 잇는다

~~~mermaid
erDiagram
    tb_saga_order ||..|| tb_saga_instance : "order_id, FK 없음"
    tb_saga_instance ||..o{ tb_saga_step : "saga_id, FK 없음"
    tb_saga_order ||..o| tb_payment_projection : "order_id, FK 없음"
    tb_saga_order ||..o| tb_shipping_projection : "order_id, FK 없음"
    tb_saga_order }o..|| tb_saga_inventory : "product_code, FK 없음"
    tb_saga_customer ||..o{ tb_saga_order : "customer_id, FK 없음"
    tb_saga_order {
        text id PK
        text customer_id "null 가능 - 구매자 없는 이전 데모"
        text product_code
        int quantity
        text status "CREATED CONFIRMED FAILED"
        text idempotency_key UK "재요청 차단"
        timestamptz created_at
        timestamptz updated_at
    }
    tb_saga_customer {
        text id PK
        text name
        text email
        text grade "GOLD SILVER BASIC"
        timestamptz created_at
    }
    tb_saga_instance {
        text id PK
        text order_id
        text status "STARTED COMPLETED FAILED"
        text current_step
        text fail_at "주입할 실패 지점"
        timestamptz created_at
        timestamptz completed_at
    }
    tb_saga_step {
        bigserial id PK
        text saga_id
        text step_name
        text status "SUCCESS FAILED COMPENSATED"
        bool compensating "보상 단계인가"
        text message
        timestamptz created_at
    }
    tb_saga_inventory {
        text product_code PK
        int available
        int reserved
        timestamptz updated_at
    }
    tb_payment_projection {
        text order_id PK "화면 조회가 주문 기준"
        text payment_id "payment-api가 발급"
        text status
        timestamptz occurred_at "원본에서 일어난 시각"
        timestamptz observed_at "우리가 들은 시각"
    }
    tb_shipping_projection {
        text order_id PK "화면 조회가 주문 기준"
        text shipment_id "shipping-api가 발급"
        text status
        timestamptz occurred_at "원본에서 일어난 시각"
        timestamptz observed_at "우리가 들은 시각"
    }
~~~

Saga 도메인에는 FK가 하나도 없다. 일곱 테이블이 문자열 id로만 이어져 있다.
이것이 Saga를 표현하는 방식 그 자체다. 분산 트랜잭션에서 각 참여자는 자기 상태만 소유하고,
실패는 롤백이 아니라 **보상 단계를 추가로 기록해서** 처리한다.

여기에 결제도 배송도 없다는 것이 이 도메인에서 가장 중요한 사실이다.
원본은 각각 payment-api와 shipping-api가 자기 DB(pg-services의 payment, shipping)에 들고,
이쪽에 있는 두 projection 테이블은 그 프로세스들이 낸 이벤트로 채우는 **읽기 전용 사본**이다.
이름이 설계의 일부다 — "결제의 상태"가 아니라 "우리가 마지막으로 들은 결제의 상태"다.
그래서 시각을 둘 든다. occurred_at은 원본에서 그 일이 일어난 때고, observed_at은 우리가 들은 때다.
화면은 이 차이를 감추지 않고 「AUTHORIZED (2초 전 기준)」처럼 그대로 적는다.

모놀리스가 이 도메인에서 실제로 소유하는 것은 주문·재고·사가 기록 셋뿐이다.
나머지 둘은 소유가 아니라 구독이다.

tb_saga_step의 compensating 컬럼이 이 설계의 요약이다. 실패해도 이전 단계 행을 지우지 않고
compensating=true인 행을 덧붙인다. 그래서 168개 step 행이 24번 실행의 성공·실패·보상 이력을 순서대로 보존한다.

두 컬럼이 재현성을 만든다.

- idempotency_key: 같은 키로 다시 요청하면 새 Saga를 만들지 않고 기존 결과를 돌려준다. 유니크 제약이 이를 강제한다.
- fail_at: 어느 단계에서 실패를 주입할지를 요청이 지정하고, 그 값을 instance에 저장한다.
  실패가 우연이 아니라 **입력값**이므로 같은 시나리오를 몇 번이든 똑같이 재현할 수 있다.

배송 실패를 주입한 실행에서 tb_shipping_projection에 아무 행도 안 남는 것은 이 구조의 결과다.
shipping-api가 409를 내면 접수 행 자체를 만들지 않으므로 낼 이벤트도 없고, 화면은 배송을 NONE으로 그린다.
빈 사본은 고장이 아니라 **아직 아무 사실도 못 들었다**는 뜻이다.

## 도메인 6. Outbox와 Kafka 시연 — outbox를 두 발행자가 나눠 쓴다

~~~mermaid
erDiagram
    tb_kafka_demo_order ||--o{ tb_kafka_demo_event_log : "order_id, FK, CASCADE"
    tb_kafka_demo_order ||--o{ tb_kafka_demo_consumer_result : "order_id, FK, CASCADE"
    tb_kafka_demo_order ||..o{ tb_outbox_event : "aggregate_id, FK 없음"
    tb_outbox_event {
        bigserial id PK
        text aggregate_type "ORDER_SAGA KAFKA_DEMO_ORDER"
        text aggregate_id
        text event_type
        jsonb payload
        text status "NEW CLAIMED PUBLISHED"
        timestamptz created_at
        timestamptz processed_at
        timestamptz published_at "V7"
        int attempt_count "V7"
        text last_error "V7"
        timestamptz claimed_at "V16"
    }
    tb_kafka_demo_order {
        text id PK
        text product_code
        int quantity
        text fail_mode "실패 주입 모드"
        text status
        timestamptz created_at
        timestamptz updated_at
    }
    tb_kafka_demo_event_log {
        bigserial id PK
        text order_id FK
        text stage
        text status
        text message
        timestamptz created_at
    }
    tb_kafka_demo_consumer_result {
        bigserial id PK
        text order_id FK
        text consumer_name UK "order_id+consumer_name 유일"
        text status
        int attempt_count
        text last_error
        timestamptz updated_at
    }
~~~

tb_outbox_event는 **JPA 엔티티가 없는 세 테이블 중 하나**다(나머지 둘은 블로그 절).
Outbox relay는 JdbcTemplate으로 직접 SQL을 쓴다. 배치 폴링과 조건부 UPDATE가 필요한 곳에서
엔티티 관리와 영속성 컨텍스트는 도움이 되지 않는다고 판단한 결과다. 그리고 payload가 jsonb인데,
스키마가 없는 이벤트 본문을 컬럼으로 펼치지 않고 그대로 보관하기 위한 선택이다.

aggregate_type이 있는 이유는 하나의 outbox 테이블을 두 발행자가 나눠 쓰기 때문이다.
Saga는 ORDER_SAGA로, Kafka 시연은 KAFKA_DEMO_ORDER로 쓴다. 인덱스도 그 순서를 그대로 따른다.

~~~sql
create index idx_outbox_event_status_created
    on public.tb_outbox_event (aggregate_type, status, created_at);
~~~

relay의 폴링 쿼리가 aggregate_type과 status로 걸러 created_at 순으로 읽으므로 인덱스 컬럼 순서가 그 접근 경로와 정확히 맞는다.

V16이 여기에 선점(claim) 단계를 더했다. relay가 여러 개 돌 때 같은 행을 중복 발행하지 않도록
행을 먼저 CLAIMED로 바꾸고, 발행에 성공하면 PUBLISHED, 실패하면 NEW로 되돌린다.
선점 후 죽은 프로세스의 행을 회수하려고 claimed_at 컬럼이 생겼고,
NEW·CLAIMED만 대상으로 하는 부분 인덱스 idx_outbox_event_claimable이 함께 추가됐다.

tb_kafka_demo_consumer_result의 (order_id, consumer_name) 유니크가 재시도 시연의 핵심이다.
같은 consumer가 같은 주문을 여러 번 처리해도 행이 늘지 않고 attempt_count와 last_error만 갱신된다.
그래서 "몇 번 만에 성공했는가"와 "무엇 때문에 실패했는가"가 한 행에 남는다.

## 도메인 7. 시나리오 원장 — 15종이 테이블 둘을 공유한다

~~~mermaid
erDiagram
    tb_domain_scenario_run ||--o{ tb_domain_scenario_step : "run_id, FK, CASCADE"
    tb_domain_scenario_run {
        text run_id PK
        text scenario_type "15종"
        text mode "비교할 정책"
        text status
        text headline
        int before_amount
        int after_amount
        text idempotency_key
        timestamptz created_at
        int http_status "V10, 제휴 API 전용"
        int attempt_count "V10"
        bigint elapsed_ms "V10"
        int p95_ms "V11, 부하형 전용"
        int rejected_count "V11"
        int queue_lag "V11"
        int replicas "V11"
        int recovery_seconds "V11"
    }
    tb_domain_scenario_step {
        bigserial id PK
        text run_id FK
        int sequence_no UK "run_id+sequence_no 유일"
        text action
        text actor
        text status
        text detail
    }
~~~

15종의 시나리오가 테이블 두 개를 공유한다. 시나리오마다 테이블을 만들지 않은 대신
필요한 증거 컬럼을 원장 테이블에 붙여 왔고, 그 결과 컬럼이 시나리오별로 **희소하다**.

| 컬럼 묶음 | 추가 시점 | 실제로 채우는 시나리오 | 나머지 시나리오 |
|---|---|---|---|
| before_amount, after_amount | V9 | 15종 대부분 | 0 |
| http_status, attempt_count, elapsed_ms | V10 | partner-api | 0 |
| p95_ms, rejected_count, queue_lag, replicas, recovery_seconds | V11 | traffic-burst, connection-pool, coupon-race, settlement-batch, n-plus-one | 0 |

로컬 117건을 실제로 세어 보면 http_status가 0이 아닌 행은 partner-api 31건 중 16건뿐이고,
p95_ms를 쓰는 행은 부하형 5종에만 있다. 나머지는 NOT NULL DEFAULT 0으로 채워진 빈칸이다.

이 구조의 대가는 분명하다. **0이 "측정값 0"인지 "해당 없음"인지 스키마만으로는 구분되지 않는다.**
시나리오 수가 더 늘거나 지표가 더 세분화되면 시나리오별 증거 테이블이나 jsonb 컬럼으로 옮기는 편이 낫다.
지금은 15종·17컬럼 규모라서 조회가 단순한 쪽의 이득이 더 크다고 보고 유지하고 있다.

sequence_no의 유니크 제약은 순서를 DB가 보장하게 만든다. 단계는 created_at 없이 sequence_no로만 정렬하므로
같은 밀리초에 여러 단계가 생겨도 표시 순서가 흔들리지 않는다.

## 도메인 8. 블로그 — 위키와 정반대의 결정 위에 서 있다

2026년 8월에 위키 LAB 탭의 글을 옮기면서 생긴 두 번째 콘텐츠 저장소다(blog.leneu.cloud).
같은 DB 안에 있지만 위키와 정반대의 결정 두 개 위에 서 있다.

- **시드와 revision이 없다.** 원본이 이 테이블이고 안전망은 pg_dump 전체 백업이다.
  블로그 글은 리뷰 대상이 아니므로 Git에 원본을 둘 이유가 없다는 판단이다.
- **FK를 적극적으로 쓴다.** 경계 4에서 본 RESTRICT 두 곳이 여기다. 시드 순서로 정합성을 보장할
  장치가 없으므로 DB 제약이 그 역할을 맡는다.

~~~mermaid
erDiagram
    tb_blog_category ||--o{ tb_blog_post : "category_id, FK, RESTRICT"
    tb_blog_post ||--o{ tb_blog_post_tag : "post_id, FK, CASCADE"
    tb_blog_tag ||--o{ tb_blog_post_tag : "tag_id, FK, CASCADE"
    tb_blog_post ||--o{ tb_blog_comment : "post_id, FK, CASCADE"
    tb_blog_category {
        bigserial id PK
        text slug UK "URL에 그대로 쓴다"
        text name
        text description
        bigint parent_id FK "자기참조, RESTRICT, 최대 2단"
        int sort_order
        timestamptz created_at
    }
    tb_blog_post {
        bigserial id PK "URL의 숫자 id"
        text slug UK "V18에서 유니크"
        bigint category_id FK
        text title
        text summary
        text body
        text cover_asset_id "tb_article_asset을 문자열로만 참조"
        text status "draft published"
        timestamptz published_at "published면 NOT NULL, CHECK"
        bigint view_count "V14"
        timestamptz created_at
        timestamptz updated_at
    }
    tb_blog_tag {
        bigserial id PK
        text name UK
    }
    tb_blog_post_tag {
        bigint post_id PK "post_id+tag_id 복합 PK"
        bigint tag_id PK
    }
    tb_blog_comment {
        bigserial id PK
        bigint post_id FK
        text author_name
        text password_hash "BCrypt, 본인 삭제용"
        text body
        text ip_prefix "표시용 앞 2옥텟"
        text ip_hash "원본 IP는 저장하지 않음"
        timestamptz created_at
        timestamptz deleted_at
    }
~~~

cover_asset_id는 위키 이미지 자산 테이블을 3번 경계와 같은 방식, 즉 FK 없는 문자열로만 참조한다.
카테고리 깊이 제한(최대 2단)은 CHECK로 표현하기 어려워 애플리케이션이 강제한다.
slug 유니크는 처음에 없었다가 V18에서 걸었다. 화면은 /{id}/{slug}라 id로 찾으니 안 깨지지만,
초안 발행 스크립트가 slug로 기존 글을 찾으므로 같은 slug가 둘이면 어느 쪽을 덮을지가 목록 순서에 달렸기 때문이다.

통계 테이블 세 개는 성격이 다르다. 개별 방문자 식별자를 영구 저장하지 않고 날짜별 집계 숫자만 남긴다.
그리고 **블로그 전용이 아니다.** V32가 이름을 tb_site_*로 바꾸고 site 열을 기본키에 넣어,
위키(portfolio.leneu.cloud)도 같은 표에 쌓는다. 위키용 표를 따로 만들면 같은 모양의 표와
같은 질의가 두 벌이 되고, 두 벌은 반드시 갈라진다.

~~~mermaid
erDiagram
    tb_site_daily_stat {
        text site PK "site+stat_date 복합 PK. blog wiki"
        date stat_date PK
        bigint views
        bigint visitors
        bigint ref_search "세부는 세로 테이블이 대신함"
        bigint ref_sns
        bigint ref_internal "V32. 사이트 안에서의 이동"
        bigint ref_other
    }
    tb_site_referrer_daily {
        text site PK "site+stat_date+source 복합 PK"
        date stat_date PK
        text source PK "google naver sns:x internal direct ..."
        bigint count
    }
    tb_site_device_daily {
        text site PK "site+stat_date+device 복합 PK"
        date stat_date PK
        text device PK "pc mobile, CHECK"
        bigint count
    }
~~~

셋 다 엔티티가 없다. 쓰기가 전부 insert ... on conflict do update로 count를 올리는
upsert 한 문장이라(SiteStatsService), 행을 불러와 갱신하는 JPA 모델이 오히려 방해가 된다.
outbox와 같은 이유로 JdbcTemplate을 쓴다.
V15가 컬럼 대신 세로 테이블을 고른 것도 같은 방향이다 — 유입 소스가 늘 때마다 마이그레이션이 붙지 않는다.

**ref_internal이 V32에서 갈라져 나온 이유는 ref_other가 뜻을 잃었기 때문이다.** 목록에서 글로
넘어가도 Referer는 자기 호스트라 그때까지는 ref_other로 쌓였고, 사이트 안에서 도는 횟수가
밖에서 오는 횟수보다 훨씬 많으므로 그 숫자는 외부 유입을 뜻하지 못했다.
지난 값은 되살릴 수 없다 — 원본 Referer를 저장하지 않기 때문이다. 이 시점부터 갈린다.

## 마이그레이션 순서가 폐기된 판단의 자국을 남겼다

Flyway 마이그레이션 29개는 이 프로젝트의 기능이 붙은 순서 그 자체다.

| 버전 | 무엇을 추가했나 | 이 스키마에 남긴 흔적 |
|---|---|---|
| V1 | tb_article, pg_trgm, trigram GIN | 당시 SoT는 Markdown 파일이었고 이 테이블은 "파생 읽기모델"이었다 |
| V2 | tb_tab, tb_revision, version/sort_order | 본문 SoT를 PostgreSQL로 옮긴 전환점 |
| V3 | tb_user, 부분 유니크 인덱스 | 도메인 스키마를 나누지 않고 public에 통합하기로 결정 |
| V4 | tb_post, tb_comment, 10만 건 시드 | 유일한 대량 데이터 |
| V5 | tsv 생성 컬럼과 GIN | 검색 비교의 대비군 구성 |
| V6 | Saga 6종 + tb_outbox_event | FK 없는 참여자별 상태 소유 |
| V7 | outbox 재시도 컬럼, Kafka 시연 3종 | outbox를 Saga 전용에서 공용으로 확장 |
| V8 | tb_article_asset | 이미지 자산의 상태 기계 도입 |
| V9 | 시나리오 run/step | 실행 원장의 시작 |
| V10 | HTTP 증거 3컬럼 | 제휴 API 시나리오 전용 |
| V11 | 부하 지표 5컬럼 | 트래픽·자원 시나리오 전용 |
| V12 | tb_article.created_at, parent_id+created_at 색인 | 정렬 기준 변경과 함께 도입 |
| V13 | 블로그 5종 (category, post, tag, post_tag, comment) | 시드·revision 없는 두 번째 콘텐츠 저장소, RESTRICT FK |
| V14 | tb_blog_post.view_count, tb_blog_daily_stat | 개별 식별자를 저장하지 않는 날짜별 집계 |
| V15 | 유입·디바이스 일별 집계 2종 | 소스가 늘어도 마이그레이션이 안 붙는 세로 테이블 |
| V16 | tb_outbox_event.claimed_at, 선점 부분 인덱스 | relay 다중 실행에 대비한 CLAIMED 상태 도입 |
| V17 | tb_user의 OAuth 컬럼·부분 유니크 인덱스 드롭 | 구글 로그인 제거의 스키마 반영 (계정 절) |
| V18 | tb_blog_post.slug 유니크 인덱스 | 중복이면 마이그레이션이 실패하고 배포가 멈추게 설계 |
| V19, V20 | 위키·블로그의 toc_enabled | 본문 표시자로 켜던 것을 컬럼으로 옮겨 쿼리로 보이게 |
| V21 | tb_article.view_count | 시드가 덮지 않는 컬럼. 배포가 시드를 다시 돌려도 남는다 |
| V22~V24 | tb_wiki_featured와 초기값 | 전시 목록을 컬럼이 아니라 테이블로. 열 번째 FK가 여기서 생겼다 |
| V25 | tb_saga_customer | 주문에 구매자를 붙임. 분리 뒤 서비스들은 id 참조만 들고 이름은 복제 안 함 |
| V26 | tb_payment_projection | **결제의 원본이 이 DB를 떠나기 위한 준비.** 읽기 전용 사본 도입 |
| V27 | tb_saga_payment 드롭 | 결제 소유권이 payment-api로 넘어간 시점. 되돌리기 어려운 쪽의 커밋 |
| V28 | tb_shipping_projection | 배송에 대해 V26을 반복 |
| V29 | tb_saga_shipping 드롭 | 배송 소유권이 shipping-api로. 같은 모양이 둘이면 패턴이다 |
| V32 | 집계 셋을 tb_site_*로, site 열과 ref_internal 추가, tb_blog_comment.source | 블로그 전용이던 유입 통계를 위키까지 넓힌 자리 |
| V33 | tb_user.source | 가입까지 유입 경로를 잇는다. 계정에 영구히 남으므로 가입 화면에 고지 |

V1의 주석은 지금도 파일에 남아 있다. "원본(SoT)은 web/docs/*.md. 이 테이블은 검색/통계용 사본."
그 전제는 V2에서 뒤집혔지만 컬럼은 남았고, tb_article.synced_at이 그 시절의 마지막 잔재다.
**마이그레이션은 되돌릴 수 없으므로 스키마에는 폐기된 판단의 자국이 남는다.** 이 글이 실물 스키마를 기준으로 삼은 이유다.

V12에서 겪은 함정도 기록해 둔다. 사전순 ls는 V9 다음에 V10을 놓지 않는다.
그 뒤로 다음 마이그레이션 번호는 ls 한 줄이 아니라 sort -V로 확인한다.

V26~V29 넷이 한 묶음이라는 것도 이 표에서 읽힌다. 사본을 먼저 만들고(V26·V28),
원본을 나중에 드롭한다(V27·V29). 순서를 뒤집으면 사본이 채워지기 전에 화면이 읽을 것을 잃는다.

## 미완은 스키마가 아니라 파이프라인 뒷단에 있다

아래는 로컬 DB 조회와 코드 확인으로 근거를 잡은 항목만 적었다.

| 항목 | 상태 | 근거 |
|---|---|---|
| tb_outbox_event의 ORDER_SAGA 행 | **발행되지 않는다** | relay 쿼리가 aggregate_type='KAFKA_DEMO_ORDER'만 읽는다. 로컬의 ORDER_SAGA 33건은 전부 status='NEW'로 남아 있고 KAFKA_DEMO_ORDER 9건만 PUBLISHED다 |
| tb_post.views | **Redis 증가분이 DB로 돌아오지 않는다** | 화면 값은 views + Redis 카운터인데 flush하는 @Scheduled 작업이 없다. Redis가 비면 조회수는 시드 기저값으로 돌아간다 |
| tb_article.synced_at | 쓰기만 있다 | ArticleService가 저장할 때 null이면 채운다(커밋 a3d312d). 이후 읽는 코드는 없다 |
| tb_saga_shipping | **테이블 자체가 없어졌다** | 「스키마·코드는 완성인데 로컬 데이터 0행」으로 이 표에 오래 있던 항목이다. 성공 경로를 지나게 만드는 대신 배송 소유권을 shipping-api로 옮겼고, V29가 표를 드롭했다 |
| tb_article_asset | 구현 완료, 로컬은 ATTACHED 1건뿐 | 2026-08-10 로컬 9건 중 8건이 UNUSED다. 운영에서 assetId를 다시 발급해 참조·삭제 차단을 재검증하는 절차가 남아 있다 |
| tb_domain_scenario_run의 V10·V11 컬럼 | 일부 시나리오만 사용 | 나머지 시나리오에서는 DEFAULT 0이 그대로 남는다 |

첫 두 항목은 같은 성격의 미완이다. **쓰기는 구현했고 읽어 가는 쪽이 없다.**
Saga outbox는 이벤트를 남기지만 아무도 발행하지 않고, 조회수는 Redis에 쌓이지만 아무도 되돌려 쓰지 않는다.
둘 다 스키마가 잘못된 것이 아니라 파이프라인의 뒷단이 비어 있는 것이므로,
테이블을 고치지 않고 relay 대상 확장과 flush 배치 추가로 닫을 수 있다.

## 다섯 글이 이 지도의 각 자리를 더 판다

- 위키 3개 테이블의 전환 배경: [Markdown 파일에서 DB 위키로 전환한 이유](/wiki/postgres-db-wiki-revision)
- 이 데이터를 잃지 않는 방법: [백업 파일이 아니라 복원 결과를 확인하는 방법](/wiki/postgres-restore-drill-1)
- tsv와 nori의 차이: [Elasticsearch 대신 OpenSearch와 nori를 선택한 이유](/wiki/opensearch-nori-image)
- 이미지 자산의 저장 위치 기준: [MinIO에서 포트폴리오 자산을 제공하는 이유](/wiki/minio-portfolio-assets)
- Saga와 Outbox의 실행 화면: [주문 Saga와 Kafka Outbox](/wiki/saga-kafka-outbox-order)
