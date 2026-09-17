---
title: "관리자·사용자·서비스 계정과 Secret의 권한을 나눈 방법"
slug: account-secret-least-privilege-boundary
tab: "보안"
parentId: security
sortOrder: 1
kind: adr
tags: security,secrets,least-privilege,totp,kubernetes,service-account
source: scripts/seed-portfolio-wiki.mjs
---
- 관리자·가입 사용자·애플리케이션·배포 Job이 자격 증명을 공유하지 않도록 권한을 어떻게 나눴나?
- 계정 이름보다 먼저 누가 무엇을 어디까지 할 수 있는가로 주체를 나눴고, 허용 범위가 비어 있던 구글 OAuth USER는 주체 자체를 없앴다.
- 인증 주체 여섯을 인증 방식·허용 범위·명시적으로 허용하지 않는 것까지 표로 식별했고, 회전 완료 기준은 patch 성공이 아니라 이전 값이 더는 작동하지 않는지 확인하는 절차로 정했다.

jay-wiki에는 웹사이트 관리자만 있는 것이 아니다. 아이디로 가입한 방문자, PostgreSQL과 MinIO에 연결하는 애플리케이션,
이미지를 받는 Pod, 배포를 수행하는 runner와 기준 문서를 동기화하는 Job도 각자의 자격 증명을 사용한다.

하나의 비밀번호를 여러 곳에서 공유하면 설정은 단순해 보인다. 하지만 하나가 노출됐을 때 영향 범위를 알 수 없고,
회전할 때 어떤 서비스가 중단될지도 예측하기 어렵다. 그래서 계정 이름보다 먼저 **누가, 무엇을, 어디까지 할 수 있는가**를 나눴다.

## 인증 주체 여섯을 허용 범위로 갈랐다

| 주체 | 인증 방식 | 허용 범위 | 명시적으로 허용하지 않는 것 |
|---|---|---|---|
| 로컬 ADMIN | 비밀번호, 운영에서는 TOTP 추가 | 위키 편집·revision·관리자 기능 | 가입 계정에서 자동 승격 |
| 가입 USER | 아이디·비밀번호와 사이트 JWT | 게시판 작성자 이름 표시 | 관리자 편집·서비스 제어 |
| Spring 애플리케이션 | Kubernetes Secret | PostgreSQL·MinIO 등 필요한 backend 연결 | root 콘솔 계정 재사용 |
| GitOps content sync Job | 별도 machine token | tab·article upsert | 관리자 세션, 삭제·되돌리기·계정 관리 |
| GHCR image pull | namespace imagePullSecret | 배포 이미지 읽기 | GitHub 계정 전체 권한 |
| 관측·외부 연동 | 목적별 token | 알림·관측 도구별 기능 | 다른 서비스 token과 재사용 |

로그인에 성공했다는 사실과 관리자 권한은 별개다. 가입 계정은 신원을 구별할 뿐 ADMIN으로 승격하지 않는다.
반대로 내부 Job은 사람처럼 로그인하지 않으며, 맡은 API 두 개보다 넓은 권한을 받지 않는다.

한때 구글 OAuth USER도 이 표에 있었다. 2026년 8월 6일에 제거했는데, 이유가 이 글의 주제와 닿아 있다.
그 주체가 받아 가는 것(이메일과 구글 계정 식별자)에 비해 허용 범위가 비어 있었다.
**최소 권한은 권한을 좁히는 일만이 아니라, 권한이 없는 주체를 아예 만들지 않는 일이기도 하다.**

## Secret은 필요한 Pod와 단계에만 주입한다

~~~mermaid
flowchart TD
  Human[운영자] -->|비밀번호 + 현재 TOTP| Admin[ADMIN 세션]
  Visitor[방문자] -->|아이디 + 비밀번호| User[USER 세션]
  KSecret[Kubernetes Secret] --> Spring[Spring Pod]
  KSecret --> Sync[content sync Job]
  Pull[GHCR pull Secret] --> Kubelet[kubelet image pull]
  Admin --> AdminAPI[관리자 API]
  User --> UserAPI[사용자 API]
  Sync --> Internal[제한된 internal upsert]
  Spring --> Data[(PostgreSQL / MinIO)]
~~~

브라우저에는 DB, MinIO와 machine token을 전달하지 않는다. Kubernetes Secret은 필요한 Pod의 환경변수나 image pull 단계에만
주입한다. GitHub Actions 로그와 AI 대화에는 값이 아니라 Secret 이름과 사용 목적만 남긴다.

