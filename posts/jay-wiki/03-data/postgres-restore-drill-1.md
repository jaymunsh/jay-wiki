---
title: "백업 파일이 아니라 복원 결과를 확인하는 방법"
slug: postgres-restore-drill-1
tab: "데이터"
parentId: data
sortOrder: 1
kind: wiki
tags: postgres,backup,restore,cronjob,pvc
source: scripts/seed-portfolio-wiki.mjs
---
- 백업 파일이 생겼다는 것과 복원된다는 것이 왜 다른가?
- dump 존재 확인에서 멈추지 않고 sha256 검증, 임시 DB pg_restore, 원본과의 row count 비교까지를 스크립트 하나로 자동화하기로 판단했다.
- scripts/rehearse-postgres-restore.sh가 최신 dump를 임시 DB에 복원해 tb_article·tb_revision·tb_post row count를 원본과 비교하며, 초기에는 client와 server의 major version 불일치로 백업이 실패해 둘 다 postgres 18로 맞췄다.

백업 파일이 생겼다고 복구 가능성이 증명되지는 않는다. 파일이 깨졌을 수도 있고, client와 server의 버전이
맞지 않을 수도 있으며, 실제로 복원하면 필요한 테이블이 비어 있을 수도 있다.

## 현재 백업은 같은 디스크에 매일 쌓인다

PostgreSQL backup CronJob은 매일 custom format dump와 sha256 파일을 백업 PVC에 만든다. 오래된 dump는
7일 뒤 지운다. 백업 PVC는 현재 miniPC의 같은 디스크에 있으므로 실수 복구에는 도움이 되지만,
디스크 장애까지 막지는 못한다.

## drill은 원본에 쓰지 않고 임시 DB에 복원한다

scripts/rehearse-postgres-restore.sh는 원본 DB에 쓰지 않는다. 별도 Pod와 임시 DB를 만들고 아래 순서를
자동화한다.

1. backup Secret에서 DB 비밀번호를 읽는다.
2. backup PVC를 read only로 마운트한 postgres client Pod를 만든다.
3. 가장 최신 dump와 sha256 파일을 찾는다.
4. sha256을 검증하고 dump 목차를 확인한다.
5. timestamp가 붙은 임시 DB에 pg_restore를 실행한다.
6. 원본과 복원본의 tb_article, tb_revision, tb_post row count를 비교한다.
7. 임시 DB와 Pod를 지운다. 중간 단계가 실패해도 EXIT cleanup이 임시 DB 삭제를 다시 시도한다.

## 왜 row count를 비교하는가

pg_restore가 exit code 0으로 끝나도, 포트폴리오에서 중요한 위키 본문, revision, 게시판 데이터가
정말 복원됐는지는 별도로 확인한다. row count는 완전한 데이터 무결성 검사는 아니지만,
빈 복원이나 잘못된 대상 DB를 빠르게 잡는 최소 기준이다.

## 처음에는 client 버전 불일치로 막혔다

초기 backup은 PostgreSQL client와 서버 major version이 맞지 않아 실패했다. 현재 CronJob과 drill Pod는
postgres 18 alpine client를 사용하고, 로컬 개발 PostgreSQL도 18로 올려 운영 환경과의 차이를 줄였다.

## 외부 저장소 복원은 아직 하지 않았다

이 drill은 같은 miniPC 디스크 안의 dump로 복원한다. Cloudflare R2 같은 외부 저장소에서 내려받아
복원하는 Phase B drill은 아직 완료되지 않았다. 외부 복제와 restore가 성공하기 전에는 재해 복구가
완성됐다고 말하지 않는다.
