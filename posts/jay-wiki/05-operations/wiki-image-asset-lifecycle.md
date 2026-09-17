---
title: "위키 이미지와 MinIO 자산 수명주기를 관리하는 방법"
slug: wiki-image-asset-lifecycle
tab: "운영·관측"
parentId: operations
sortOrder: 3
kind: adr
tags: minio,image,markdown,proxy,revision,lifecycle
source: scripts/seed-portfolio-wiki.mjs
---
- 위키 이미지가 MinIO 주소 변경·환경 차이·과거 revision에서도 깨지지 않게 어떻게 저장하나?
- 본문에는 MinIO URL 대신 /api/wiki-assets/{assetId} 프록시 경로만 저장하고, 삭제는 상태값이 아니라 본문·revision·블로그를 참조 검색해 하나라도 참조가 있으면 거부하기로 했다.
- PNG 업로드 후 원본과 Spring·Next 프록시 응답의 SHA-256이 일치했고, revision이 참조하는 자산의 삭제가 차단되며, 위장 파일이 signature·MIME 검사로 400을 받는 것을 로컬에서 확인했다.

> 현재 상태: 로컬 수명주기 검증과 운영 전용 자격증명 구성 완료, 운영 에디터의 실제 이미지 리허설 예정

위키 글에 이미지를 넣으려면 파일 업로드 버튼만 추가해서는 부족하다.

로컬과 운영이 같은 글을 읽어야 하고, MinIO 주소가 바뀌어도 본문은 유지돼야 하며, 과거 revision을 열었을 때 이미지가
깨지지 않아야 한다. 자유게시판 첨부는 이번 범위에서 제외하고 관리자 위키 편집만 대상으로 한다.

## 본문에는 MinIO 주소를 저장하지 않는다

Markdown에는 실제 bucket URL이나 presigned URL 대신 애플리케이션의 영구 경로를 저장한다.

~~~markdown
![오케스트레이션 구성](/api/wiki-assets/0a1b2c3d-4e5f-6789-abcd-ef0123456789)
~~~

상대 경로이므로 같은 본문이 환경에 따라 자연스럽게 다른 origin을 사용한다.

| 환경 | 브라우저가 요청하는 주소 |
|---|---|
| 로컬 | http://localhost:3000/api/wiki-assets/0a1b2c3d-4e5f-6789-abcd-ef0123456789 |
| 운영 | https://portfolio.leneu.cloud/api/wiki-assets/0a1b2c3d-4e5f-6789-abcd-ef0123456789 |

두 환경은 같은 URL 계약을 사용하지만 각자의 MinIO 객체를 읽는다. 본문은 저장소 위치를 모르고, 실제 object key와
endpoint는 서버 설정과 자산 메타데이터만 안다.

## 읽기와 쓰기 모두 Spring을 지나게 했다

~~~mermaid
flowchart TB
    A[관리자 Markdown 에디터] --> B[Next.js 관리자 업로드 API]
    B --> C[Spring ADMIN 인증과 파일 검증]
    C --> D[(tb_article_asset)]
    C --> E[(운영 MinIO wiki-assets)]
    A --> F[Markdown에 proxy URL 삽입]
    G[문서 독자] --> H["Next.js /api/wiki-assets/{assetId}"]
    H --> I[Spring asset 조회]
    I --> E
~~~

읽기 경로도 Spring을 지난다. 브라우저는 Next 라우트만 부르고, Next가 Spring에 요청을 넘기며,
Spring이 메타데이터로 object key를 해석해 MinIO에서 객체를 읽는다. Next 프록시는 Spring에 넘기기 전에
assetId 형식을 정규식으로 먼저 거른다 — 36자 UUID 꼴이 아니면 Spring에 닿기도 전에 잘린다.

cache는 두 겹이다. Spring이 1년 immutable로 주고, Next가 하루마다 재검증한다. assetId가 불변 식별자라
가능한 정책이다. 삭제된 자산은 읽기에서 404가 된다.

브라우저에는 MinIO access key를 주지 않는다. 로컬 Spring과 운영 Spring이 각각 서버 환경변수로 제한된 MinIO service
account를 사용한다. 운영 MinIO root 계정은 콘솔 관리에만 쓰고 애플리케이션 요청에는 사용하지 않는다.

## 업로드는 MinIO가 먼저고 DB가 나중이다

