
- 기술 로고 같은 포트폴리오 자산을 왜 public 폴더가 아니라 MinIO에 두고 same-origin route로 내보내나?
- 브라우저가 MinIO 내부 주소, access key, bucket 구조를 모르게 허용된 경로만 프록시하고, 자산 실패가 기능 실패가 되지 않도록 이미지가 없으면 텍스트 라벨만 남기기로 판단했다.
- 배포마다 도는 k8s Job이 simpleicons CDN에서 받은 SVG를 wiki-assets bucket에 올리고 mc stat으로 객체 존재를 확인하며, 이미지 오류 시 텍스트 라벨만 남는 동작을 화면에서 확인했다.

오케스트레이션 맵의 기술 로고를 프론트엔드 public 폴더에만 두면, MinIO를 실제로 쓰는 이유가 화면에서
보이지 않는다. 그래서 포트폴리오 자산도 운영 중인 오브젝트 저장소의 한 사례로 만들었다.

실제로 로고 파일은 저장소에 아예 없다. 저장소가 들고 있는 것은 아이콘 이름 목록뿐이고, 파일 자체는
simpleicons CDN에서 받아 MinIO로 들어간다. public 폴더 대신이라는 말이 구호가 아니라는 뜻이다.

## 자산은 업로드 Job, MinIO, asset route를 차례로 지난다

| 단계 | 역할 |
|---|---|
| 업로드 Job | simpleicons CDN에서 SVG를 받아 wiki-assets bucket의 portfolio/stack/ 경로에 업로드 |
| MinIO | 오브젝트를 보관하고 k3s 내부에서 제공 |
| Next.js asset route | 허용된 경로만 MinIO에서 읽어 same-origin 응답으로 전달 |
| orchestration map | 로고가 있으면 표시하고, 없거나 실패하면 텍스트 라벨만 남김 |

## 로고 업로드는 한 번 올려두는 작업이 아니라 배포마다 다시 돈다

deploy.yml이 배포할 때마다 data 네임스페이스에 Job을 만든다. Job의 첫 컨테이너가 simpleicons CDN에서
SVG를 받고, 다음 컨테이너가 mc로 wiki-assets/portfolio/stack/ 에 복사한 뒤 mc stat으로 객체가 실제로
있는지 확인하고 끝난다. 업로드가 성공했다는 판정을 복사 명령의 종료 코드가 아니라 저장소 조회로 내린다.

## same-origin route가 MinIO 내부 구조를 감춘다

브라우저가 MinIO 내부 주소, access key, bucket 구조를 직접 알 필요가 없다. Next.js route는 portfolio
stack 경로처럼 필요한 공개 자산만 허용하고, 경로 바깥 요청을 그대로 프록시하지 않는다. 이 구조는 나중에
bucket 정책이나 MinIO endpoint가 바뀌어도 브라우저의 자산 URL을 유지할 수 있게 한다.

허용 경로 목록과 접근 정책 전체는 [MinIO 공개 자산을 운영하는 기준](/wiki/minio-public-asset-governance)이
정본이다. 이 글은 로고라는 사례 하나만 다룬다.

## 자산 실패가 기능 실패가 되면 안 된다

기술 로고는 보조 정보다. MinIO가 잠시 응답하지 않거나 특정 SVG를 찾지 못해도 PostgreSQL, Redis, Kafka처럼
무슨 기술인지 읽을 수 있어야 한다. 그래서 이미지 오류가 나면 이미지만 숨기고 노드의 텍스트 라벨은 유지한다.

## 선언된 버킷 셋 중 실제로 쓰는 것은 wiki-assets 하나다

이 절은 두 군데가 틀렸었다. 옛 서술을 지우지 않고 남긴다.

- 예전 서술 ~~백업과 배치 산출물은 backups, batch-output bucket으로 이미 분리해 선언해 두었다~~
  - 2026-08-13 정정: 선언만 돼 있고 읽거나 쓰는 코드가 저장소에 하나도 없다. PostgreSQL 백업은 MinIO가
    아니라 PVC jaywiki-pg-backups(5Gi, data 네임스페이스)로 간다. 선언된 버킷 셋 중 실제로 쓰는 것은
    wiki-assets 하나다.
- 예전 서술 ~~wiki-assets bucket은 포트폴리오 자산에 쓰고~~
  - 2026-08-13 정정: 포트폴리오 자산 전용이 아니다. 한 버킷 안에 세 갈래 prefix가 들어 있다.

| prefix | 무엇 | 쓰는 주체 |
|---|---|---|
| portfolio/stack/ | 첫 화면 지도의 스택 로고 SVG 17개 | 배포마다 도는 Job |
| articles/{id}/ | 관리자가 에디터에서 올린 위키·블로그 이미지 | 관리자 화면 |
| publications/{collection}/{release}/ | 벤치마크 증거 파일 4개 | 배포 파이프라인 |

PostgreSQL 재해 복구용 외부 R2 복제는 아직 Phase B이며, 이 자산 경로가 외부 백업을 대신하지는 않는다.

## 한계 — 로컬과 운영의 업로드 동작이 다르고 Job은 root를 쓴다

- 로컬 업로드 스크립트는 portfolio/stack/ 을 통째로 지우고 다시 넣는데, k8s Job은 지우지 않고 덮어쓴다.
  같은 자산을 같은 경로에 넣지만 로컬과 운영의 동작이 다르고, 운영에서는 목록에서 빠진 옛 로고가 남는다.
- 로고 업로드 Job만 아직 root 자격증명을 쓴다. 애플리케이션은 전용 계정을 쓰는데 이 Job만 예외다.
- 작은 로고 하나도 저장소 경계, 공개 범위, fallback을 보여주는 운영 사례가 될 수 있다. 다만 자산 제공이
  본문과 시스템 설명보다 중요한 기능처럼 보여서는 안 된다.
