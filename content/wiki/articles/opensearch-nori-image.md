
- 한국어 검색을 위해 왜 Elasticsearch가 아니라 nori를 넣은 OpenSearch custom image인가?
- Apache 2.0 배포와 custom image를 다루기 쉬운 OpenSearch를 고르고, 16GB 홈서버라 heap 512m 단일 노드로 제한하며 장애 시 PostgreSQL LIKE로 fallback하는 파생 인덱스로만 쓰기로 판단했다.
- plugin 없는 노드에서 Unknown tokenizer nori tokenizer 오류를 먼저 겪었고, custom image 배포 뒤 운영 인덱스 100007건 색인과 X-Search-Engine 헤더로 실제 선택된 엔진을 확인했다.

## OpenSearch는 무엇이고 왜 DB 옆에 따로 두나

OpenSearch는 Elasticsearch에서 갈라져 나온 전문(full-text) 검색엔진이다. 둘 다 Apache Lucene 기반의
분산 검색엔진이며 index, mapping, analyzer, shard와 Query DSL 같은 핵심 개념을 공유한다.
이 글에서 OpenSearch에 대해 말하는 내용은 대부분 Elasticsearch에도 그대로 적용된다.

관계형 DB와 역할이 다르다. PostgreSQL은 행을 정확히 찾고 트랜잭션을 지키는 데 강하지만,
"이 말이 들어간 문서를 관련도 순으로"라는 질문에는 약하다. LIKE는 문자열 포함만 보고,
관련도 점수도 형태소 분석도 없다. 검색엔진은 문서를 미리 단어 단위로 쪼개 역색인(inverted index)에
넣어 두고, 질의가 오면 점수를 매겨 관련도 순으로 돌려준다. 대신 트랜잭션과 정합성은 DB만큼 지키지 못한다.

그래서 실무에서는 대체가 아니라 병행이 일반적이다.

| 도메인 | 원본 저장소 | 검색엔진이 맡는 부분 |
|---|---|---|
| 이커머스 | 주문·재고는 RDB | 상품 검색, 자동완성, 오타 보정, 필터·정렬(facet) |
| 금융 | 원장·거래는 RDB | 거래 내역 검색, 감사 로그 조회, 이상 거래 패턴 탐색 |
| 로그·관측 | 애플리케이션이 로그를 쏟아냄 | 수십억 건 로그의 실시간 검색·집계 (구 ELK, OpenSearch의 원래 주 용도) |
| 미디어·커뮤니티 | 게시글·댓글은 RDB | 본문 검색, 관련 문서 추천, 인기 검색어 |

공통 패턴은 하나다 — **원본은 트랜잭션을 지키는 저장소에 두고, 검색엔진에는 검색에 필요한 필드만
복제해 넣는다.** 검색엔진 쪽 데이터는 언제든 원본에서 다시 만들 수 있는 파생물로 취급한다.

## 얼마나 좋아지나 — 10만 건 실측 요약

이 프로젝트의 게시판 코퍼스 10만 건에서 같은 질의를 세 방식에 넣고 직접 쟀다. 요점은 셋이다.

- 희귀하거나 없는 단어에서 LIKE는 전체를 순차 스캔해 약 150ms, 인덱스 기반 방식은 5~14ms —
  **10~30배 차이**가 났다. 흔한 단어에서 LIKE가 2ms로 빨라 보이는 것은 페이지 상한 20건을
  금방 채워 일찍 멈춘 운이고, 비용의 상한이 다르다.
- 속도만이 아니라 **찾는 것 자체가 다르다.** 활용형(실험했었다)만 있는 문서를 기본형(실험)으로
  찾을 때 tsvector는 놓쳤고 nori는 찾았다.
- OpenSearch가 밀리초에서 항상 이기는 것은 아니다. 얻는 것은 관련도 점수, highlight,
  자동완성, 형태소 분석이다.

측정 표 전체, 읽는 법, 데이터가 더 커지면 어떻게 되는지는
[10만 건 검색 비교에서 실제로 확인한 차이](/wiki/search-comparison-results)에 상세히 적었고,
같은 비교를 [/board/search](/board/search)에서 직접 실행해 볼 수 있다.

jay-wiki도 같은 경계를 쓴다. 게시글과 위키의 원본은 PostgreSQL에 저장하고, OpenSearch는 원본 DB를
대체하지 않고 한국어 검색을 위해 필요한 필드만 복제한 파생 인덱스를 담당한다. 이 프로젝트에서는
Elasticsearch 계열의 검색 설계를 직접 운영하되, Apache 2.0 배포와 custom image를 다루기 쉬운
OpenSearch를 선택했다.

