
- 운영 배포 뒤 favicon 404와 사라진 기술 로고의 원인이 각각 어디에 있었나?
- 화면 문제가 아니라 Next standalone runtime의 public 디렉터리 누락과 비어 있던 MinIO bucket, 서로 다른 두 배포 단위의 문제로 나눠 각각 복구하기로 했다.
- favicon, header mark, Kubernetes와 MinIO 기술 로고를 공개 URL로 요청해 모두 HTTP 200을 확인했다.

2026-07-11 운영 배포 뒤 오케스트레이션 맵에서 기술 로고가 보이지 않고 favicon도 404였다.
화면 문제처럼 보였지만, 정적 자산 전달 경로와 object storage 상태를 각각 확인해야 했다.

## 원인 — public 디렉터리 누락과 빈 bucket, 둘이었다

1. Next standalone Docker runtime은 .next standalone과 static만 복사하고 public 디렉터리를 복사하지 않았다.
2. MinIO same-origin asset route는 배포됐지만 wiki-assets bucket의 portfolio stack 객체가 비어 있었다.

## 복구 — runtime에 public을 넣고 로고를 올렸다

Docker runtime에 public 디렉터리를 포함했다. MinIO는 in-cluster Job으로 기술 로고 SVG를 내려받아
wiki-assets/portfolio/stack 경로에 업로드했다. Job은 완료 뒤 삭제되며, 배포 workflow에서도 같은 동기화를 실행한다.

## 검증 — 공개 URL 요청이 전부 HTTP 200이었다

favicon, header mark, Kubernetes와 MinIO 기술 로고를 공개 URL로 요청해 모두 HTTP 200을 확인했다.
MinIO를 브라우저에 직접 노출하지 않고 Next.js same-origin route를 통해 제공하므로, bucket endpoint나 credential은
클라이언트에 드러나지 않는다.

## container 산출물, public 파일, object storage는 서로 다른 배포 단위다

화면에서 아이콘 하나가 보이지 않아도 HTML, Next static, public, BFF route, MinIO object를
분리해 확인해야 빠르게 원인을 좁힐 수 있다.
