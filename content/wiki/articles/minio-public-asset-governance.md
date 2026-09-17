
- 기술 로고, 위키 이미지와 공개 자료 파일을 MinIO에서 누가 쓰고 누가 읽으며 어떤 기준으로 교체·삭제하는가?
- 브라우저에는 MinIO endpoint 대신 same-origin read-only API만 노출하고, 글과 같은 commit에서 검토되는 고정 이미지는 저장소에, 운영 중 바뀌는 자산만 MinIO에 두기로 판단했다.
- 운영 MinIO에 첫 release를 배포한 뒤 공개 파일 4개(plan.md, raw.json, result.md, SHA256SUMS)의 HTTP 200, MIME, Content-Disposition, ETag와 checksum 일치를 확인했고, 미등록 파일과 traversal 요청이 404로 차단되는 것을 검증했다.

jay-wiki는 오케스트레이션 맵의 기술 로고, 위키 첨부 이미지와 벤치마크 공개 자료를 MinIO에 보관한다.
파일을 MinIO에 올리는 것만으로 운영이 끝나는 것은 아니다. 누가 쓰고, 누가 읽으며, 본문과 파일 주소를
어떻게 분리하고, 교체와 삭제를 어떤 기준으로 처리할지 함께 정했다.

## 왜 DB나 public 디렉터리만 사용하지 않는가

| 저장 위치 | 적합한 대상 | 한계 |
|---|---|---|
| PostgreSQL | 문서 본문, revision, 파일 metadata와 참조 관계 | 큰 binary를 계속 넣으면 backup과 조회 책임이 섞인다 |
| Git·public | 애플리케이션과 함께 versioning할 작은 정적 자산 | 파일 변경마다 image rebuild가 필요하고, 발행된 본문이 경로를 참조하면 파일명도 못 바꾼다 |
| MinIO | 이미지, 문서, 실행 결과와 다운로드 파일 | 접근 정책, object key와 수명주기를 별도로 설계해야 한다 |

MinIO는 파일 창고로 써도 된다. 다만 모든 파일을 한 bucket과 권한으로 섞지 않고, 애플리케이션 DB에는
소유자·checksum·MIME·크기·상태와 참조 관계를 남긴다.

## 현재 자산과 앞으로의 파일을 같은 원칙으로 다룬다

| 자산 유형 | 예시 | 저장 위치 | 제공 방식 |
|---|---|---|---|
| 화면 장식 자산 | 오케스트레이션 맵 기술 로고 | MinIO | 허용된 portfolio prefix를 same-origin route로 조회 |
| 글과 함께 버전 관리하는 고정 이미지 | 화면 장식, miniPC 분해 사진, 앱 아이콘 | 저장소의 web public | 애플리케이션 정적 경로로 제공 |
| 블로그 글의 스크린샷 | 글에 딸린 캡처 | **저장소의 posts/jay-blog/assets + MinIO** | 원본은 git이 들고, 화면에는 assetId로 제공 |
| 운영 중 관리자가 올리는 이미지 | 편집 화면에서 추가하는 본문 이미지 | MinIO | assetId를 DB에서 object key로 해석해 조회 |
| 공개 자료 파일 | JSON, Markdown, checksum manifest | MinIO | 자료별 read-only prefix에서 조회·다운로드 |

블로그 스크린샷 행은 2026-09-01에 갈랐다. 그전에는 저장소 web public 한 곳이었는데, 그러면 그림 한 장이
들어갈 때마다 컨테이너 image를 다시 굽는 배포가 필요했다. 글이 늘면서 그 비용이 GitHub Actions 포함 시간
2,000분을 넘겼다. 저장소에 두는 것과 컨테이너에 굽는 것은 원래 별개인데 폴더 위치 하나로 붙어 있었다.
그래서 원본은 web public 밖의 posts/jay-blog/assets에 두어 git 이력을 지키고, 화면에 나가는 것은
MinIO의 assetId로 바꿨다. 발행 스크립트가 업로드·주소 치환·파일 이동을 한 번에 한다.

**assetId가 환경마다 새로 발급된다는 문제는 업로드를 운영 한 곳에서만 하는 것으로 푼다.** 로컬에는 올리지
않고, 개발 서버가 운영 주소를 대신 불러 화면을 맞춘다. 이 원칙은 그대로 살아 있다.

이 표의 예전 판에는 한 행이 더 있었다.

- 예전 서술 ~~비공개 운영 파일(backup, 임시 upload, 내부 export)도 MinIO에 두고 공개 route에서 접근을 금지한다~~
  - 2026-08-13 정정: MinIO에 그런 파일이 하나도 없다. PostgreSQL 백업은 PVC로 가고, 내부 export나 임시
    upload를 MinIO에 쓰는 코드가 저장소에 없다. backups·batch-output bucket은 선언만 있고 사용처가 없다.
    현재 자산 표에 이 행이 있으면 안 된다.