## Apache 2.0 배포 경계 때문에 OpenSearch를 골랐다

| 비교 | OpenSearch | Elasticsearch | 이 프로젝트의 판단 |
|---|---|---|---|
| 출발점 | Elasticsearch 7.10.2 계열에서 분리 | Elastic이 계속 개발하는 원 프로젝트 | 기존 Elasticsearch 경험을 옮기기 쉬움 |
| 라이선스·배포 | 프로젝트 배포판은 Apache 2.0 | 기본 배포판은 Elastic License 2.0, 소스 일부는 AGPLv3·SSPL 선택 가능 | 개인 홈랩의 custom image와 재배포 경계를 단순하게 유지 |
| 한국어 분석 | analysis-nori plugin 사용 | analysis-nori plugin 사용 | 어느 쪽이든 nori 설치와 재색인이 필요 |
| 관리 생태계 | OpenSearch Dashboards와 AWS 연계 | Kibana와 Elastic Stack 생태계 | 이 프로젝트는 Grafana 중심이므로 Dashboards·Kibana 의존성이 낮음 |
| 자원 특성 | Lucene·JVM heap·filesystem cache 사용 | Lucene·JVM heap·filesystem cache 사용 | OpenSearch가 본질적으로 더 가볍다고 주장하지 않음 |

Elastic의 라이선스는 2021년 이후 한 번 더 바뀌었다. 현재는 소스의 무료 부분에 AGPLv3 선택지가 추가됐지만,
공식 기본 배포판은 계속 Elastic License 2.0이다. 따라서 단순히 Elasticsearch는 오픈소스가 아니라고 쓰기보다,
이 프로젝트가 원하는 배포·수정 경계에서 OpenSearch의 Apache 2.0 배포가 판단하기 쉬웠다고 설명하는 편이 정확하다.

- OpenSearch 소개: https://docs.opensearch.org/latest/getting-started/intro/
- Elastic 라이선스 FAQ: https://www.elastic.co/pricing/faq/licensing/

## nori는 한국어 문장을 형태소 단위로 쪼갠다

nori는 한국어 문장을 검색 가능한 형태소 단위로 분석하는 tokenizer다.

예를 들어 상품권을 사용했습니다라는 문장은 공백만 나누는 대신 상품권, 사용, 하다와 같은 검색 단위로 분석될 수 있다.
한국어는 명사 뒤에 조사와 동사 뒤에 어미가 붙기 때문에 단순 문자열 포함 검색만으로는 표현이 조금 달라진 문서를 놓치기 쉽다.

현재 korean nori analyzer는 다음 필드에 적용한다.

| 인덱스 | 분석 필드 | 사용처 |
|---|---|---|
| jaywiki-posts-v1 | 게시글 title, content | 10만 건 LIKE·tsvector·OpenSearch 비교, highlight, 자동완성 |
| jaywiki-articles-v1 | 위키 title, summary, tags, body | 상단 위키 검색, 제목 가중치와 한국어 본문 검색 |

## plugin 없는 노드는 nori index를 못 만든다

nori analyzer를 만든다는 설정만 추가하면 Unknown tokenizer nori tokenizer 오류가 난다. index mapping은
맞아 보여도 실행 중인 노드가 plugin을 갖고 있지 않으면 index를 만들 수 없다.

## 선택 — nori를 설치한 custom image를 빌드한다

infra/opensearch/Dockerfile에서 OpenSearch 버전에 맞는 analysis nori plugin을 설치한 custom image를 만든다.
GitHub Actions는 이 이미지를 linux amd64로 빌드해 GHCR에 SHA 태그와 main 태그로 올린다.

| 단계 | 책임 |
|---|---|
| Dockerfile | nori plugin이 포함된 OpenSearch image 생성 |
| CI | application image와 함께 immutable SHA image push |
| deploy script | StatefulSet image를 새 SHA로 교체하고 rollout 확인 |
| reindex API | PostgreSQL tb_post 전체를 새 index에 다시 넣음 |
| 위키 동기화 | 문서 transaction commit 뒤 해당 slug를 best-effort로 upsert·delete |
| search API | OpenSearch를 우선 사용하고 장애 시 PostgreSQL LIKE로 fallback |

## 운영 index 100007건 색인과 형태소 검색을 확인했다

custom image에는 analysis nori plugin이 설치됐고, korean nori analyzer를 가진 index 생성이 가능했다.
운영 index에는 100007건이 색인됐고, 실험했었다를 실험으로 찾는 형태소 사례와 nori 자동완성을 확인했다.

