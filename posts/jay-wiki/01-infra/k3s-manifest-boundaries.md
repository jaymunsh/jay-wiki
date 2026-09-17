---
title: "k3s 매니페스트를 서비스 경계로 나눈 기준"
slug: k3s-manifest-boundaries
tab: "인프라"
parentId: infra
sortOrder: 5
kind: wiki
tags: k3s,kubernetes,manifest,helm,secret
source: scripts/seed-portfolio-wiki.mjs
---
- 매니페스트를 어떤 경계로 나눠야 클린 클러스터에서 같은 설치를 재현할 수 있나?
- 손으로 만들던 네임스페이스와 홈 디렉터리에만 있던 Helm values를 infra 아래로 옮기고, Secret 실제 값과 CI가 교체하는 SHA 이미지는 매니페스트에 두지 않기로 판단했다.
- 손으로 만든 data·obs 네임스페이스는 클린 클러스터에서 Kafka와 backup CronJob이 참조할 곳이 없게 만들고, data 디렉터리는 kubectl apply 대상과 helm values가 섞여 있어 통째로 apply하면 실패한다는 것을 확인했다.

매니페스트를 파일별로 나눈 목적은 디렉터리를 예쁘게 만드는 일이 아니다. 무엇을 누가 설치하고,
어떤 값이 git에 있어도 되는지, 어떤 값은 배포 시에만 주입해야 하는지를 분명히 하기 위해서다.

## 경로마다 책임과 설치 방법을 표로 고정했다

| 경로 | 책임 | 설치 방법 |
|---|---|---|
| infra/k8s/00-namespaces.yaml | backend, frontend, data, obs 네임스페이스 생성 | kubectl apply |
| infra/k8s/backend | Spring jaywiki, FastAPI payment-api·shipping-api, 파트너 콜백 simulator, HPA, 서비스 제어 RBAC | kubectl apply |
| infra/k8s/frontend | Next.js web Deployment, Service, Ingress | kubectl apply |
| infra/k8s/data | Kafka KRaft StatefulSet, 공개 자산 적재 Job, PostgreSQL·Redis·MinIO·OpenSearch Helm values | kubectl apply와 helm upgrade 혼용 |
| infra/k8s/observability | Prometheus, Grafana, Alertmanager, Loki, Tempo, Promtail, OTel Collector values | helm upgrade |
| infra/k8s/backup | PostgreSQL backup PVC와 일 1회 dump CronJob | kubectl apply |
| infra/opensearch/Dockerfile | nori 형태소 분석기를 넣은 OpenSearch 커스텀 이미지 | GitHub Actions 빌드 |

한 디렉터리에 kubectl apply 대상과 helm values가 섞인 곳은 data뿐이다. Kafka는 관리형 chart를 쓰지 않고
KRaft StatefulSet을 직접 정의했고, 나머지 네 개는 Helm chart에 values만 얹었기 때문이다. 이 차이를 잊으면
data 디렉터리 전체에 kubectl apply를 걸었다가 values 파일에서 실패한다.

## 손으로 만들던 상태는 클린 클러스터에서 재현이 안 됐다

처음에는 data와 obs 네임스페이스를 설치 중에 손으로 만들었다. 처음 설치한 장비에서는 잘 돌아갔지만,
클린 클러스터에서는 Kafka와 backup CronJob이 존재하지 않는 네임스페이스를 참조하게 된다.

PostgreSQL, Redis, MinIO의 Helm values도 miniPC 홈 디렉터리에만 있었던 적이 있다. 그 상태에서는
다른 장비나 새 클러스터에서 같은 설치를 재현할 수 없다. 지금은 values를 infra 아래로 옮기고,
비밀번호는 파일 대신 Helm 설치 시점의 환경 변수로 주입한다.

## Secret 실제 값과 SHA 이미지는 매니페스트에 두지 않는다

| 대상 | 규칙 |
|---|---|
| Secret | 실제 값은 커밋하지 않는다. example 파일과 생성 스크립트만 둔다 |
| Helm values | 비밀번호가 아닌 구조와 리소스 설정만 둔다 |
| Application image | 매니페스트의 local 태그는 자리표시자다 |
| 실제 배포 | CI가 만든 GHCR SHA 이미지를 kubectl set image로 교체한다 |

이 규칙이 없으면 평범한 kubectl apply가 이미 실행 중인 SHA 이미지를 존재하지 않는 local 태그로
되돌릴 수 있다. 배포 경로와 설치 경로를 구분한 이유다.

여기서 나눈 공개·내부 경계가 실제 네트워크에서 어떻게 나타나는지는
[miniPC k3s와 Cloudflare Tunnel 배포 구조](/wiki/minipc-k3s-cloudflare)에서 이어서 볼 수 있다.

## 한 번 성공한 설치는 우연일 수 있다

클린 클러스터에 다시 적용할 수 있는 매니페스트와 Secret 주입 규칙이 있어야 운영 구성이 된다.