업로드는 MinIO put이 먼저, tb_article_asset save가 나중이다. DB 저장이 실패하면 방금 올린 객체를 되지운다.
순서를 반대로 하면 DB에는 있는데 파일이 없는 자산이 생겨 본문이 깨진다. 지금 순서의 최악은 DB가 모르는
고아 객체 하나가 MinIO에 남는 것이고, 그것도 보상 삭제가 지운다.

## 로컬 실수가 운영 자산을 지우지 못하게 저장소를 갈랐다

로컬 에디터가 운영 MinIO에 직접 쓰면 테스트 파일과 실제 콘텐츠의 경계가 사라지고, 개발 실수가 운영 자산 삭제로 이어질 수 있다.
따라서 로컬은 compose MinIO에서 업로드·미리보기·삭제 흐름만 검증하고 테스트 객체를 폐기한다. 실제 문서를 운영에 반영한 뒤
운영 관리자 에디터에서 최종 이미지를 등록한다.

PostgreSQL과 MinIO를 모두 환경별로 분리해 개발과 운영의 변경 권한을 명확히 한다. **공유하는 것은 DB나 객체가 아니라
Markdown의 same-origin URL 계약과 검토된 문서 내용이다.**

분리하면서 버킷 구성까지 같게 맞추지는 못했다. 로컬 compose는 버킷 다섯 개를 만들고(wiki-assets,
wiki-assets-thumbs, backups, batch-output, temp-uploads) 운영은 셋이다. thumbs와 temp-uploads는 어느
환경에서도 쓰는 코드가 없다. 이 글의 수명주기가 실제로 도는 곳은 양쪽 다 wiki-assets 하나다.

## 업로드는 관리자 에디터로만 열고 형식과 크기를 제한한다

| 항목 | 기준 |
|---|---|
| 권한 | ROLE_ADMIN만 업로드·삭제 가능 |
| 범위 | 관리자 에디터만 제공, 자유게시판 제외. 블로그 관리자 에디터도 같은 에디터 컴포넌트로 같은 업로드를 쓴다 |
| 형식 | JPEG, PNG, WebP, GIF |
| 검증 | 확장자가 아니라 MIME과 파일 signature를 함께 확인 |
| 크기 | 파일당 최대 10MB |
| 이름 | 사용자 파일명 대신 서버가 만든 assetId와 object key 사용 |
| 응답 | id, url, originalName, contentType, sizeBytes 반환 |

응답 행은 초판이 틀렸었다.

- 예전 서술 ~~응답은 assetId, proxy URL, 삽입할 Markdown을 반환한다~~
  - 2026-08-13 정정: 서버 응답은 id, url, originalName, contentType, sizeBytes다. 삽입할 Markdown
    문자열은 서버가 주지 않고 브라우저가 응답의 url로 조립한다.

에디터는 파일 선택, 드래그 앤 드롭과 클립보드 붙여넣기를 같은 업로드 함수로 처리한다. 성공하면 현재 textarea 커서에
Markdown을 삽입하고 라이브 미리보기에서 바로 확인한다.

## DB는 메타데이터, MinIO는 파일을 맡는다

구현한 tb_article_asset의 핵심 필드는 다음과 같다.

| 필드 | 역할 |
|---|---|
| id | 본문 proxy URL에 쓰는 불변 식별자 |
| object_key | MinIO 내부 객체 경로 |
| original_name | 관리자 확인용 원래 파일명 |
| content_type, size, checksum | 형식·용량·무결성 검증 |
| status | TEMP, ATTACHED, UNUSED 상태 |
| attached_at | 본문에 연결된 시각 |
| uploaded_by, created_at | 변경 주체와 생성 시각 |
| deleted_at | 지연 삭제와 감사 기준 |

MinIO 목록을 매 요청마다 탐색하지 않는다. 애플리케이션은 PostgreSQL에서 assetId를 object key로 해석한 뒤 객체를
읽어 돌려준다. 스트리밍은 아니다 — Spring 컨트롤러가 객체 전체를 byte 배열로 메모리에 올려 응답하고, 파일당 10MB
상한이 있어 그 방식으로도 동작한다. 프록시는 Content-Type, Cache-Control, ETag와 nosniff 헤더를 명시한다.

## 본문에서 지웠다고 즉시 삭제하지 않는다

