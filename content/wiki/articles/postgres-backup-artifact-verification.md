
- backup Job의 성공 상태가 아니라 무엇을 봐야 백업이 복구 가능하다고 말할 수 있나?
- 생성, 무결성(sha256), 형식(pg_restore list), 복원(임시 DB), 내용(row count) 다섯 단계로 나눠 확인하기로 했다.
- 2026-07-07 운영 miniPC 수동 Job에서 pg_dump 16.14 클라이언트가 서버 18.4를 만나 server version mismatch로 실패했고, 클라이언트 이미지를 postgres 18 계열로 올린 뒤에야 dump와 sha256 artifact 생성을 확인했다.

이 프로젝트는 dump 파일 생성과 무결성, 복원 가능성을 분리해서 확인한다.

## 확인을 다섯 단계로 나눴다

| 단계 | 확인 내용 |
|---|---|
| 생성 | PostgreSQL backup Job이 dump 파일을 생성했는가 |
| 무결성 | dump와 함께 sha256 파일이 남는가 |
| 형식 | pg_restore list가 archive를 읽을 수 있는가 |
| 복원 | 임시 DB에 schema와 데이터를 복원할 수 있는가 |
| 내용 | 핵심 테이블 row count가 기대값과 맞는가 |

2026-07-07 운영 miniPC에서 backup Secret, PVC와 CronJob을 적용하고 수동 Job으로 dump와 sha256 artifact
생성을 확인했다. 로컬 restore rehearsal에서는 pg_restore와 row count 비교까지 실행했다.

첫 수동 Job은 성공하지 않았다. pg_dump 16.14 클라이언트가 서버 버전 18.4를 만나
server version mismatch로 중단했다. 이 실패도 결과로 남긴다. **backup Job이 "설정 완료"에서
"실제로 파일을 만든다"로 넘어간 시점이 바로 이 오류를 고친 뒤**였기 때문이다.
클라이언트 이미지를 postgres 18 계열로 올린 다음에야 dump와 sha256이 생성됐다.

## 백업을 생성물이 아니라 복구 절차로 본다

backup CronJob, PVC와 restore script를 함께 둔 이유는 backup을 생성물 하나가 아니라 복구 절차로 보기 위해서다.
dump 포맷, PostgreSQL major version, 권한, 연결 정보 중 하나라도 맞지 않으면 파일은 있어도 복원은 실패할 수 있다.

## 한계 — 백업 PVC가 아직 같은 디스크에 있다

현재 backup PVC는 miniPC와 같은 디스크에 있다. 장비나 디스크 장애에 대응하려면 Cloudflare R2 같은 외부 저장소로
복제하고, miniPC와 무관한 환경에서 restore rehearsal을 성공시켜야 한다. 이 단계는 아직 NEXT다.
