---
title: "miniPC를 재부팅해 서비스 복구 시간을 재봤다"
slug: minipc-reboot-recovery-drill
tab: "인프라"
parentId: infra
sortOrder: 2
kind: wiki
tags: minipc,k3s,reboot,recovery,systemd
source: scripts/seed-portfolio-wiki.mjs
---
- 재부팅 뒤 k3s, Tunnel, runner, 상태 저장소와 공개 사이트가 어떤 순서와 시각으로 돌아오나?
- 복구 여부만 확인한 1회차의 빈칸을 2회차에서 실측으로 채우고, cloudflared Restart=always와 spellcrown 종료 저장이 검증된 뒤에야 무인 자동 재부팅을 켜기로 판단했다.
- 2026-08-09 2회차에서 밖에서 2초 간격 폴링으로 공개 경로 다운타임 최대 60초를 쟀고, 재부팅 명령부터 Pod 23개 재기동 완료까지 91초를 확인했다.

단일 노드 운영에서 재부팅은 드문 이벤트가 아니라 복구를 확인하는 가장 단순한 리허설이다.
배포가 한 번 성공했다는 사실만으로는 충분하지 않다. 전원이 꺼졌다가 돌아온 뒤에도 k3s, cloudflared,
GitHub Actions runner, StatefulSet, 공개 경로가 어떤 순서로 회복되는지 두 번의 리허설로 확인했다.

## 리허설 전에 각 계층의 기대 상태를 정해 뒀다

| 대상 | 기대 상태 | 이유 |
|---|---|---|
| k3s | active | 모든 Pod와 Service의 제어면 |
| cloudflared | active | 외부 HTTPS와 SSH 진입점 |
| self-hosted runner | active | 다음 배포 job을 받을 systemd 서비스 |
| PostgreSQL, Redis, Kafka | Ready | 앱이 의존하는 상태 저장소 |
| frontend, backend | Available | 공개 서비스와 BFF 경계 |
| spellcrown | active | 2회차에 추가. k3s 밖에서 도는 유일한 서비스이고 진행 중인 대국을 들고 있다 |

## 안쪽 계층부터 좁히고 공개 경로는 마지막에 본다

1. miniPC를 재부팅한다.
2. SSH가 다시 연결되는지 확인한다.
3. k3s node가 Ready로 돌아오는지 본다.
4. PostgreSQL, Redis, Kafka StatefulSet과 backend, frontend Deployment의 rollout 상태를 확인한다.
5. cloudflared와 runner systemd 서비스가 active인지 확인한다.
6. 공개 홈과 backend 경유 API가 HTTP 200으로 응답하는지 확인한다.

이 순서를 지킨 이유가 있다. 공개 URL부터 확인하면 Tunnel, Ingress, web, BFF, backend 중 어느 계층이 문제인지
알 수 없다. node와 Pod를 먼저 좁히고, 마지막에 공개 경로를 확인해야 복구 지점이 분명해진다.

## 1회차 (2026-07-07) — 복구 여부만 확인했다

2026-07-07 기준 진행 기록에 남긴 계획 재부팅 결과다. 운영자 터미널에서 SSH로 sudo reboot를 실행했고,
SSH가 다시 붙은 시점의 uptime은 약 7분이었다.

| 확인 대상 | 관찰한 값 |
|---|---|
| k3s node | Ready |
| Spring jaywiki Deployment | 2/2 available |
| Next.js jaywiki-web Deployment | 1/1 available |
| PostgreSQL, Redis, Kafka StatefulSet | rollout 정상 완료 |
| backend, frontend Service endpoint | 정상 |
| cloudflared, self-hosted runner systemd | active |
| 공개 홈 | HTTP 200 |

backend가 1이 아니라 2/2인 것은 HPA가 이미 확장한 상태에서 재부팅했기 때문이다. 즉 이 리허설은
replica가 늘어난 상태도 자동으로 복원된다는 것까지 함께 보여준다.

여기서 확인하지 못한 것도 분명하다. **uptime 7분은 "7분 안에 복구됐다"는 뜻이 아니라 내가 확인한 시점일 뿐이다.**
각 systemd 서비스와 Pod가 몇 초에 준비됐는지, 공개 경로가 언제부터 200을 돌려줬는지는 기록하지 않았다.
**1회차는 복구 여부만 주장하고 복구 시간은 주장하지 않는다** — 그 빈칸을 2회차에서 채웠다.
실행한 명령은 miniPC 운영 명령어 모음에 정리해 뒀다.

