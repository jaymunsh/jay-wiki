---
title: "배포 한 판을 run 번호부터 공개 smoke 까지 한 글에 적었다"
slug: release-record-one-run
tab: "운영 검증"
parentId: verification
sortOrder: 2
kind: wiki
tags: deploy,release,rollout,cicd,verification
source: scripts/seed-portfolio-wiki.mjs
---
- 「배포는 머지 한 번이면 끝난다」고 여러 글에 적어 두고, 정작 그 한 번이 실제로 무엇을 얼마나 하는지 숫자로 남긴 글이 없었다.
- 파이프라인 시간이 문서마다 다르게 적혀 있던 것도 여기서 정리한다 — 상한(timeout)과 실제 소요는 다른 값이다.
- 2026-08-19 run 32220470022 을 통째로 받아 적었다. 16분 42초, 이미지 여섯, rollout 70초, 위키 22편 반영, 공개 smoke 아홉.

## 무엇을 한 판으로 세는가

머지 하나가 run 하나를 만들고, 그 run 이 끝나면 배포가 끝난다. 그래서 「한 판」은 run 번호로 셀 수 있다.

| | |
|---|---|
| run | 32220470022 |
| 커밋 | 11fbdf6f (develop → main 머지, 13 커밋) |
| 시작 | 2026-08-19 05:43:03 UTC |
| 종료 | 2026-08-19 05:59:45 UTC |
| 걸린 시간 | **16분 42초** |

## 문서의 75분은 상한이고 실제 소요는 16~17분이다

잡 셋이 직렬이다. 앞이 실패하면 뒤가 안 돈다.

| 잡 | 걸린 시간 | 무엇 |
|---|---|---|
| Verify application | 417초 | Spring 테스트, web 의 타입 검사·lint·테스트 |
| Build and push images | 352초 | 이미지 여섯을 만들어 GHCR 로 올린다 |
| Deploy to miniPC k3s | 222초 | 매니페스트 적용, 이미지 교체, 백업, 콘텐츠 시드, smoke |

**문서에 「75분」으로 적혀 있던 값은 각 잡의 timeout 상한이었다.** 실제 성공 판은 16~17분이다
(직전 두 판도 17분, 16분). 상한을 소요 시간으로 옮겨 적으면 그 뒤로 계속 틀린 값이 돈다.

## 여섯을 빌드하고 다섯이 같은 SHA 로 바뀐다

**빌드는 여섯이고 SHA 태그로 갈리는 Deployment 는 다섯이다.** OpenSearch nori 는 이미지로만 올라가고
Deployment 교체 대상이 아니다. 태그는 커밋 SHA 전체다. latest 를 쓰지 않는 이유는 [배포 규칙](/wiki/deploy-rules-and-harness)에 적었다.

~~~
ghcr.io/jaymunsh/jay-wiki-backend:11fbdf6f...
ghcr.io/jaymunsh/jay-wiki-web:11fbdf6f...
ghcr.io/jaymunsh/jay-wiki-payment-api:11fbdf6f...
ghcr.io/jaymunsh/jay-wiki-shipping-api:11fbdf6f...
ghcr.io/jaymunsh/jay-wiki-partner-simulator:11fbdf6f...
~~~

배포 뒤 클러스터에 물어서 다섯 Deployment 가 전부 이 태그인 것을 확인했다. 로그를 믿지 않고
실물을 본다 — 로그는 「보냈다」까지만 말한다.

## rollout 은 70초에 끝났다

이미지를 바꾸면 [RollingUpdate](/wiki/zero-downtime-on-one-machine)가 파드를 하나씩 굴린다.
kubectl 이 각 Deployment 를 지켜보다가 다 끝나면 다음으로 넘어간다.

| 시각(UTC) | |
|---|---|
| 05:57:50 | 교체 시작. payment-api 의 옛 파드가 종료 대기로 들어간다 |
| 05:58:22 | payment-api · shipping-api · partner-simulator 완료 |
| 05:58:59 | 백엔드(jaywiki) 완료 |
| 05:59:00 | web 완료 |

백엔드가 가장 오래 걸린다. 기동이 느린 쪽이라 readinessProbe 가 통과할 때까지 옛 파드가 안 내려간다.
**그 사이 두 파드가 함께 살아 있고, 요청은 준비된 쪽으로만 간다.**

## 콘텐츠와 백업은 이 판에 같이 실린다

배포 잡은 이미지만 바꾸지 않는다.

- 콘텐츠를 덮기 **직전에** PostgreSQL 백업 Job 을 하나 더 만든다
- 05:59:20 에 위키 시드가 돌아 **22편**이 갱신됐다(탭 변경 0). 이 판에 위키 글을 함께 실었기 때문이다
- MinIO 로 로고와 벤치마크 발행물을 다시 올린다

## 공개 smoke 아홉은 바깥에서 공개 주소를 그대로 친다

마지막은 바깥에서 친다. 클러스터 안에서 도는 확인이 아니라 공개 주소를 그대로 부른다.

- 일곱: 첫 화면, 채팅, 게시판 BFF, 채팅 상태, Saga 배송 실패 시나리오, Kafka 데모, 파트너 API 시나리오
- 둘: /sync 와 /api/sync 가 **404 인지** 확인한다. 이 둘은 로컬 전용 글 반영판이라 운영에서 열려 있으면
  인증 없이 글을 쓰는 문이 된다. 막혀 있다는 사실 자체를 배포마다 확인하는 것이다

## 파이프라인이 안 하는 확인을 사람이 한다

여기까지가 자동이고, 아래는 배포가 끝난 뒤 사람이 했다.

| 확인 | 결과 |
|---|---|
| 알림 규칙 로드 | 15개. 이번에 추가·수정한 셋이 다 있다 |
| 고아 사가 게이지 | jaywiki_saga_orphaned 0.0 노출 |
| 사가 한 건 **새로** 실행 | CONFIRMED, 다섯 단계 전부 성공, 재고 100 → 99 |
| 백업 사본을 개발 장비로 | dump 셋(portfolio 187 항목, payment 13, shipping 13)과 자산 tar |

**사가는 배포 완료(05:59:45) 이후에 새로 만든 것으로 확인했다.** 조회로 보이는 기존 행은
배포 전 버전이 만든 것일 수 있어서 검증이 안 된다. 직전 배포에서 실제로 그렇게 틀렸다.

## 한계 — 성공한 한 판이고 무중단은 수치로 안 쟀다

- 이 글은 성공한 한 판이다. 실패한 판의 기록은 [자동 복구가 실제로 탄 날](/wiki/never-exercised-code)에 따로 있다
- 무중단을 수치로 재지 않았다. rollout 중 공개 주소가 응답한 것은 봤지만, 1초 간격으로 때려
  실패 건수를 센 측정은 여전히 없다
- 배포 알림(텔레그램) 도착은 이 기록에 안 넣었다. Actions 로그까지만 봤다
