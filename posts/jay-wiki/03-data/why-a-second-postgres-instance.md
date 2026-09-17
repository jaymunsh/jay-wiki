---
title: "postgres 인스턴스를 하나 더 세운 근거는 NetworkPolicy 하나뿐이었다"
slug: why-a-second-postgres-instance
tab: "데이터"
parentId: data
sortOrder: 8
kind: adr
tags: postgresql,msa,kubernetes,networkpolicy,backup
source: scripts/seed-portfolio-wiki.mjs
---
- 실무 다수가 단일 DB + 스키마 분리로 가는데, 왜 여기서는 postgres 인스턴스를 하나 더 세웠나?
- 성립하는 근거는 NetworkPolicy 하나뿐이고, 흔히 드는 "다른 노드로 옮길 수 있다"는 miniPC 에서는 거짓이라고 판단했다.
- 배포 후 운영에서 모놀리스 → pg-services:5432 가 Connection refused 로 막히고, 대조군인 pg-postgresql 로는 통과하는 것을 확인했다 (k3s v1.36.2).

결제와 배송을 모놀리스에서 떼면서 데이터를 어디에 둘지 정해야 했다. 결론부터 적으면,
portfolio 를 드는 기존 postgres 옆에 pg-services 라는 두 번째 인스턴스를 세우고
payment 와 shipping 두 DB 를 그 안에 넣었다. 이 글은 그 결정이 왜 실무의 다수 관행과
다른지, 그런데도 왜 그렇게 했는지를 적는다.

## 실무 다수가 스키마 분리로 가는 이유는 옳다

DB 인스턴스를 나누면 백업·모니터링·버전 업그레이드가 전부 N배가 된다. 백업 스크립트가
인스턴스 수만큼 늘고, 모니터링 대상이 늘고, 메이저 업그레이드를 인스턴스마다 따로 치러야
한다. 그 비용을 감당할 이유가 생기기 전에는 단일 인스턴스에 스키마나 DB 로만 나누는 것이
맞고, 실무 다수가 그렇게 하는 판단은 옳다. 이 글은 그 판단을 반박하려는 글이 아니다.

그리고 인스턴스 분리를 정당화할 때 흔히 드는 근거 하나는 **이 환경에서 성립하지 않는다.**
"인스턴스가 따로면 나중에 다른 노드로 옮길 수 있다" — miniPC 는 노드가 하나다
(/wiki/minipc-boundary-decision). postgres 를 둘로 띄워도 같은 커널, 같은 디스크,
같은 전원이다. 한쪽 디스크가 죽으면 둘 다 죽는다. 이걸 근거로 쓰면 거짓말이라
설계 문서에도 근거로 쓰지 않는다고 못 박았다.

## 후보는 셋이었고 둘을 기각했다

### 후보 1 — 단일 인스턴스 + 스키마(또는 DB) 분리

비용이 가장 싸다. 백업도 모니터링도 그대로다. 기각한 이유는 하나다 —
**소유권 강제가 계정 권한 한 겹으로 줄어든다.** NetworkPolicy 의 podSelector 는
파드 라벨을 본다. 모놀리스와 서비스가 같은 postgres 파드에 붙으면 네트워크 층에서
구분할 대상이 없다. 그러면 "모놀리스가 결제 데이터를 직접 읽으면 안 된다"는 이
설계의 주제를 보여줄 증거가 "그렇게 안 썼습니다"뿐이 된다.

지금 클러스터의 DB 는 ClusterIP 라 외부에는 안 열려 있지만, 클러스터 안에서는
아무 파드나 붙을 수 있다. 모놀리스가 결제 DB 에 TCP 로 닿는 것을 막는 층이
스키마 분리에는 없다.

### 후보 2 — pg-payment 와 pg-shipping 을 따로 띄운다

처음 계획이 이쪽이었다. 다시 따져 보니 둘로 나눠서 얻는 것이 한 칸뿐이었다.

| 누가 → 어디로 | 인스턴스 둘 | pg-services 하나 |
|---|---|---|
| 모놀리스 → 결제·배송 DB | 네트워크 차단 | 네트워크 차단 (그대로) |
| payment-api → 배송 데이터 | 네트워크 차단 | 계정 권한만 |
| shipping-api → 결제 데이터 | 네트워크 차단 | 계정 권한만 |

이 설계의 주제인 모놀리스 차단은 하나로 묶어도 그대로 선다. 빠지는 것은
payment ↔ shipping 사이 한 칸인데, 그 둘은 서로 조인할 일이 없다. 그 한 칸 값으로
pod 하나와 백업 대상 하나가 는다 — 백업은 이 설계가 리스크로 꼽은 자리다.

되돌리는 방향도 하나로 합치는 쪽이 맞다. pg-services 를 나중에 둘로 쪼개는 것은
쉽다 — pg_dump 하나와 커넥션 문자열이고, 둘이 조인하지 않으니 엉킬 것이 없다.
반대로 스키마 분리를 나중에 인스턴스로 쪼개는 것은 어렵다 — 그때는 이미 서비스들이
같은 커넥션으로 조인하고 있다. **되돌리기 쉬운 결정을 나중으로 미루고, 되돌리기
어려운 결정만 지금 했다.**

## 결정 — 인스턴스는 둘, 신규는 하나, 강제는 두 겹

~~~mermaid
flowchart TB
  subgraph backend 네임스페이스
    MONO[모놀리스 Spring]
    PAY[payment-api]
    SHIP[shipping-api]
  end
  subgraph data 네임스페이스
    PG[(pg-postgresql - portfolio DB)]
    SVC[(pg-services - payment DB + shipping DB)]
    BK[백업 CronJob]
  end
  MONO --> PG
  PAY --> SVC
  SHIP --> SVC
  BK --> PG
  BK --> SVC
  MONO -. NetworkPolicy 거부 .-> SVC
