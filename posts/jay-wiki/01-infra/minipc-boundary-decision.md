---
title: "miniPC 한 대를 서비스 경계로 선택한 이유"
slug: minipc-boundary-decision
tab: "인프라"
parentId: infra
sortOrder: 4
kind: wiki
tags: minipc,k3s,architecture,operations
source: scripts/seed-portfolio-wiki.mjs
---
- 왜 클라우드가 아니라 miniPC 한 대인가, 그 대신 무엇을 인정했나?
- 비용 절감이 아니라 배포·네트워크·저장소·재시작을 직접 다루기 위해 단일 노드 k3s를 선택하고, 고가용성 플랫폼이 아니라 운영 판단을 증명하는 실험실로 규정하기로 판단했다.
- 매니페스트의 워크로드가 전부 replicas 1이고 예외는 HPA가 최대 2까지만 늘리는 Spring backend 하나뿐이며, PVC가 모두 k3s local-path에 있어 디스크 장애는 어떤 replica 수로도 못 막는다는 것을 확인했다.

miniPC를 선택한 이유는 클라우드 비용을 줄이기 위해서만은 아니다. 한 대의 장비에 애플리케이션과
상태 저장소를 올리면, 코드 밖에 있던 운영 문제를 피할 수 없게 된다.

## 코드 밖 운영 문제를 직접 다루게 됐다

| 영역 | 실제로 생기는 질문 |
|---|---|
| 배포 | 어떤 이미지가 어떤 SHA로 실행 중인가 |
| 네트워크 | 외부 공개와 내부 Service DNS를 어떻게 나눌 것인가 |
| 저장소 | PVC가 어떤 디스크에 있고, 백업은 어디로 복제되는가 |
| 재시작 | k3s와 systemd 서비스가 재부팅 뒤 돌아오는가 |
| 관측 | 장애를 로그 하나가 아니라 metric, log, trace로 찾을 수 있는가 |

## 왜 k3s인가

Docker Compose만으로도 서비스를 띄울 수 있지만, 이 프로젝트는 Deployment, Service, StatefulSet,
PVC, CronJob, HPA, RBAC 같은 운영 단위를 직접 다루는 것이 목적이다.

| k3s 단위 | jay-wiki에서 확인하는 역할 |
|---|---|
| Deployment | web, Spring, FastAPI의 rollout과 복구 |
| StatefulSet | PostgreSQL, Redis, Kafka의 상태 유지 |
| Service | 브라우저에 드러나지 않는 내부 DNS 경계 |
| PVC | 데이터와 백업 파일의 저장 위치 |
| CronJob | PostgreSQL dump와 보존 정책 |
| HPA | 부하가 생겼을 때 backend replica를 1에서 2로 늘리는 기준 |

## 디스크 장애는 어떤 replica 수로도 못 막는다

매니페스트의 워크로드는 모두 replicas 1로 시작한다. 예외는 Spring backend 하나뿐이고, 그마저도
HPA가 CPU 80% 기준으로 최대 2까지만 늘린다. 같은 노드 안에서 replica가 두 개가 되는 것이므로
이는 가용성 확보가 아니라 부하 분산 리허설에 가깝다. PVC는 전부 k3s local-path에 놓이므로,
node 또는 디스크 자체가 사라지는 사건은 어떤 replica 수로도 막을 수 없다. PostgreSQL dump도 현재는 같은 miniPC 디스크에 있으므로,
실수 복구에는 쓸 수 있어도 디스크 장애 대응은 아니다.

이 한계는 숨기지 않는다. 외부 R2 복제와 외부 저장소 restore rehearsal은 Phase B로 남아 있고,
완료 조건을 만족하기 전에는 운영 완료라고 쓰지 않는다. 이 프로젝트의 가치는 장비 수가 아니라,
장애와 복구의 경계를 실제로 확인하고 기록하는 데 있다.
