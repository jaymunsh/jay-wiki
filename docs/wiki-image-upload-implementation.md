# 위키 이미지 업로드 구현 기록

## 결정

관리자 위키 글만 이미지를 업로드할 수 있다. 자유게시판 첨부는 별도 보안·보존 정책이 필요하므로 제외했다.
로컬과 운영은 PostgreSQL과 MinIO를 모두 분리한다. 로컬에서는 기능을 검증한 뒤 테스트 객체를 폐기하고,
실제 문서 이미지는 운영 배포 후 관리자 화면에서 수동 등록한다.

Markdown에는 MinIO endpoint나 presigned URL 대신 아래 영구 경로를 저장한다.

```markdown
![설명](/api/wiki-assets/{assetId})
```

이 계약 덕분에 저장소 주소와 credential을 브라우저에 공개하지 않고 환경별 MinIO를 바꿀 수 있다.

## 요청 흐름

1. 관리자가 파일 선택, 드롭 또는 붙여넣기로 이미지를 입력한다.
2. Next.js server action이 ADMIN 세션을 확인하고 multipart 요청을 Spring에 전달한다.
3. Spring이 10MB 제한, 허용 MIME과 실제 PNG·JPEG·WebP·GIF signature를 검증한다.
4. 바이너리는 MinIO `wiki-assets/articles/{assetId}/original.{ext}`에 저장한다.
5. PostgreSQL `tb_article_asset`에 object key, checksum, 크기, 업로더와 TEMP 상태를 기록한다.
6. 에디터가 반환된 proxy Markdown을 현재 커서에 삽입한다.
7. 문서 저장 시 본문의 assetId를 찾아 ATTACHED로 전환한다.

## 삭제와 revision

현재 본문에서 이미지를 지워도 과거 revision이 참조할 수 있다. 삭제 API는 현재 article과 모든 revision을 검색하며,
한 곳이라도 `/api/wiki-assets/{assetId}`가 남아 있으면 거부한다. 참조가 없는 TEMP 자산만 에디터에서 즉시 정리할 수 있다.
DB 메타데이터 저장이 실패하면 앞서 생성한 MinIO 객체를 보상 삭제한다.

## 로컬 검증 증거

- 정상 PNG 업로드 성공
- 원본, Spring GET, Next.js GET의 SHA-256 일치
- Markdown same-origin 이미지 경로가 sanitizer를 통과하는 단위 테스트
- 이미지로 위장한 비허용 파일 400 응답
- 미참조 TEMP 삭제 후 GET 404와 DB UNUSED 상태 확인
- 문서에 연결된 ATTACHED 자산 삭제 차단 확인
- Spring 전체 테스트, 웹 TypeScript 검사와 Vitest 통과

## 운영 전환 체크리스트

1. [완료] MinIO에 `wiki-assets` 전용 service account를 만들고 List/Get/Put/DeleteObject 권한만 부여한다.
2. [완료] `backend/jaywiki-secrets`에 `APP_MINIO_ACCESS_KEY`, `APP_MINIO_SECRET_KEY`를 추가한다.
3. [완료] V8 Flyway migration과 새 Spring·Next 이미지를 배포한다.
4. [남음] 운영 관리자 화면에서 실제 이미지를 업로드하고 MinIO Console에서 object key를 확인한다.
5. 공개 문서의 proxy URL, Content-Type, Cache-Control, ETag, `X-Content-Type-Options: nosniff`를 확인한다.
6. revision을 만든 뒤 사용 중인 이미지 삭제가 거부되는지 확인한다.

현재 상태는 **로컬 수명주기 검증과 운영 자격증명 구성 완료, 운영 에디터 실제 이미지 리허설 예정**이다.