상단 위키 검색은 응답의 X-Search-Engine 헤더로 OPENSEARCH_NORI 또는 POSTGRESQL_LIKE를 알려준다.
화면에서도 실제 선택된 엔진과 Redis HIT·MISS를 함께 확인할 수 있다. OpenSearch가 내려가도 문서 검색 자체는
중단하지 않고 PostgreSQL 제목·본문 LIKE 검색으로 전환한다.

## 16GB 홈서버라 heap 512m 단일 노드로 제한했다

GenMachine 4700U는 RAM 16GB를 PostgreSQL, Redis, Kafka, Spring, Next.js와 관측 스택이 함께 사용한다.
검색엔진 하나가 호스트 메모리의 절반을 독점하도록 둘 수 없기 때문에 다음처럼 범위를 제한했다.

| 항목 | 현재 설정 | 판단 |
|---|---|---|
| topology | single node, replica 0 | 검색 실험용이며 노드 장애 고가용성을 주장하지 않음 |
| JVM heap | Xms512m, Xmx512m | OpenSearch request 1Gi의 절반으로 고정 |
| container memory | request 1Gi, limit 1.5Gi | heap 외 native memory와 filesystem cache 공간을 남김 |
| storage | PVC 15Gi | 게시글·위키 파생 인덱스만 저장하고 PostgreSQL을 원본으로 유지 |
| 평시 운영 | 관리자 scale 0·1 지원 | 검색 실험이 필요 없을 때 메모리를 다른 workload에 양보 |

OpenSearch 공식 문서는 heap을 사용 가능한 메모리의 약 절반으로 두고 swap을 피하도록 권장한다.
Elasticsearch 역시 heap을 노드 메모리의 50% 이하로 두고 나머지를 off-heap과 filesystem cache에 남기도록 안내한다.
즉 하드웨어 제약은 OpenSearch가 Elasticsearch보다 가볍다는 근거가 아니라, 검색 노드의 크기와 가동 정책을 제한한 근거다.

- OpenSearch memory 설정: https://docs.opensearch.org/latest/install-and-configure/configuring-opensearch/configuration-system/
- Elasticsearch JVM heap 안내: https://www.elastic.co/guide/en/elasticsearch/reference/current/jvm-options.html

## 상단 위키 검색은 X-Search-Engine 헤더로 확인한다

1. 헤더 검색창에 검색어를 입력한다. 결과는 /search?q=검색어 주소로 열리므로 공유·북마크할 수 있다.
2. 또는 /search의 추천 키워드 중 하나를 선택한다. 추천 키워드는 예시 문구가 아니라 발행된 문서에 실제로 많이 붙은 태그 상위 5개다.
3. ENGINE이 OpenSearch · nori인지 PostgreSQL · fallback인지 확인한다.
4. 같은 검색어를 다시 실행해 Redis cache가 MISS에서 HIT로 바뀌는지 본다.
5. 결과를 선택해 해당 문서의 /wiki/<slug> 주소로 이동하는지 확인한다.

형태소 차이를 보려면 문서에 실제로 존재하는 활용형과 기본형을 번갈아 검색하는 것이 좋다.
성능을 비교할 때는 상단 위키 검색이 아니라 /board/search에서 같은 query를 LIKE, tsvector, OpenSearch에 동시에 실행한다.

관리자는 문서 전체 인덱스가 비었거나 mapping을 바꾼 뒤 POST /api/admin/search/wiki/reindex를 실행한다.
게시글 전체 재색인은 POST /api/admin/search/board/reindex다. 두 인덱스 모두 PostgreSQL에서 다시 만들 수 있으므로
OpenSearch PVC를 원본 데이터로 취급하지 않는다.

## image를 바꿔도 기존 index mapping은 안 바뀐다

plugin은 새 image에 들어가지만, 기존 index mapping은 자동으로 바뀌지 않는다. analyzer 또는 mapping을
바꿨다면 image rollout 뒤에 reindex API로 다시 색인한다. 컨테이너만 바꾸고 검색 결과가 그대로라고 기대하면
새 analyzer를 실제 데이터에 적용하지 못한다.

## 제품 선택보다 경계와 절차가 중요하다

원본과 인덱스의 경계를 지키고, 검색엔진이 내려갔을 때의 동작과 재색인 절차를 설명할 수 있는가가
어느 검색엔진을 골랐는가보다 앞선다고 판단했다. 그래서 이 글도 경계와 fallback, reindex 절차를 중심으로 적었다.