~~~

실물은 infra/k8s/data/pg-services.yaml 하나에 다 있다 (/wiki/k3s-manifest-boundaries).
StatefulSet 하나(postgres:18-alpine, replicas 1), Service 둘, 그리고 NetworkPolicy
pg-services-allow-owners. 정책이 pg-services 파드를 고르는 순간 명시된 것 말고는
전부 거부다 — 허용 목록은 payment-api, shipping-api, 그리고 백업 파드
(app: jaywiki-postgres-backup 라벨) 셋뿐이다. 백업 파드를 빠뜨리면 백업이
조용히 끊기기 때문에 정책에 처음부터 넣었다.

서비스끼리는 계정으로 가른다. payment_svc 는 shipping DB 에 CONNECT 가 없고
반대도 같다. 알맹이는 두 줄이다 — revoke connect on database shipping from public
을 하고 나서 grant connect 를 소유 계정에만 준다. PUBLIC 은 기본으로 아무 DB 에나
CONNECT 를 가지므로, revoke 를 빼면 나눈 것이 이름뿐이 된다.

한 가지 함정도 실물에 적혀 있다. **initdb 스크립트는 데이터 디렉터리가 빈 첫
기동에만 돈다.** 이미 뜬 운영 인스턴스에 shipping DB 를 추가할 때는 ConfigMap 을
고쳐도 안 돈다. 그래서 배포 전에 사람이 kubectl exec 로 psql 을 직접 실행해 만들어야 하고,
그 절차는 배포 런북에 있다. 저장소의 ConfigMap 은 클린 클러스터 재현용 기록으로 남긴다.

## 결과 — 차단은 확인됐고, 백업 대상은 셋이 됐다

배포 후 운영에서 확인한 것 (2026-08-17, k3s v1.36.2).

| 어디서 → 어디로 | 결과 |
|---|---|
| 모놀리스 → pg-services:5432 | 거부 (Connection refused) |
| 모놀리스 → pg-postgresql:5432 (대조군) | 통과 |
| payment-api → pg-services:5432 | 통과 |
| 백업 CronJob → pg-services | 통과 |

대조군을 같이 잰 이유가 있다. 거부만 보면 "서비스가 죽어서 난 거부"와 구분이 안 된다.
payment-api 는 붙는데 모놀리스만 막히므로, 막는 주체가 정책이라는 것이 이 세 줄로
갈린다. 차단은 타임아웃이 아니라 Connection refused 로 난다 — k3s 에 내장된
kube-router 가 REJECT 한다. 설계에 적어 둔 후퇴 경로(정책이 안 먹으면 계정 분리
한 겹으로 물러선다)는 쓰지 않았다.

치른 비용도 그대로 적는다. **백업 대상이 하나에서 셋이 됐다.** CronJob 은 dump 호출
셋으로 portfolio, payment, shipping 을 각각 뜨고, set -e 라 하나가 실패하면 Job 이
실패로 뜬다 — 그게 알림이다 (/wiki/postgres-backup-restore). 맥으로 받아 두는
pull-prod-backup.sh 도 같은 셋을 받고 pg_restore -l 로 구조까지 검증한다.
데이터가 인스턴스로 갈리는 순간 백업이 한쪽만 뜨고 아무 알림도 안 나는 상태가
이 결정이 만든 새 실패 모드였고, 그래서 인스턴스를 세운 날 백업 확장도 같이 넣었다(f5d574e 로 세우고 405a6b0 으로 백업을 늘렸다).

테이블이 어디로 갔는지는 /wiki/db-schema-erd-map 에 있다. 모놀리스에는 결제·배송의
원본 대신 이벤트로 채우는 프로젝션 사본만 남았다.

## 되돌리는 법 — 세 방향 모두 경로가 있다

세 방향 모두 경로가 있다.

- **스키마 분리로 돌아간다** — payment·shipping 을 pg_dump 로 떠서 기존 인스턴스에
  DB 로 넣고 커넥션 문자열을 바꾼다. NetworkPolicy 한 겹을 잃고 백업 대상이 하나로
  줄어든다. 이 설계의 주제를 포기하는 것이라 지금은 안 한다
- **인스턴스 둘로 쪼갠다** — pg_dump 하나와 커넥션 문자열. 둘이 조인하지 않으니
  엉킬 것이 없다. payment ↔ shipping 사이 네트워크 차단이 필요해지는 날 한다
- **정책이 안 먹는 환경으로 옮긴다** — 계정 분리 한 겹은 그대로 남으므로 설계의
  나머지는 선다. 증거의 강도만 내려간다

## 남은 한계 — 이 분리는 장애 격리가 아니다

- 노드가 하나라 이 분리는 장애 격리가 아니다. 같은 디스크, 같은 전원이고, 디스크가
  죽으면 세 DB 가 같이 죽는다. 이 분리가 사는 것은 소유권 경계와 그 증명뿐이다
- 백업 셋은 같은 miniPC PVC 에 남는다. 밖으로 옮기는 것은 pull-prod-backup.sh 를
  사람이 돌려야 한다
- NetworkPolicy 는 k3s 가 kube-router 정책 컨트롤러를 켠 상태에 기대고 있다.
  --disable-network-policy 로 끈 클러스터에서는 이 한 겹이 통째로 사라진다
- payment ↔ shipping 사이는 계정 권한 한 겹뿐이다. 한 칸을 미룬 대가는 그대로 남아 있다
