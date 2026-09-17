---
title: "기준 콘텐츠를 운영 DB와 rollout까지 맞춘 기록"
slug: production-content-sync-and-rollout
tab: "운영 검증"
parentId: verification
sortOrder: 4
kind: wiki
tags: production,seed,rollout,postgresql,smoke
source: scripts/seed-portfolio-wiki.mjs
---
- 2026-07-11 commit 0e3cd19 시점에 기준 콘텐츠 10개 탭 28편을 운영 DB·rollout과 맞춘 절차의 기록이다.
- 콘텐츠 반영은 이미지 배포와 수명 주기가 다르므로 backup, dry-run, 쓰기, 재-dry-run, rollout, public smoke 순서를 사람이 손으로 고정해 돌렸다.
- 당시 최종 dry-run이 0 tab changes, 0 article changes, 17 extras를 반환해 일치를 확인했다.

위키의 본문 SoT는 PostgreSQL이다. seed 파일을 수정했다고 운영 화면이 바로 바뀌는 구조가 아니므로,
콘텐츠 반영과 application rollout을 별도 단계로 다뤘다.

## 2026-07-11에 commit 0e3cd19 기준으로 실행했다

| 항목 | 값 |
|---|---|
| 실행일 | 2026-07-11 |
| 대상 | miniPC 운영 k3s와 운영 PostgreSQL |
| 배포 기준 | main의 commit 0e3cd19 |
| 반영 범위 | 당시 기준 콘텐츠 10개 탭 28편 |

## backup부터 smoke까지 순서를 손으로 고정해 돌렸다

1. miniPC PostgreSQL 수동 backup Job을 실행해 dump와 sha256 파일을 만들었다.
2. 운영 BFF 대상으로 dry-run을 실행해 탭·글 변경과 기존 문서를 확인했다.
3. 기준 10개 탭과 28편을 명시적으로 upsert했다.
4. GitHub Actions workflow가 만든 GHCR SHA 이미지로 backend, payment-api, web rollout을 확인했다.
   jaywiki는 2/2, jaywiki-payment-api와 jaywiki-web은 각각 1/1 Ready였다.
5. 공개 home, 위키 딥링크, 게시판 BFF, 채팅 상태 BFF를 HTTP smoke로 확인했다.

## 결과 — 최종 dry-run이 0 변경, 17 extras를 반환했다

새 backend rollout 뒤 같은 seed를 다시 실행했을 때 최종 dry-run은
0 tab changes, 0 article changes, 17 extras를 반환했다. 즉 기준 콘텐츠는 운영 DB와 일치한다.

중간에 한 번 더 시드를 실행해야 했다. 기존 backend image가 일부 문서의 sortOrder를 0으로 저장한 흔적이
있었고, 새 backend가 Ready가 된 뒤에야 정렬 필드까지 기준과 맞았기 때문이다.

운영 DB에는 이전 문서 17편이 별도로 남아 있다. seed는 DB에만 있는 문서를 자동 삭제하지 않는 정책이므로,
이 항목은 동기화 실패가 아니라 보존 정책의 결과다.

## 콘텐츠 반영은 이미지 배포와 수명 주기가 다르다

이미지 SHA가 같아도 DB 본문은 다를 수 있고, DB 본문이 같아도 이전 backend가 정렬 필드를
다르게 저장할 수 있다. 위의 실행 순서를 고정한 이유다.

## 미뤄 둔 17편은 그 뒤에 처리됐다

기존 17편의 처리를 이 글은 미뤄 뒀는데, 그 뒤에 끝났다.

- 예전 서술 ~~기존 17편을 삭제하거나 통합하는 결정은 아직 하지 않았다~~
  - 2026-08-13 정정: 처리됐다. 2026-08-10 commit 0fddf7c가 운영에만 있던 17편을
    posts/archive/로 내렸고(파일 17개 실측), 같은 날 7ce177c가
    scripts/delete-wiki-articles.mjs 를 추가했다.

스크립트는 SQL이 아니라 관리자 API로 지운다 — ArticleService.delete가 OpenSearch 색인 정리
이벤트를 발행하기 때문이다. 856ff53이 추가한 scripts/check-wiki-consistency.mjs 는 운영에만 있는 글을
유령 글로 잡아 비영 종료한다 — 17 extras는 이제 보고 대상이 아니라 실패다. 다만 이 검사는 deploy.yml에도
ci.yml에도 없어 사람이 돌려야 한다.

## 이 절차는 그 뒤 파이프라인으로 넘어갔다

2026-07-22 commit bdece27부터 deploy.yml이 이미지 rollout 뒤에 PostgreSQL backup, 콘텐츠 sync,
공개 smoke를 순서대로 돌린다. develop → main 머지 하나로 끝나고, 대상도 계속 커져 2026-08-19 기준 11탭 82편이다.

순서는 이 글과 반대다. 지금은 이미지 rollout이 먼저고 콘텐츠 sync가 나중이다. 이 글에서 시드를 한 번 더 돌리게 만든 문제 — 구 backend가
정렬 필드를 다르게 저장한 것 — 자체가 이 순서로 사라졌다.

dry-run도 운영 반영 경로에서 빠졌다. 클러스터 안 Job은 시드를 --allow-remote-write 로 한 번 실행할
뿐이고 재-dry-run 단계가 없다. 시드가 멱등이라 변경이 없으면 Already in sync로 끝난다.
dry-run은 집필 절차에만 남았다. 인증도 당시의 관리자 로그인 + TOTP에서
X-Content-Sync-Token 기계 토큰으로 바뀌었다.