현재 본문에서 이미지 Markdown을 지워도 과거 revision이 그 이미지를 참조할 수 있다. 즉시 객체를 삭제하면 위키의
버전관리 기능은 텍스트만 복원하고 이미지는 복원하지 못하는 반쪽 기능이 된다.

| 상태 | 전환 조건 | 삭제 가능 여부 |
|---|---|---|
| TEMP | 업로드됐지만 아직 문서 저장 전 | 참조 검색을 통과하면 명시적으로 삭제 |
| ATTACHED | 현재 본문 또는 revision이 참조 | 참조가 남아 있는 동안 거부 |
| UNUSED | 명시적 삭제로 객체를 제거하고 메타데이터만 남김 | 다시 읽을 수 없음 |

이 표의 예전 판은 삭제 기준을 틀리게 적었다.

- 예전 서술 ~~ATTACHED 상태는 삭제를 차단한다~~
  - 2026-08-13 정정: 차단 기준은 상태가 아니라 참조 검색이다. 삭제 요청이 오면 현재 본문, 모든 revision,
    블로그 본문과 커버까지 assetId를 검색해 하나라도 참조가 있으면 거부한다. ATTACHED라도 참조가 전부
    사라졌으면 삭제되고, TEMP라도 참조가 있으면 거부된다. 상태는 결과의 기록이지 판정 기준이 아니다.

참조 추출은 문자열 매칭이다. 그래서 코드블록 안의 예시 URL도 참조로 센다. 삭제가 과보호되는 쪽으로 기운
알려진 성질이고, 실수로 지워지는 쪽보다 안 지워지는 쪽이 낫다고 보고 그대로 뒀다.

현재 구현에는 TEMP 자산을 일정 시간이 지나면 자동 정리하는 스케줄러나 UNUSED 30일 유예 삭제가 없다.
자동 정리는 업로드 중인 파일을 오인하지 않을 TTL, 실패 재시도, 삭제 감사 기록을 정한 뒤에 붙일 계획이다.
문서 자체를 삭제해도 복원 가능성을 위해 객체는 바로 지우지 않는다.

같은 문제의 판본이 정적 자산 쪽에도 있다. 발행된 본문이 경로를 붙잡으면 저장소 이미지도 이름을 못 바꾼다.
상세는 [MinIO 공개 자산을 운영하는 기준](/wiki/minio-public-asset-governance)에 있다.

## MinIO versioning과 문서 revision은 다르다

MinIO versioning은 같은 object key가 덮어써졌을 때 이전 바이너리를 보존한다. 문서 revision은 어느 글 버전이 어떤
assetId를 참조했는지 보존한다. 둘은 서로 대신할 수 없다.

애플리케이션에서는 객체를 덮어쓰기보다 새 assetId를 만드는 불변 자산 방식을 기본으로 한다.

- 예전 서술 ~~MinIO versioning은 운영 실수에 대비한 추가 안전망으로 사용한다~~
  - 2026-08-13 정정: versioning은 켜져 있지 않다. 저장소 어디에도 켜는 설정이나 명령이 없고 MinIO
    기본값은 비활성이다. 안전망은 불변 assetId와 참조 검색뿐이고, versioning은 켜면 그때 적는다.

## 로컬 검증은 마쳤고 운영 이미지 리허설 하나가 남았다

1. PNG 업로드 후 원본과 Spring·Next 프록시 응답의 SHA-256이 일치했다.
2. 에디터는 파일 선택·드롭·붙여넣기 후 현재 커서에 proxy Markdown을 삽입한다.
3. 확장자가 아니라 signature와 MIME을 함께 검사해 위장 파일을 400으로 거부했다.
4. 저장된 본문이나 revision이 참조하는 자산의 삭제를 차단했다.
5. 참조가 없는 TEMP 자산은 명시적으로 삭제하고 MinIO 객체와 메타데이터 상태를 함께 정리했다.
6. 운영 전용 service account와 bucket 제한 policy는 Kubernetes Secret 경로로 구성했다.
7. 운영 관리자 에디터에서 실제 이미지를 업로드하고 revision 참조·삭제 차단까지 다시 확인하는 리허설은 남아 있다.

이 설계의 핵심은 MinIO를 사용했다는 사실이 아니다. 본문, revision, 파일과 환경의 수명주기를 분리하면서도 하나의
복원 가능한 문서로 유지하는 데 있다.