이미지를 두 줄로 나눈 이유가 있다. **assetId는 환경마다 새로 발급된다.** 로컬에서 업로드한 이미지의
assetId를 본문에 넣으면 운영에 이식할 때 이미지를 다시 올려 본문을 고쳐야 한다. 그래서 글과 함께
검토·배포되는 고정 이미지는 저장소에 두고 정적 경로로 제공하고, 운영 중 관리자가 화면에서 추가하는
이미지만 assetId 경로를 쓴다.

기준은 **누가 언제 바꾸는가**다. 글과 같은 commit에서 검토되는 자산은 코드와 함께 버전 관리하는 편이
재현에 유리하고, 배포와 무관하게 운영 중 바뀌는 자산은 object storage에 두는 편이 낫다. 어느 쪽이든
MinIO 내부 주소와 credential을 본문에 저장하지 않는 원칙은 같다.

## 저장소 자산도 발행된 본문이 경로를 붙잡는 순간 불변 자산이 된다

초판은 저장소·public 폴더의 한계를 재빌드·재배포 비용으로만 적었다. 그건 부족하다. 실제로 이런 일이 있었다.

저장소 이미지 39개를 webp로 바꿔 11.8MB를 2.7MB로 줄였다. 그런데 발행된 블로그 글의 본문은 운영
PostgreSQL에 있어서, 파일 이름을 바꾸면 이미 나간 글의 그림이 깨진다. 그래서 파일명을 바꾸는 대신
next.config에 옛 .png·.jpg 경로를 .webp로 넘기는 rewrite를 넣었다. 브라우저는 확장자가 아니라
Content-Type을 보므로 정상 표시된다.

즉 발행된 본문이 경로를 붙잡는 순간 저장소 자산도 사실상 불변 자산이 된다. MinIO 쪽의 같은 key에 조용히
덮어쓰지 않는다는 원칙과 대칭이다. 저장 위치가 달라도 같은 제약이 걸린다는 것이 이 글의 저장 위치 분기
기준을 오히려 강화한다.

## 업로드 전에 파일 묶음과 checksum을 만든다

관련 파일은 임의의 이름으로 하나씩 올리지 않고 하나의 공개 단위로 묶는다.

- 예전 서술 ~~공개 단위는 README.md, data.json, report.pdf, SHA256SUMS로 구성한다~~
  - 2026-08-13 정정: 운영 MinIO의 첫 release 실물은 plan.md, raw.json, result.md, SHA256SUMS다.
    로컬 LLM 벤치마크의 계획·원본 데이터·결과 문서와 checksum manifest다.

~~~text
publications/local-llm/2026-07-21-m1-max/
  plan.md
  raw.json
  result.md
  SHA256SUMS
~~~

release-id에는 날짜나 version처럼 다시 식별할 값을 사용한다. 공개한 파일을 같은 key에서 조용히 덮어쓰지
않는다. 내용이 바뀌면 새 release를 만들고 이전 release에는 대체된 이유와 새 링크를 남긴다.

이 업로드는 사람이 돌리는 작업이 아니라 **배포 파이프라인에 상시 편입돼 있다.** 매 배포마다
발행물 준비 스크립트가 묶음을 만들고, 업로드 Job이 기존 SHA256SUMS와 비교해 같으면 건너뛰고 다르면
실패한다. 불변 확인이 매 배포마다 도는 셈이다.

SHA256SUMS는 파일이 업로드·다운로드 과정에서 바뀌지 않았는지 확인하는 무결성 자료다. checksum은 내용이
옳거나 안전하다는 보장은 아니므로, 업로드 전 파일 형식, 개인정보, Secret, 저작권과 공개 범위를 별도로
검토한다.

## MinIO 계정 권한은 어디까지 좁혔나

애플리케이션은 root 계정을 쓰지 않는다. ensure-minio-app-secret.sh가 wiki-assets bucket에만 권한을 준
service account를 만들어 Spring에 넘긴다. 다만 계정은 아직 그 하나뿐이고 권한도 bucket 전체다 — 자산
종류별로 나누거나 prefix 단위로 좁히지는 않았다.

| 주체 | 지금의 권한 |
|---|---|
| Spring 애플리케이션 | 전용 계정 하나로 wiki-assets bucket의 Get·Put·Delete. 위키 첨부와 공개 자료 묶음이 같은 계정을 쓴다 |
| 기술 로고 업로드 Job | root 자격증명. 전용 계정으로 옮기는 것이 남은 일이다 |
| 공개 자료 업로드 (운영 Job) | Spring과 같은 전용 계정을 읽어 쓴다 |
| 공개 자료 업로드 (로컬 스크립트) | root 자격증명. 권한 표의 로컬 예외로, 아직 전용 계정으로 옮기지 않았다 |
| 공개 조회 API | 자격증명을 쓰지 않는다. bucket을 익명 읽기로 두고 공개 범위는 Next 라우트의 allowlist로 정한다 |
| 관리자 | Console 접근과 정책 관리, 일반 애플리케이션 요청에는 사용하지 않음 |