이 결과는 고가용성을 뜻하지 않는다. 단일 노드의 디스크나 하드웨어가 고장 나면 같은 노드 안의 PVC도
같이 사라질 수 있다. 이 리허설은 운영체제 재시작과 프로세스 복구를 확인한 것이고, 디스크 장애 복구는
외부 백업 Phase B가 끝난 뒤 따로 검증할 항목으로 남겨 뒀다.

## 2회차 (2026-08-09) — 빈칸을 채웠다

1회차가 남기지 못한 것이 회복 시각이었다. 2회차의 목적은 그 하나였고, 방법을 바꿔서 얻었다.

**밖에서 2초 간격으로 폴링하면서 재부팅했다.** 사용자가 겪는 다운타임은 기계 안에서는 안 보인다.

| 대상 | 마지막 200 | 첫 복귀 200 | 다운타임 |
|---|---|---|---|
| portfolio.leneu.cloud | 23:31:31 | 23:32:31 | 60초 |
| blog.leneu.cloud | 23:31:31 | 23:32:30 | 59초 |
| spellcrown.leneu.cloud | 23:31:32 | 23:32:00 | 28초 |

**응답 코드가 계층을 그대로 그린다.** 셋 다 530(터널 down)으로 시작하고, k3s를 거치는 둘만
502(터널 복귀, Traefik 아직) → 503(Traefik 복귀, Pod 아직) → 200으로 올라왔다.
spellcrown은 k3s 밖에서 돌아 530에서 바로 200이 됐고 그래서 절반이다.

계층별 준비 시각은 이렇다. 재부팅 명령이 23:31:34, 커널 부팅이 23:31:48이었다.

| 계층 | 시각 |
|---|---|
| spellcrown | 23:31:53 |
| self-hosted runner | 23:32:00 |
| cloudflared | 23:32:01 |
| k3s | 23:32:08 |
| Pod 첫 Ready | 23:32:12 |
| Pod 마지막 Ready | 23:33:05 |

Pod 28개 중 23개가 재기동했고 마지막은 OpenSearch master였다. 명령부터 완전 수렴까지 91초다.
**회복하지 못한 것은 없었고 수동 조치도 없었다.**

### 시각은 사후에 캐낼 수 있다

2회차에서 방법이 하나 바뀌었다. 1회차는 사람이 다시 붙는 시점에 한 번 훑었고, 그때는 이미 전부
Ready라 시각이 안 남았다. 그런데 systemd는 ActiveEnterTimestamp를, Pod는 Ready 조건의
lastTransitionTime을 들고 있다. **몇 시간 뒤에 물어봐도 답한다.** 재부팅 순간에 사람이 매여 있을
필요가 없다는 뜻이다.

다만 node는 예외였다. 노드의 Ready lastTransitionTime은 재부팅 뒤에도 6주 전 값 그대로다.
NotReady로 넘어가기 전에 돌아오기 때문이다. **node 회복 시각은 Pod Ready의 최솟값으로 대신한다.**

### 이번에 처음 확인된 것 둘

| 대상 | 결과 |
|---|---|
| cloudflared의 Restart=always | 재부팅을 견뎠다. SIGHUP 사고 뒤 붙인 drop-in이 실제 재부팅에서 검증된 것은 이번이 처음이다 |
| spellcrown의 SIGTERM 저장 | .rooms.json의 mtime이 재부팅 명령 시각과 같았다. 종료 경로가 실제로 돈다 |

이 둘이 통과했기 때문에 **무인 자동 재부팅을 켰다.** unattended-upgrades의 Automatic-Reboot을
04:00으로 두고, reboot-required가 생긴 날에만 돈다. 순서가 중요했다 — 먼저 켰으면 spellcrown의
첫 재부팅을 아무도 보지 못한 채 새벽에 지나갔을 것이다.

## 남은 것 — 체감 다운타임과 restore drill은 못 쟀다

- 첫 200 뒤에도 20초쯤 응답이 느리다. 다운타임을 "첫 200"으로 세면 체감보다 짧게 잡힌다
- 사설망 SSH 재연결 시각은 2회차에서도 못 쟀다. 폴링이 끊김을 기다리지 않고 켜는 순간 찍혔다
- R2 외부 복제 뒤의 restore drill
