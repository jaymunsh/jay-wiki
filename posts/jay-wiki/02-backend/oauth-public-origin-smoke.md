---
title: "OAuth callback을 고친 뒤 로그인 기능 자체를 걷어낸 이유"
slug: oauth-public-origin-smoke
tab: "백엔드"
parentId: backend
sortOrder: 1
kind: wiki
tags: oauth,privacy,nextjs,spring,cloudflare,security
source: scripts/seed-portfolio-wiki.mjs
---
- 프록시를 지나며 http로 잘리던 OAuth callback을 public origin 고정으로 살렸다가, 그 로그인 자체를 왜 걷어냈나?
- 받는 것은 이메일과 계정 식별자인데 쓰이는 곳은 게시판 표시 이름 fallback 한 줄뿐이라 교환이 성립하지 않는다고 보고, 코드 삭제보다 설정 플래그로 수집을 먼저 끊는 순서로 제거하기로 판단했다.
- 운영 게시판 최근 100건이 전부 익명으로 로그인해서 쓴 글이 없음을 확인했고, 제거 전 운영 smoke에서 authorization 302와 공개 HTTPS callback URL, handshake cookie의 Secure·HttpOnly·SameSite Lax를 확인했다.

구글 로그인은 2026년 8월 6일에 제거했다. 이 문서는 지웠다는 통보가 아니라 무엇을 만들었고 왜 뺐는지를
남긴다. 만들면서 얻은 것은 로그인과 함께 사라지지 않는다.

## 프록시를 지나며 callback이 http로 만들어졌다

OAuth는 redirect URL이 등록값과 다르면 로그인 시작부터 깨진다. 브라우저는 HTTPS로 접속했는데 Cloudflare Tunnel, Traefik,
Next.js 프록시를 지나 Spring에 닿는 동안 forwarded proto가 http로 보일 수 있었다. 구글에 등록한
callback은 공개 HTTPS URL인데 내부 hop이 전달한 값만 믿으면 callback URL이 http로 만들어졌다.
로컬에서는 멀쩡하고 운영에서만 로그인 시작이 깨지는 모양이었다.

## 공개 origin을 환경변수로 박아 header보다 앞세웠다

운영 web Pod에 공개 origin을 환경변수로 명시하고, 그 값이 있으면 forwarded header보다 우선하게 했다.

| 환경 | 공개 origin 결정 기준 |
|---|---|
| production | 환경변수로 박아 둔 HTTPS 주소 |
| local | 현재 요청의 host와 protocol |
| reverse proxy 뒤 | proxy hop의 내부 http가 아닌 public origin |

운영 smoke로 auth me의 OAuth 활성 상태, authorization 302, 공개 HTTPS callback URL, handshake
cookie의 Secure, HttpOnly, SameSite Lax 조건을 확인했다.

## 왜 뺐나

고장 나서가 아니다. **받아 가는 개인정보에 값하는 쓸모가 없었다.**

구글 로그인은 openid, profile, email 범위를 요청했고 그 대가로 계정마다 이메일 주소와 구글 계정
식별자를 저장했다. 그런데 그 이메일이 실제로 읽히는 자리는 게시판 표시 이름 fallback 한 줄뿐이었다.
닉네임이 비었을 때만 이메일을 대신 보여주는 코드다.

로그인해서 열리는 문도 없었다. 인가 규칙은 ADMIN이 아니면 전부 공개라, 로그인한 USER가 추가로 할 수
있는 일은 게시판 작성자 이름이 익명 대신 계정 이름으로 바뀌는 것 하나였다. 운영 게시판의 최근 100건을
확인했더니 전부 익명이었고 로그인해서 쓴 글은 없었다.

받는 것은 남의 이메일이고 주는 것은 이름 표시 하나였다. 그 교환이 성립하지 않았다.

## 코드보다 수집을 먼저 끊는 순서로 뺐다

| 순서 | 한 일 |
|---|---|
| 1 | 설정 플래그 주입을 끊어 로그인 버튼과 authorization 경로를 먼저 닫았다 |
| 2 | OAuth 설정, 성공 핸들러, 계정 upsert, 프록시 route를 지웠다 |
| 3 | 구글 계정 행을 지우고 email과 subject 컬럼을 드롭했다 |
| 4 | 위키용 개인정보 처리방침을 새로 썼다 |

코드부터 지우면 배포가 나갈 때까지 수집이 계속된다. 그래서 끄는 것을 먼저 했다.

로컬 회원가입은 남겼다. 지금 쓰임이 있어서가 아니라 개인정보 처리 시나리오를 만들 재료로 쓰려고
일부러 둔 것이다.

## 프록시는 공개 URL을 보존하지 않는다

프록시는 요청을 전달하지만 사용자가 보는 공개 URL을 자동으로 보존하지 않는다. 인증처럼 절대 URL이
중요한 흐름에서는 내부 hop의 헤더보다 명시적인 public origin이 안전한 기준이다. OAuth를 뺀 지금도
절대 URL을 만드는 자리는 남아 있다. 공유 카드 이미지와 canonical 주소가 그렇다.

## 붙이기 전에 받아 가는 것을 센다

구글 로그인은 붙이기 쉬웠고, 그래서 필요한지 묻지 않고 붙였다. 빼는 데 든 일이 붙이는 데 든
일보다 많았다. 기능을 붙이기 전에 그 기능이 무엇을 받아 가는지 세어 봐야 한다.