다만 **allowlist는 Next 라우트에만 있다.** bucket 자체는 익명
읽기라 MinIO S3 endpoint를 직접 치면 allowlist를 우회할 수 있다. MinIO Console과 S3 endpoint를 Cloudflare
공개 경로에 열지 않아 클러스터 밖에서는 닿지 않지만, 공개 범위는 allowlist로 정한다는 문장은 same-origin
경로로 들어올 때만 성립하는 조건부 문장이다.

## 브라우저에는 same-origin read-only API만 보여준다

Markdown과 화면에는 MinIO endpoint, bucket 이름이나 만료되는 presigned URL 대신 애플리케이션 경로를 저장한다.

~~~text
/api/wiki-assets/{assetId}
/api/assets/portfolio/stack/{filename}
/api/assets/publications/{collection}/{release-id}/{filename}
~~~

공개 API는 허용한 prefix와 확장자만 읽고 directory traversal을 차단한다. 응답에는 정확한 Content-Type,
안전한 Content-Disposition, ETag 또는 checksum과 nosniff header를 설정한다. PutObject와 DeleteObject는
공개 endpoint에 두지 않는다.

cache 정책은 자산 종류마다 다르고, 그 차이가 불변 주장을 뒷받침한다. 로고는 max-age 3600에
stale-while-revalidate 86400을 줘 교체 가능성을 열어 두고, 발행물은 max-age 31536000 immutable이다.
release가 불변이라는 정책을 header가 그대로 말한다.

이 구조를 사용하면 MinIO endpoint나 bucket 정책이 바뀌어도 본문 URL을 유지할 수 있고, 로컬과 운영은 같은
URL 계약 뒤에서 서로 다른 MinIO를 사용할 수 있다.

## 이미지의 삭제는 문서 revision까지 확인한다

위키 이미지는 현재 본문에서 빠졌다는 이유만으로 바로 삭제하지 않는다. 현재 article과 과거 revision 중
하나라도 assetId를 참조하면 MinIO 객체를 보존한다.

- 예전 서술 ~~참조 없는 TEMP 파일은 유예 기간 뒤 정리하고, UNUSED 자산도 보존 기간과 권리 문제를 확인한 뒤 삭제한다~~
  - 2026-08-13 정정: 자동 정리 스케줄러도 유예 기간도 구현이 없다. 삭제는 수동 호출뿐이다. 같은 위키의
    수명주기 글이 스케줄러나 30일 유예 삭제가 없다고 정확히 적고 있어 두 글이 서로 어긋나 있었다.

상태 전이와 삭제 차단 기준의 상세는
[위키 이미지와 MinIO 자산 수명주기를 관리하는 방법](/wiki/wiki-image-asset-lifecycle)이 정본이다.

공개 자료 묶음은 개별 파일보다 release 단위로 보존한다. 새 release가 생겨도 기존 링크를 즉시 제거하지
않으며, 개인정보나 Secret처럼 즉시 차단해야 하는 사유가 있을 때는 객체, CDN cache, backup과 접근 log의
영향 범위를 함께 확인한다.

## 반영과 검증은 일곱 단계로 돈다

1. 공개할 파일 묶음과 SHA256SUMS를 생성한다.
2. 파일 형식, 크기, 개인정보·Secret, 출처와 공개 범위를 검토한다.
3. 운영 MinIO의 별도 prefix에 업로드한다. 이 단계는 배포 파이프라인이 매번 대신 돌고, 기존 release와
   checksum이 다르면 실패한다.
4. read-only same-origin 조회·다운로드 API를 연결한다.
5. 검증된 실제 공개 링크만 글에 추가한다. 실제 소비처는 위키가 아니라 블로그 글이다 — 벤치마크 발행물
   링크는 블로그 본문에서 쓰인다.
6. 로컬과 운영에서 HTTP 200, MIME, Content-Disposition과 checksum 일치를 확인한다.
7. 삭제·교체가 필요한 경우 참조와 release 보존 정책을 먼저 검사한다.

현재 기술 로고와 위키 이미지에는 MinIO 저장과 same-origin 조회가 적용돼 있다. 발행물도 묶음 생성,
checksum, 불변 업로드와 공개 다운로드 API까지 구현해 운영에서 검증했다.

이 운영 방식의 목적은 모든 파일을 MinIO에 모으는 것이 아니다. **DB, Git, 컨테이너와 object storage가
각자 잘하는 책임을 맡고, 방문자는 내부 저장소를 몰라도 안정적인 주소로 필요한 자료를 확인하게 만드는
것**이다.