## 저장 위치를 목적에 맞게 나눴다

| 저장 위치 | 사용하는 값 | 이유 |
|---|---|---|
| PostgreSQL | 사용자 식별자, role, BCrypt password hash | 애플리케이션 계정 상태의 원본 |
| Kubernetes Secret | 운영 DB·MinIO·machine credential | Pod에 필요한 운영 설정 주입 |
| macOS Keychain | 수동 운영용 관리자 비밀번호 | 로컬 파일과 대화에 평문을 남기지 않음 |
| Google Authenticator | TOTP seed | 관리자 비밀번호와 두 번째 요소 분리 |
| GitHub Actions Secret | registry 배포에 필요한 값 | workflow 파일과 로그에서 값 분리 |

Kubernetes Secret은 암호 관리의 끝이 아니다. base64는 암호화가 아니며, kubeconfig와 namespace Secret 조회 권한을 가진 주체는
강한 운영 권한을 가진다. 이 프로젝트에서는 공개 저장소에 값을 남기지 않는 주입 경계로 사용하고, runner와 cluster 접근 자체를
별도로 보호한다.

## 회전은 값을 바꾸는 명령보다 검증 절차다

자격 증명 회전의 완료 조건은 Secret patch 성공이 아니다.

1. 새 값을 안전한 입력 경로에서 만든다.
2. 사용하는 서비스와 Secret key를 먼저 확인한다.
3. Secret을 갱신하고 영향받는 workload만 rollout한다.
4. readiness 뒤 실제 로그인·DB 연결·image pull·알림 중 해당 흐름을 실행한다.
5. 이전 값이 더는 작동하지 않는지 확인한다.
6. 회전 시각과 검증 결과만 기록하고 값은 폐기한다.

관리자 비밀번호는 backend bootstrap과 PostgreSQL의 BCrypt hash가 함께 맞아야 한다. DB 비밀번호는 DB role, 애플리케이션과 backup
Job이 같은 전환 시점을 가져야 한다. 그래서 서로 다른 목적의 credential을 한 번에 무작정 교체하지 않는다.

## 설계와 절차는 공개하고 값은 남기지 않는다

아키텍처를 숨기는 것만으로 보안을 만들 수는 없다. 다음 내용은 설계 판단과 검증 근거로 공개할 수 있다.

- 인증 주체와 role, 허용된 동작
- Secret이 주입되는 구성요소와 회전 절차
- token 길이와 해시·TOTP 같은 보호 방식
- 실패 시 응답과 복구 기준

반면 실제 비밀번호, 현재 OTP, TOTP seed, machine token, kubeconfig, runner 등록 token과 Secret의 base64 값은
문서·Git·스크린샷·로그에 남기지 않는다. 내부 주소와 계정 목록도 운영에 꼭 필요한 상세 수준은 비공개 runbook에 둔다.

## 명령은 runbook에 두고 이 글은 이유만 남긴다

검토된 기준 콘텐츠가 machine token을 사용해 배포되는 과정은
[TOTP를 우회하지 않고 위키 기준 콘텐츠를 자동 배포하는 방법](/wiki/gitops-wiki-content-sync-boundary)에서 이어서 설명한다.

저장소의 상세 runbook에는 실제 재실행과 회전 명령을 둔다. 이 공개 글은 명령어 모음이 아니라, 자격 증명이 서로의 권한을
침범하지 않도록 나눈 이유와 완료 기준을 설명한다.

## 남은 개선 — 계정과 RBAC을 더 좁히는 일이 남았다

- 정기 회전 주기와 마지막 검증 시각을 Secret별 inventory로 관리한다.
- MinIO service account를 더 좁힌다. wiki-assets bucket 전용 계정은 배포마다 스크립트로 보장되지만,
  계정이 그 하나뿐이고 권한도 bucket 전체이며, 기술 로고를 올리는 배포 Job은 아직 root 자격증명을 읽는다.
- runner 침해를 가정해 배포 RBAC와 namespace 접근을 더 좁힌다.
- 퇴사자나 분실 기기를 가정한 접근 회수 리허설을 남긴다.

최소 권한은 권한 수를 무조건 줄이는 일이 아니다. 각 주체의 실패와 유출이 어디까지 번지는지 설명할 수 있도록 책임을 분리하고,
회전 뒤 실제 기능으로 검증하는 운영 방식이다.
